import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";

interface ChatPanelProps {
  messages: ChatMessage[];
  busy: boolean;
  sending: boolean;
  /** Resolves false when the message could not be delivered. */
  onSend: (prompt: string) => Promise<boolean>;
}

export default function ChatPanel({ messages, busy, sending, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  const canSend = draft.trim().length > 0 && !busy && !sending;

  async function handleSend() {
    const text = draft.trim();
    if (!text || !canSend) return;
    setDraft("");
    const delivered = await onSend(text);
    // Give the user their prompt back so they can retry.
    if (!delivered) setDraft(text);
  }

  return (
    <div className="chat">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {busy && <TypingIndicator />}
      </div>

      <div className="chat-input">
        <textarea
          rows={Math.min(4, draft.split("\n").length)}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Describe a change…"
        />
        <button
          className="btn btn-primary chat-send"
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  switch (message.role) {
    case "user":
      return <div className="msg msg-user">{message.content}</div>;
    case "assistant":
      return (
        <div className="msg-row">
          <span className="msg-avatar">✦</span>
          <div className="msg msg-assistant">{message.content}</div>
        </div>
      );
    case "error":
      return <div className="msg msg-error">⚠ {message.content}</div>;
    default: // "status"
      return <div className="msg msg-status">{message.content}</div>;
  }
}

function TypingIndicator() {
  return (
    <div className="msg-row">
      <span className="msg-avatar">✦</span>
      <div className="msg msg-assistant typing">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}
