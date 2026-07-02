import SwiftUI
import UIKit

enum Theme {
    /// Replit-style dark palette.
    static let background = Color(hex: 0x0E1525)
    static let surface = Color(hex: 0x1C2333)
    static let surfaceHigher = Color(hex: 0x2B3245)
    static let border = Color(hex: 0x3C445C)
    static let accent = Color(hex: 0xF26207)      // Replit orange
    static let accentSoft = Color(hex: 0xF26207).opacity(0.15)
    static let blue = Color(hex: 0x0079F2)
    static let green = Color(hex: 0x00B061)
    static let red = Color(hex: 0xE52222)
    static let yellow = Color(hex: 0xF5C518)
    static let textPrimary = Color(hex: 0xF5F9FC)
    static let textSecondary = Color(hex: 0x9BA6B2)

    static func applyAppearance() {
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(background)
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor(textPrimary)]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(textPrimary)]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
    }
}

extension Color {
    init(hex: UInt32, opacity: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: opacity
        )
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var fullWidth: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.vertical, 16)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.accent)
            )
            .opacity(configuration.isPressed ? 0.75 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.985 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct CardBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Theme.border.opacity(0.5), lineWidth: 1)
                    )
            )
    }
}

extension View {
    func card() -> some View { modifier(CardBackground()) }
}
