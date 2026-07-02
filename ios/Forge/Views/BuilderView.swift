import SwiftUI

@MainActor
final class BuilderViewModel: ObservableObject {
    let projectId: String

    @Published var project: Project?
    @Published var messages: [ChatMessage] = []
    @Published var files: [ProjectFile] = []
    @Published var errorMessage: String?
    @Published var isSending = false
    /// Bumped whenever the preview should be reloaded from scratch.
    @Published var previewReloadToken = 0

    private var pollTask: Task<Void, Never>?
    private var lastStatus: ProjectStatus?

    init(projectId: String) {
        self.projectId = projectId
    }

    func startPolling() {
        stopPolling()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                let busy = self?.project?.status.isBusy ?? true
                try? await Task.sleep(for: .seconds(busy ? 2 : 6))
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func refresh() async {
        do {
            let detail = try await APIClient.shared.projectDetail(id: projectId)
            let previousStatus = lastStatus
            project = detail.project
            messages = detail.messages
            lastStatus = detail.project.status

            // When a build finishes, pull fresh code and reload the preview.
            if previousStatus != detail.project.status, detail.project.status == .ready {
                await loadFiles()
                previewReloadToken += 1
            }
            if files.isEmpty, detail.project.status == .ready {
                await loadFiles()
            }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadFiles() async {
        do {
            files = try await APIClient.shared.projectFiles(id: projectId)
        } catch {
            // Non-fatal; code tab shows its own empty state.
        }
    }

    func send(prompt: String) async {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isSending = true
        defer { isSending = false }
        do {
            try await APIClient.shared.sendMessage(projectId: projectId, prompt: trimmed)
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func wake() async {
        do {
            try await APIClient.shared.wakeProject(id: projectId)
            await refresh()
            previewReloadToken += 1
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct BuilderView: View {
    @StateObject private var viewModel: BuilderViewModel
    @State private var selectedTab: Tab = .chat

    enum Tab: String, CaseIterable {
        case preview = "Preview"
        case chat = "Chat"
        case code = "Code"

        var icon: String {
            switch self {
            case .preview: return "safari"
            case .chat: return "bubble.left.and.bubble.right"
            case .code: return "chevron.left.forwardslash.chevron.right"
            }
        }
    }

    init(projectId: String) {
        _viewModel = StateObject(wrappedValue: BuilderViewModel(projectId: projectId))
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                tabBar

                if let project = viewModel.project, project.status.isBusy || project.status == .error {
                    BuildStatusBanner(project: project)
                        .padding(.horizontal, 16)
                        .padding(.top, 10)
                }

                switch selectedTab {
                case .preview:
                    PreviewTab(viewModel: viewModel)
                case .chat:
                    ChatTab(viewModel: viewModel)
                case .code:
                    CodeTab(viewModel: viewModel)
                }
            }
        }
        .navigationTitle(viewModel.project.map { "\($0.icon) \($0.name)" } ?? "App")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.refresh()
            await viewModel.loadFiles()
            viewModel.startPolling()
            // Land on the preview when the app is already live.
            if viewModel.project?.status == .ready {
                selectedTab = .preview
            }
        }
        .onDisappear { viewModel.stopPolling() }
        .onChange(of: viewModel.project?.status) { _, newStatus in
            if newStatus == .ready {
                selectedTab = .preview
            }
        }
    }

    private var tabBar: some View {
        HStack(spacing: 6) {
            ForEach(Tab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { selectedTab = tab }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 13, weight: .semibold))
                        Text(tab.rawValue)
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .foregroundStyle(selectedTab == tab ? Theme.textPrimary : Theme.textSecondary)
                    .padding(.vertical, 9)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(selectedTab == tab ? Theme.surfaceHigher : .clear)
                    )
                }
            }
        }
        .padding(5)
        .background(
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .fill(Theme.surface)
        )
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

struct BuildStatusBanner: View {
    let project: Project
    @State private var pulse = false

    var body: some View {
        HStack(spacing: 10) {
            if project.status.isBusy {
                ProgressView()
                    .controlSize(.small)
                    .tint(Theme.yellow)
            } else if project.status == .error {
                Image(systemName: "xmark.octagon.fill")
                    .foregroundStyle(Theme.red)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(project.status == .error ? "Build failed" : bannerTitle)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                if let detail = project.statusMessage, !detail.isEmpty {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(2)
                }
            }
            Spacer()
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(project.status == .error ? Theme.red.opacity(0.12) : Theme.yellow.opacity(0.10))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(
                            (project.status == .error ? Theme.red : Theme.yellow).opacity(pulse ? 0.5 : 0.2),
                            lineWidth: 1
                        )
                )
        )
        .onAppear {
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }

    private var bannerTitle: String {
        switch project.status {
        case .generating: return "Claude is writing your app…"
        case .deploying: return "Deploying to sandbox…"
        default: return "Working…"
        }
    }
}
