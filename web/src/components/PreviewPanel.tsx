import { useState } from "react";
import { isBusy, type Project } from "../types";

interface PreviewPanelProps {
  project: Project | null;
  reloadToken: number;
  waking: boolean;
  onReload: () => void;
  onWake: () => void;
}

export default function PreviewPanel({
  project,
  reloadToken,
  waking,
  onReload,
  onWake,
}: PreviewPanelProps) {
  const [copied, setCopied] = useState(false);
  const url = project?.previewUrl ?? null;
  const busy = isBusy(project?.status);

  if (!url) {
    return (
      <div className="panel-placeholder">
        {busy ? (
          <>
            <span className="spinner spinner-lg" />
            <h2>Your app is being built…</h2>
            <p>The live preview will appear here as soon as it's deployed to the sandbox.</p>
          </>
        ) : (
          <>
            <div className="empty-icon">🌐</div>
            <h2>No preview yet</h2>
            <p>Send a prompt in the chat and Forge will build and deploy your app.</p>
          </>
        )}
      </div>
    );
  }

  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      // Clipboard unavailable (permissions) — ignore.
    }
  }

  return (
    <div className="preview">
      <div className="preview-bar">
        <span className="preview-host" title={url}>
          🔒 {host}
        </span>
        <button className="icon-btn" onClick={onReload} title="Reload preview" aria-label="Reload preview">
          ↻
        </button>
        <button
          className="icon-btn preview-wake"
          onClick={onWake}
          disabled={waking}
          title="Wake sandbox — sandboxes sleep after 30 minutes idle"
          aria-label="Wake sandbox"
        >
          {waking ? <span className="spinner spinner-sm" /> : "☀"}
        </button>
        <button className="icon-btn" onClick={() => void copyLink()} title="Copy link" aria-label="Copy link">
          {copied ? "✓" : "⧉"}
        </button>
        <a className="icon-btn" href={url} target="_blank" rel="noreferrer" title="Open in new tab" aria-label="Open in new tab">
          ↗
        </a>
      </div>

      <div className="preview-frame-wrap">
        <iframe
          key={reloadToken}
          className="preview-frame"
          src={url}
          title="App preview"
        />
        {busy && (
          <div className="preview-overlay">
            <span className="spinner spinner-lg" />
            <p>Rebuilding…</p>
          </div>
        )}
      </div>

      <p className="preview-hint">
        Preview not loading? The sandbox is probably asleep — hit ☀ to wake it.
      </p>
    </div>
  );
}
