import SwiftUI

struct WelcomeView: View {
    @AppStorage("signedIn") private var signedIn = false
    @State private var animateGlow = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                ZStack {
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .fill(Theme.accent.opacity(0.18))
                        .frame(width: 128, height: 128)
                        .blur(radius: animateGlow ? 24 : 10)
                        .scaleEffect(animateGlow ? 1.15 : 0.95)

                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Theme.accent, Color(hex: 0xFF8A3D)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 108, height: 108)
                        .overlay(
                            Image(systemName: "hammer.fill")
                                .font(.system(size: 48, weight: .bold))
                                .foregroundStyle(.white)
                        )
                        .shadow(color: Theme.accent.opacity(0.45), radius: 24, y: 8)
                }
                .onAppear {
                    withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) {
                        animateGlow = true
                    }
                }

                Text("Forge")
                    .font(.system(size: 44, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.top, 28)

                Text("Describe an idea. Watch it become\na live web app — right from your phone.")
                    .font(.system(size: 17))
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .padding(.top, 10)

                Spacer()

                VStack(spacing: 14) {
                    featureRow(icon: "sparkles", text: "AI writes your app from a prompt")
                    featureRow(icon: "cube.box.fill", text: "Runs in an isolated cloud sandbox")
                    featureRow(icon: "iphone", text: "Preview and iterate instantly")
                }
                .padding(.horizontal, 36)

                Spacer()

                Button {
                    signedIn = true
                } label: {
                    HStack(spacing: 8) {
                        Text("Enter App")
                        Image(systemName: "arrow.right")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal, 24)

                Text("No account needed — you're already signed in.")
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
            }
        }
    }

    private func featureRow(icon: String, text: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 34, height: 34)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Theme.accentSoft)
                )
            Text(text)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.textPrimary)
            Spacer()
        }
    }
}

#Preview {
    WelcomeView()
}
