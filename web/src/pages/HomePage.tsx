import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage, isConfigured } from "../api";
import { relativeTime } from "../hooks";
import type { Project } from "../types";
import StatusPill from "../components/StatusPill";
import SettingsModal from "../components/SettingsModal";
import NewProjectModal from "../components/NewProjectModal";

const POLL_MS = 5_000;

export default function HomePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [configured, setConfigured] = useState(isConfigured());

  const refresh = useCallback(async (quiet: boolean) => {
    if (!isConfigured()) {
      setConfigured(false);
      setProjects([]);
      setLoaded(true);
      return;
    }
    setConfigured(true);
    try {
      setProjects(await api.listProjects());
      setError(null);
    } catch (err) {
      if (!quiet) setError(errorMessage(err));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async (quiet: boolean) => {
      await refresh(quiet);
      if (!alive) return;
      timer = setTimeout(() => void tick(true), POLL_MS);
    };
    void tick(false);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  async function deleteProject(project: Project) {
    if (!window.confirm(`Delete “${project.name}” and its sandbox?`)) return;
    try {
      await api.deleteProject(project.id);
      setProjects((current) => current.filter((p) => p.id !== project.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">🔨</span>
          <span className="brand-name">Forge</span>
        </div>
        <div className="topbar-actions">
          {configured && (
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              + Create App
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="page-body">
        <h1 className="page-title">My Apps</h1>

        {error && <div className="banner banner-warn">{error}</div>}

        {!configured ? (
          <div className="empty-state">
            <div className="empty-icon">🖥️</div>
            <h2>Connect your backend</h2>
            <p>
              Forge needs the URL of your Convex deployment to build and host
              apps. Describe an idea, watch Claude write the code, and use the
              running app right here in the browser.
            </p>
            <button className="btn btn-accent" onClick={() => setShowSettings(true)}>
              Open Settings
            </button>
          </div>
        ) : loaded && projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h2>No apps yet</h2>
            <p>
              Tap <strong>Create App</strong> and describe what you want to
              build. Forge writes the code and deploys it to a live sandbox.
            </p>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <Link key={project.id} to={`/p/${project.id}`} className="project-card">
                <span className="project-icon">{project.icon}</span>
                <span className="project-meta">
                  <span className="project-name">{project.name}</span>
                  <span className="project-sub">
                    <StatusPill status={project.status} />
                    <span className="project-time">
                      {relativeTime(project.updatedAt)}
                    </span>
                  </span>
                </span>
                <button
                  className="icon-btn project-delete"
                  aria-label={`Delete ${project.name}`}
                  title="Delete app"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void deleteProject(project);
                  }}
                >
                  🗑
                </button>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSaved={() => void refresh(false)}
        />
      )}
      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreated={(projectId) => navigate(`/p/${projectId}`)}
        />
      )}
    </div>
  );
}
