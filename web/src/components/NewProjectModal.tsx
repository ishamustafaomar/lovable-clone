import { useState } from "react";
import Modal from "./Modal";
import { api, errorMessage } from "../api";

const IDEAS: { title: string; name: string; prompt: string }[] = [
  {
    title: "✅ Todo app",
    name: "Todo App",
    prompt:
      "A beautiful todo app with categories, due dates, and a progress ring showing how much I've completed today. Persist tasks in localStorage.",
  },
  {
    title: "🍅 Pomodoro timer",
    name: "Pomodoro Timer",
    prompt:
      "A pomodoro focus timer with 25/5 minute work/break cycles, a circular countdown animation, session history, and satisfying sounds.",
  },
  {
    title: "💸 Expense tracker",
    name: "Expense Tracker",
    prompt:
      "An expense tracker where I can log purchases with categories, see a monthly summary with a bar chart, and set a budget with a warning when I'm close.",
  },
  {
    title: "🧠 Quiz game",
    name: "Quiz Game",
    prompt:
      "A trivia quiz game with multiple categories, a score streak counter, fun animations for right/wrong answers, and a final results screen.",
  },
  {
    title: "🌦️ Weather dashboard",
    name: "Weather Dashboard",
    prompt:
      "A weather dashboard with a clean card layout showing current conditions and a 5-day forecast using the free Open-Meteo API, with animated weather icons.",
  },
  {
    title: "📝 Markdown notes",
    name: "Markdown Notes",
    prompt:
      "A markdown notes app with live preview, a sidebar list of notes, search, and localStorage persistence.",
  },
];

interface NewProjectModalProps {
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export default function NewProjectModal({
  onClose,
  onCreated,
}: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = prompt.trim().length > 0 && !creating;

  async function create() {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const projectId = await api.createProject(name.trim(), prompt.trim());
      onCreated(projectId);
    } catch (err) {
      setError(errorMessage(err));
      setCreating(false);
    }
  }

  return (
    <Modal title="New App" onClose={onClose}>
      <label className="field">
        <span className="field-label">App name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Optional — Forge will pick one"
        />
      </label>

      <label className="field">
        <span className="field-label">What should it do?</span>
        <textarea
          rows={5}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the web app you want to build…"
        />
      </label>

      <div className="field">
        <span className="field-label">Need inspiration?</span>
        <div className="idea-chips">
          {IDEAS.map((idea) => (
            <button
              key={idea.title}
              className="chip"
              onClick={() => {
                setPrompt(idea.prompt);
                if (!name.trim()) setName(idea.name);
              }}
            >
              {idea.title}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={create} disabled={!canCreate}>
          {creating ? (
            <>
              <span className="spinner spinner-sm" /> Creating…
            </>
          ) : (
            "✨ Build It"
          )}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
