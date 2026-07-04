import SwiftUI

@main
struct ForgeApp: App {
    @AppStorage("signedIn") private var signedIn = false

    init() {
        Theme.applyAppearance()
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if signedIn {
                    HomeView()
                        .transition(.opacity)
                } else {
                    WelcomeView()
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.35), value: signedIn)
            .preferredColorScheme(.dark)
            .tint(Theme.accent)
        }
    }
}
