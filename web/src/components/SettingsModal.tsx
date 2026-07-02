import { useState } from "react";
import Modal from "./Modal";
import {
  api,
  errorMessage,
  getApiSecret,
  getBackendUrl,
  setApiSecret,
  setBackendUrl,
} from "../api";

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "success" }
  | { kind: "failed"; message: string };

interface SettingsModalProps {
  onClose: () => void;
  /** Called after a successful save so the parent can refresh. */
  onSaved: () => void;
}

export default function SettingsModal({ onClose, onSaved }: SettingsModalProps) {
  const [url, setUrl] = useState(getBackendUrl());
  const [secret, setSecret] = useState(getApiSecret());
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  async function saveAndTest() {
    setBackendUrl(url);
    setApiSecret(secret);
    setTestState({ kind: "testing" });
    try {
      await api.health();
      setTestState({ kind: "success" });
      onSaved();
    } catch (error) {
      setTestState({ kind: "failed", message: errorMessage(error) });
    }
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <label className="field">
        <span className="field-label">Backend URL</span>
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://your-deployment.convex.site"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className="field-hint">
          The HTTP Actions URL of your Convex deployment (ends in .convex.site).
          Find it in the Convex dashboard under Settings → URL &amp; Deploy Key.
        </span>
      </label>

      <label className="field">
        <span className="field-label">API secret (optional)</span>
        <input
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="Only if FORGE_API_SECRET is set"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className="field-hint">
          Sent as the x-forge-secret header. Leave empty unless you set
          FORGE_API_SECRET on the Convex deployment.
        </span>
      </label>

      <div className="modal-actions">
        <button
          className="btn btn-primary"
          onClick={saveAndTest}
          disabled={testState.kind === "testing"}
        >
          {testState.kind === "testing" ? (
            <>
              <span className="spinner spinner-sm" /> Testing…
            </>
          ) : testState.kind === "success" ? (
            "✓ Connected"
          ) : testState.kind === "failed" ? (
            "Retry"
          ) : (
            "Save & Test"
          )}
        </button>
        <button className="btn" onClick={onClose}>
          Done
        </button>
      </div>

      {testState.kind === "failed" && (
        <div className="banner banner-error">{testState.message}</div>
      )}
      {testState.kind === "success" && (
        <div className="banner banner-success">
          Backend is reachable and healthy.
        </div>
      )}
    </Modal>
  );
}
