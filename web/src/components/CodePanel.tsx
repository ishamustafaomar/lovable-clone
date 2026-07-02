import { useState } from "react";
import type { ProjectFile } from "../types";

interface CodePanelProps {
  files: ProjectFile[];
  onRefresh: () => void;
}

const EXT_ICON: Record<string, string> = {
  html: "🟧",
  css: "🟦",
  js: "🟨",
  mjs: "🟨",
  ts: "🟨",
  json: "🟩",
  md: "📄",
  svg: "🖼",
  png: "🖼",
  jpg: "🖼",
};

function fileIcon(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_ICON[ext] ?? "📄";
}

export default function CodePanel({ files, onRefresh }: CodePanelProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const selected = files.find((file) => file.path === selectedPath) ?? null;

  if (files.length === 0) {
    return (
      <div className="panel-placeholder">
        <div className="empty-icon">📂</div>
        <h2>No code yet</h2>
        <p>Once Forge builds your app, every generated file shows up here.</p>
        <button className="btn" onClick={onRefresh}>
          Refresh
        </button>
      </div>
    );
  }

  if (selected) {
    const lines = selected.content.split("\n");
    const width = String(lines.length).length;
    const numbered = lines
      .map((line, index) => `${String(index + 1).padStart(width)}  ${line}`)
      .join("\n");

    return (
      <div className="code-viewer">
        <div className="code-viewer-bar">
          <button className="icon-btn" onClick={() => setSelectedPath(null)} aria-label="Back to files">
            ←
          </button>
          <span className="code-viewer-path">{selected.path}</span>
          <button
            className="icon-btn"
            title="Copy file contents"
            aria-label="Copy file contents"
            onClick={() => {
              void navigator.clipboard.writeText(selected.content).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1_500);
              });
            }}
          >
            {copied ? "✓" : "⧉"}
          </button>
        </div>
        <pre className="code-content">{numbered}</pre>
      </div>
    );
  }

  return (
    <div className="file-list">
      {files.map((file) => (
        <button key={file.path} className="file-row" onClick={() => setSelectedPath(file.path)}>
          <span className="file-icon">{fileIcon(file.path)}</span>
          <span className="file-meta">
            <span className="file-path">{file.path}</span>
            <span className="file-sub">
              {file.content.length.toLocaleString()} chars ·{" "}
              {file.content.split("\n").length.toLocaleString()} lines
            </span>
          </span>
          <span className="file-chevron">›</span>
        </button>
      ))}
    </div>
  );
}
