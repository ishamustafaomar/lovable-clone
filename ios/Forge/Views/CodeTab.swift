import SwiftUI

struct CodeTab: View {
    @ObservedObject var viewModel: BuilderViewModel

    var body: some View {
        Group {
            if viewModel.files.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(viewModel.files) { file in
                            NavigationLink {
                                CodeFileView(file: file)
                            } label: {
                                FileRow(file: file)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
                .refreshable { await viewModel.loadFiles() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 46))
                .foregroundStyle(Theme.textSecondary.opacity(0.5))
            Text("No code yet")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            Text("Once Forge builds your app, every generated file shows up here.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 48)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct FileRow: View {
    let file: ProjectFile

    private var ext: String {
        (file.path as NSString).pathExtension.lowercased()
    }

    private var iconInfo: (symbol: String, color: Color) {
        switch ext {
        case "html": return ("chevron.left.forwardslash.chevron.right", Theme.accent)
        case "css": return ("paintbrush.fill", Theme.blue)
        case "js", "mjs", "ts": return ("curlybraces", Theme.yellow)
        case "json": return ("doc.badge.gearshape", Theme.green)
        case "md": return ("doc.plaintext", Theme.textSecondary)
        case "svg", "png", "jpg": return ("photo", Theme.green)
        default: return ("doc", Theme.textSecondary)
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconInfo.symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(iconInfo.color)
                .frame(width: 38, height: 38)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(iconInfo.color.opacity(0.12))
                )

            VStack(alignment: .leading, spacing: 3) {
                Text(file.path)
                    .font(.system(size: 15, weight: .medium, design: .monospaced))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Text("\(file.content.count.formatted()) chars · \(file.content.components(separatedBy: "\n").count) lines")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.textSecondary.opacity(0.6))
        }
        .padding(12)
        .card()
    }
}

struct CodeFileView: View {
    let file: ProjectFile

    private var numberedContent: String {
        let lines = file.content.components(separatedBy: "\n")
        let width = String(lines.count).count
        return lines.enumerated()
            .map { index, line in
                let number = String(index + 1)
                let padding = String(repeating: " ", count: width - number.count)
                return "\(padding)\(number)  \(line)"
            }
            .joined(separator: "\n")
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            // One Text for the whole file — thousands of per-line views would
            // freeze the main thread on large generated files.
            ScrollView([.vertical, .horizontal]) {
                Text(numberedContent)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(Theme.textPrimary)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: true, vertical: true)
                    .padding(14)
            }
        }
        .navigationTitle(file.path)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    UIPasteboard.general.string = file.content
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 14))
                }
            }
        }
    }
}
