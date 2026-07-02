import SwiftUI

@MainActor
final class ProjectListViewModel: ObservableObject {
    @Published var projects: [Project] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var pollTask: Task<Void, Never>?

    func startPolling() {
        stopPolling()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh(quiet: true)
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func refresh(quiet: Bool = false) async {
        guard APIClient.shared.isConfigured else {
            errorMessage = nil
            projects = []
            return
        }
        if !quiet { isLoading = true }
        defer { isLoading = false }
        do {
            projects = try await APIClient.shared.listProjects()
            errorMessage = nil
        } catch {
            if !quiet { errorMessage = error.localizedDescription }
        }
    }

    func delete(_ project: Project) async {
        do {
            try await APIClient.shared.deleteProject(id: project.id)
            projects.removeAll { $0.id == project.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct HomeView: View {
    @StateObject private var viewModel = ProjectListViewModel()
    @State private var showNewProject = false
    @State private var showSettings = false
    @State private var path = NavigationPath()
    @AppStorage(APIClient.backendURLKey) private var backendURL = ""

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Theme.background.ignoresSafeArea()

                Group {
                    if !APIClient.shared.isConfigured {
                        configureBackendState
                    } else if viewModel.projects.isEmpty && !viewModel.isLoading {
                        emptyState
                    } else {
                        projectList
                    }
                }

                VStack {
                    Spacer()
                    if APIClient.shared.isConfigured {
                        Button {
                            showNewProject = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "plus")
                                Text("Create App")
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .padding(.horizontal, 20)
                        .padding(.bottom, 8)
                        .shadow(color: .black.opacity(0.35), radius: 16, y: 6)
                    }
                }
            }
            .navigationTitle("My Apps")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape.fill")
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .sheet(isPresented: $showNewProject) {
                NewProjectSheet { projectId in
                    path.append(projectId)
                    Task { await viewModel.refresh(quiet: true) }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .navigationDestination(for: String.self) { projectId in
                BuilderView(projectId: projectId)
            }
            .task {
                await viewModel.refresh()
                viewModel.startPolling()
            }
            .onDisappear { viewModel.stopPolling() }
            .refreshable { await viewModel.refresh() }
            .onChange(of: backendURL) {
                Task { await viewModel.refresh() }
            }
        }
    }

    private var projectList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if let error = viewModel.errorMessage {
                    errorBanner(error)
                }
                ForEach(viewModel.projects) { project in
                    NavigationLink(value: project.id) {
                        ProjectRow(project: project)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button(role: .destructive) {
                            Task { await viewModel.delete(project) }
                        } label: {
                            Label("Delete App", systemImage: "trash")
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 96)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "shippingbox")
                .font(.system(size: 52))
                .foregroundStyle(Theme.textSecondary.opacity(0.6))
            Text("No apps yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
            Text("Tap **Create App** and describe what you want to build. Forge writes the code and deploys it to a live sandbox.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .offset(y: -40)
    }

    private var configureBackendState: some View {
        VStack(spacing: 16) {
            Image(systemName: "server.rack")
                .font(.system(size: 52))
                .foregroundStyle(Theme.textSecondary.opacity(0.6))
            Text("Connect your backend")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
            Text("Forge needs the URL of your Convex deployment to build and host apps.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 44)
            Button {
                showSettings = true
            } label: {
                Text("Open Settings")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .padding(.vertical, 12)
                    .padding(.horizontal, 24)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Theme.accentSoft)
                    )
            }
        }
        .offset(y: -40)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.yellow)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Theme.textPrimary)
            Spacer()
        }
        .padding(12)
        .card()
    }
}

struct ProjectRow: View {
    let project: Project

    var body: some View {
        HStack(spacing: 14) {
            Text(project.icon)
                .font(.system(size: 26))
                .frame(width: 52, height: 52)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Theme.surfaceHigher)
                )

            VStack(alignment: .leading, spacing: 5) {
                Text(project.name)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 8) {
                    StatusPill(status: project.status)
                    Text(project.updatedDate.formatted(.relative(presentation: .named)))
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.textSecondary.opacity(0.6))
        }
        .padding(14)
        .card()
    }
}

struct StatusPill: View {
    let status: ProjectStatus

    private var color: Color {
        switch status {
        case .idle: return Theme.textSecondary
        case .generating, .deploying: return Theme.yellow
        case .ready: return Theme.green
        case .error: return Theme.red
        }
    }

    var body: some View {
        HStack(spacing: 5) {
            if status.isBusy {
                ProgressView()
                    .controlSize(.mini)
                    .tint(color)
            } else {
                Circle()
                    .fill(color)
                    .frame(width: 7, height: 7)
            }
            Text(status.label)
                .font(.caption.weight(.medium))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(Capsule().fill(color.opacity(0.14)))
    }
}
