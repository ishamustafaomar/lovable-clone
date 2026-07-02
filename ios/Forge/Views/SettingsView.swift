import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage(APIClient.backendURLKey) private var backendURL = ""
    @AppStorage("signedIn") private var signedIn = false

    @State private var draftURL = ""
    @State private var testState: TestState = .idle

    enum TestState: Equatable {
        case idle, testing, success
        case failed(String)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Backend URL")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.textSecondary)

                            TextField(
                                "",
                                text: $draftURL,
                                prompt: Text("https://your-deployment.convex.site")
                                    .foregroundStyle(Theme.textSecondary.opacity(0.6))
                            )
                            .textFieldStyle(.plain)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .foregroundStyle(Theme.textPrimary)
                            .padding(14)
                            .card()

                            Text("The HTTP Actions URL of your Convex deployment (ends in .convex.site). Find it with `npx convex dashboard` → Settings → URL & Deploy Key.")
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }

                        HStack(spacing: 12) {
                            Button {
                                saveAndTest()
                            } label: {
                                HStack(spacing: 8) {
                                    switch testState {
                                    case .idle:
                                        Image(systemName: "bolt.fill")
                                        Text("Save & Test")
                                    case .testing:
                                        ProgressView().tint(.white)
                                        Text("Testing…")
                                    case .success:
                                        Image(systemName: "checkmark.circle.fill")
                                        Text("Connected")
                                    case .failed:
                                        Image(systemName: "arrow.clockwise")
                                        Text("Retry")
                                    }
                                }
                            }
                            .buttonStyle(PrimaryButtonStyle(fullWidth: false))
                        }

                        if case .failed(let message) = testState {
                            HStack(spacing: 8) {
                                Image(systemName: "xmark.octagon.fill")
                                    .foregroundStyle(Theme.red)
                                Text(message)
                                    .font(.footnote)
                                    .foregroundStyle(Theme.textPrimary)
                            }
                            .padding(12)
                            .card()
                        }

                        if case .success = testState {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundStyle(Theme.green)
                                Text("Backend is reachable and healthy.")
                                    .font(.footnote)
                                    .foregroundStyle(Theme.textPrimary)
                            }
                            .padding(12)
                            .card()
                        }

                        Divider().overlay(Theme.border)

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Account")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.textSecondary)

                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Theme.accentSoft)
                                    .frame(width: 44, height: 44)
                                    .overlay(
                                        Text("🔨")
                                            .font(.system(size: 20))
                                    )
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Builder")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Theme.textPrimary)
                                    Text("builder@forge.local")
                                        .font(.caption)
                                        .foregroundStyle(Theme.textSecondary)
                                }
                                Spacer()
                            }
                            .padding(14)
                            .card()

                            Button {
                                signedIn = false
                                dismiss()
                            } label: {
                                Text("Sign Out")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Theme.red)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .card()
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
            .onAppear { draftURL = backendURL }
        }
    }

    private func saveAndTest() {
        backendURL = draftURL.trimmingCharacters(in: .whitespacesAndNewlines)
        testState = .testing
        Task {
            do {
                _ = try await APIClient.shared.health()
                testState = .success
            } catch {
                testState = .failed(error.localizedDescription)
            }
        }
    }
}
