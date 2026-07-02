import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useIsDesktop } from "../hooks";
import { isBusy, type ChatMessage, type Project, type ProjectFile, type ProjectStatus } from "../types";
import StatusPill from "../components/StatusPill";
import ChatPanel from "../components/ChatPanel";
import PreviewPanel from "../components/PreviewPanel";
import CodePanel from "../components/CodePanel";

type PanelTab = "chat" | "preview" | "code";

export default function BuilderPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const isDesktop = useIsDesktop();

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [waking, setWaking] = useState(false);
  /** Bumped whenever the preview iframe should be recreated. */
  const [reloadToken, setReloadToken] = useState(0);

  // Mobile: one visible panel. Desktop: chat is always visible on the left,
  // and this picks the right-hand panel (preview or code).
  const [tab, setTab] = useState<PanelTab>("chat");
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview");

  const prevStatus = useRef<ProjectStatus | null>(null);
  const filesLoaded = useRef(false);

  const loadFiles = useCallback(async () => {
    if (!projectId) return;
    try {
      setFiles(await api.projectFiles(projectId));
      filesLoaded.current = true;
    } catch {
      // Non-fatal; the code tab shows its own empty state.
    }
  }, [projectId]);

  const refresh = useCallback(async (): Promise<ProjectStatus | null> => {
    if (!projectId) return null;
    try {
      const detail = await api.projectDetail(projectId);
      setProject(detail.project);
      setMessages(detail.messages);
      setError(null);

      const previous = prevStatus.current;
      prevStatus.current = detail.project.status;
      if (detail.project.status === "ready") {
        // Pull fresh code after a build finishes (or on first load).
        if (previous !== "ready" || !filesLoaded.current) {
          await loadFiles();
        }
        // A build just completed while we were watching — show the result.
        if (previous !== null && previous !== "ready") {
          setReloadToken((token) => token + 1);
          setTab("preview");
          setRightTab("preview");
        }
      }
      return detail.project.status;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    }
  }, [projectId, loadFiles]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const status = await refresh();
      if (!alive) return;
      timer = setTimeout(tick, isBusy(status ?? undefined) ? 2_000 : 6_000);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  // Land on the preview when opening an already-live project (once).
  const didInitTab = useRef(false);
  useEffect(() => {
    if (!didInitTab.current && project) {
      didInitTab.current = true;
      if (project.status === "ready") setTab("preview");
    }
  }, [project]);

  async function send(prompt: string): Promise<boolean> {
    if (!projectId) return false;
    setSending(true);
    try {
      await api.sendMessage(projectId, prompt);
      await refresh();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setSending(false);
    }
  }

  async function wake() {
    if (!projectId) return;
    setWaking(true);
    try {
      await api.wakeProject(projectId);
      // Give the sandbox a moment to boot before reloading the preview.
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      await refresh();
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWaking(false);
    }
  }

  const busy = isBusy(project?.status);

  const chatPanel = (
    <ChatPanel
      messages={messages}
      busy={busy}
      sending={sending}
      onSend={send}
    />
  );
  const previewPanel = (
    <PreviewPanel
      project={project}
      reloadToken={reloadToken}
      waking={waking}
      onReload={() => setReloadToken((token) => token + 1)}
      onWake={() => void wake()}
    />
  );
  const codePanel = <CodePanel files={files} onRefresh={() => void loadFiles()} />;

  return (
    <div className="page builder">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="icon-btn" aria-label="Back to My Apps" title="My Apps">
            ←
          </Link>
          <div className="brand">
            <span className="brand-mark">{project?.icon ?? "🔨"}</span>
            <span className="brand-name">{project?.name ?? "App"}</span>
          </div>
          {project && <StatusPill status={project.status} />}
        </div>
        {!isDesktop && (
          <nav className="tabbar">
            {(["chat", "preview", "code"] as const).map((name) => (
              <button
                key={name}
                className={`tab ${tab === name ? "tab-active" : ""}`}
                onClick={() => setTab(name)}
              >
                {name === "chat" ? "Chat" : name === "preview" ? "Preview" : "Code"}
              </button>
            ))}
          </nav>
        )}
      </header>

      {project && (busy || project.status === "error") && (
        <div className={`banner ${project.status === "error" ? "banner-error" : "banner-warn"}`}>
          {busy && <span className="spinner spinner-sm" />}
          <strong>
            {project.status === "error"
              ? "Build failed"
              : project.status === "generating"
                ? "Claude is writing your app…"
                : "Deploying to sandbox…"}
          </strong>
          {project.statusMessage && project.status === "error" && (
            <span className="banner-detail">{project.statusMessage}</span>
          )}
        </div>
      )}

      {error && (
        <div className="banner banner-warn">
          {error}
          <button className="icon-btn banner-dismiss" onClick={() => setError(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {isDesktop ? (
        <div className="builder-split">
          <section className="builder-chat">{chatPanel}</section>
          <section className="builder-right">
            <nav className="tabbar tabbar-inline">
              <button
                className={`tab ${rightTab === "preview" ? "tab-active" : ""}`}
                onClick={() => setRightTab("preview")}
              >
                Preview
              </button>
              <button
                className={`tab ${rightTab === "code" ? "tab-active" : ""}`}
                onClick={() => setRightTab("code")}
              >
                Code
              </button>
            </nav>
            <div className="builder-right-body">
              {rightTab === "preview" ? previewPanel : codePanel}
            </div>
          </section>
        </div>
      ) : (
        <div className="builder-single">
          {tab === "chat" ? chatPanel : tab === "preview" ? previewPanel : codePanel}
        </div>
      )}
    </div>
  );
}
