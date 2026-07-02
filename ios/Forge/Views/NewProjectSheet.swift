import SwiftUI

struct NewProjectSheet: View {
    let onCreated: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var prompt = ""
    @State private var isCreating = false
    @State private var errorMessage: String?
    @FocusState private var promptFocused: Bool

    private let ideas: [(title: String, prompt: String)] = [
        ("✅ Todo app", "A beautiful todo app with categories, due dates, and a progress ring showing how much I've completed today. Persist tasks in localStorage."),
        ("🍅 Pomodoro timer", "A pomodoro focus timer with 25/5 minute work/break cycles, a circular countdown animation, session history, and satisfying sounds."),
        ("💸 Expense tracker", "An expense tracker where I can log purchases with categories, see a monthly summary with a bar chart, and set a budget with a warning when I'm close."),
        ("🧠 Quiz game", "A trivia quiz game with multiple categories, a score streak counter, fun animations for right/wrong answers, and a final results screen."),
        ("🌦️ Weather dashboard", "A weather dashboard with a clean card layout showing current conditions and a 5-day forecast using the free Open-Meteo API, with animated weather icons."),
        ("📝 Markdown notes", "A markdown notes app with live preview, a sidebar list of notes, search, and localStorage persistence."),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("App name")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.textSecondary)
                            TextField("", text: $name, prompt: Text("Optional — Forge will pick one").foregroundStyle(Theme.textSecondary.opacity(0.6)))
                                .textFieldStyle(.plain)
                                .foregroundStyle(Theme.textPrimary)
                                .padding(14)
                                .card()
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("What should it do?")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.textSecondary)
                            TextEditor(text: $prompt)
                                .focused($promptFocused)
                                .scrollContentBackground(.hidden)
                                .foregroundStyle(Theme.textPrimary)
                                .frame(minHeight: 140)
                                .padding(10)
                                .card()
                                .overlay(alignment: .topLeading) {
                                    if prompt.isEmpty {
                                        Text("Describe the web app you want to build…")
                                            .foregroundStyle(Theme.textSecondary.opacity(0.6))
                                            .padding(.top, 18)
                                            .padding(.leading, 16)
                                            .allowsHitTesting(false)
                                    }
                                }
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            Text("Need inspiration?")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.textSecondary)
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
                                    ForEach(ideas, id: \.title) { idea in
                                        Button {
                                            prompt = idea.prompt
                                            if name.isEmpty {
                                                name = String(idea.title.dropFirst(2)).trimmingCharacters(in: .whitespaces).capitalized
                                            }
                                        } label: {
                                            Text(idea.title)
                                                .font(.footnote.weight(.medium))
                                                .foregroundStyle(Theme.textPrimary)
                                                .padding(.horizontal, 14)
                                                .padding(.vertical, 10)
                                                .background(
                                                    Capsule().fill(Theme.surfaceHigher)
                                                )
                                        }
                                    }
                                }
                            }
                        }

                        if let error = errorMessage {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundStyle(Theme.yellow)
                                Text(error)
                                    .font(.footnote)
                                    .foregroundStyle(Theme.textPrimary)
                            }
                            .padding(12)
                            .card()
                        }

                        Button {
                            create()
                        } label: {
                            if isCreating {
                                HStack(spacing: 10) {
                                    ProgressView().tint(.white)
                                    Text("Creating…")
                                }
                            } else {
                                HStack(spacing: 8) {
                                    Image(systemName: "sparkles")
                                    Text("Build It")
                                }
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreating)
                        .opacity(prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("New App")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
    }

    private func create() {
        let trimmedPrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPrompt.isEmpty else { return }
        isCreating = true
        errorMessage = nil
        Task {
            do {
                let projectId = try await APIClient.shared.createProject(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    prompt: trimmedPrompt
                )
                dismiss()
                onCreated(projectId)
            } catch {
                errorMessage = error.localizedDescription
            }
            isCreating = false
        }
    }
}
