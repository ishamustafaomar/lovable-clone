import SwiftUI
import WebKit

struct PreviewTab: View {
    @ObservedObject var viewModel: BuilderViewModel
    @State private var isLoading = false
    @State private var loadFailed = false
    @State private var isWaking = false

    var body: some View {
        Group {
            if let urlString = viewModel.project?.previewUrl, let url = URL(string: urlString) {
                VStack(spacing: 0) {
                    addressBar(urlString: urlString, url: url)

                    WebView(url: url, isLoading: $isLoading, loadFailed: $loadFailed)
                        .id(viewModel.previewReloadToken)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Theme.border.opacity(0.5), lineWidth: 1)
                        )
                        .overlay {
                            if loadFailed {
                                loadFailedOverlay
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.bottom, 12)
                        .padding(.top, 8)
                }
            } else {
                placeholder
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onChange(of: viewModel.previewReloadToken) {
            loadFailed = false
        }
    }

    private func wakeAndReload() {
        isWaking = true
        Task {
            await viewModel.wake()
            // Give the sandbox a moment to come up before the fresh WebView loads.
            try? await Task.sleep(for: .seconds(2))
            loadFailed = false
            viewModel.previewReloadToken += 1
            isWaking = false
        }
    }

    private var loadFailedOverlay: some View {
        VStack(spacing: 14) {
            Image(systemName: "moon.zzz.fill")
                .font(.system(size: 40))
                .foregroundStyle(Theme.yellow)
            Text("Preview unreachable")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            Text("The sandbox is probably asleep. Wake it and the preview will reload.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 36)
            Button {
                wakeAndReload()
            } label: {
                HStack(spacing: 8) {
                    if isWaking {
                        ProgressView().tint(.white).controlSize(.small)
                        Text("Waking…")
                    } else {
                        Image(systemName: "sunrise.fill")
                        Text("Wake & Reload")
                    }
                }
            }
            .buttonStyle(PrimaryButtonStyle(fullWidth: false))
            .disabled(isWaking)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background.opacity(0.96))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func addressBar(urlString: String, url: URL) -> some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().controlSize(.mini).tint(Theme.textSecondary)
                } else {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.green)
                }
                Text(url.host() ?? urlString)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(Capsule().fill(Theme.surface))

            Button {
                loadFailed = false
                viewModel.previewReloadToken += 1
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Theme.surface))
            }

            Button {
                wakeAndReload()
            } label: {
                if isWaking {
                    ProgressView()
                        .controlSize(.small)
                        .tint(Theme.accent)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Theme.surface))
                } else {
                    Image(systemName: "sunrise.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Theme.surface))
                }
            }
            .disabled(isWaking)

            ShareLink(item: url) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Theme.surface))
            }

            Link(destination: url) {
                Image(systemName: "safari")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Theme.surface))
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 10)
    }

    private var placeholder: some View {
        VStack(spacing: 16) {
            if viewModel.project?.status.isBusy == true {
                ProgressView()
                    .controlSize(.large)
                    .tint(Theme.accent)
                Text("Your app is being built…")
                    .font(.headline)
                    .foregroundStyle(Theme.textPrimary)
                Text("The live preview will appear here as soon as it's deployed to the sandbox.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 48)
            } else {
                Image(systemName: "globe")
                    .font(.system(size: 52))
                    .foregroundStyle(Theme.textSecondary.opacity(0.5))
                Text("No preview yet")
                    .font(.headline)
                    .foregroundStyle(Theme.textPrimary)
                Text("Send a prompt in the Chat tab and Forge will build and deploy your app.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 48)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var loadFailed: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(isLoading: $isLoading, loadFailed: $loadFailed)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .white
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Reloads are driven by SwiftUI identity (.id(previewReloadToken)),
        // so a fresh WKWebView is created whenever the token changes.
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        @Binding var isLoading: Bool
        @Binding var loadFailed: Bool

        init(isLoading: Binding<Bool>, loadFailed: Binding<Bool>) {
            _isLoading = isLoading
            _loadFailed = loadFailed
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoading = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            isLoading = false
            loadFailed = true
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            isLoading = false
            loadFailed = true
        }
    }
}
