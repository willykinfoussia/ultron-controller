import { motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  telegramMessages,
  telegramSend,
  telegramStatus,
  type TelegramMessage,
  type TelegramStatus,
} from "../api/client";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";

type Props = { setToast: (msg: string, kind?: ToastKind) => void };

const POLL_MS = 3000;

function formatTimestamp(ts: string | null | undefined) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function roleClass(role: string): string {
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  return "system";
}

function SetupHelp({ status }: { status: TelegramStatus | null }) {
  const missing = status?.missing ?? [
    "telegram_api_id",
    "telegram_api_hash",
    "telegram_session_string",
    "telegram_bot_username",
  ];

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="card-header">
        <span className="card-title">Telegram not configured</span>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)", margin: 0 }}>
          Set server secrets once — no login in the browser. Ultron sends messages to your bot
          as your Telegram account; Hermes replies via the gateway you already configured.
        </p>
        {status?.error ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--danger)", margin: 0 }}>
            {status.error}
          </p>
        ) : null}
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: "var(--sp-2)" }}>
            Required environment variables:
          </div>
          <ul style={{ margin: 0, paddingLeft: "var(--sp-4)", fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
            {missing.map((key) => (
              <li key={key}>
                <span className="mono">ULTRON_{key.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", margin: 0 }}>
          Generate a session string once:{" "}
          <span className="mono">python scripts/telegram_session_setup.py</span>
        </p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", margin: 0 }}>
          Security: the session string grants full access to your Telegram account. Bind Ultron
          to localhost or protect it behind an authenticated reverse proxy.
        </p>
      </div>
    </div>
  );
}

export function TelegramPage({ setToast }: Props) {
  const prefersReduced = useReducedMotion();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await telegramStatus();
      setStatus(data);
      return data;
    } catch (err) {
      setToast(String(err), "error");
      return null;
    } finally {
      setStatusLoading(false);
    }
  }, [setToast]);

  const refreshMessages = useCallback(async () => {
    if (!status?.connected) return;
    setMessagesLoading(true);
    try {
      const data = await telegramMessages(80);
      setMessages(data.messages);
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setMessagesLoading(false);
    }
  }, [setToast, status?.connected]);

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, [refreshStatus]);

  useEffect(() => {
    if (!status?.connected) return;
    refreshMessages().catch(() => undefined);
  }, [status?.connected, refreshMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!status?.connected) return;
    const id = window.setInterval(() => {
      refreshMessages().catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshMessages, status?.connected]);

  async function send() {
    const text = input.trim();
    if (!text || sending || !status?.connected) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    try {
      await telegramSend(text);
      await refreshMessages();
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      send().catch(() => undefined);
    }
  }

  if (statusLoading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner size="md" /> Loading Telegram…
      </div>
    );
  }

  if (!status?.configured || !status.connected) {
    return (
      <div className="page">
        <SetupHelp status={status} />
      </div>
    );
  }

  const botLabel = status.bot_username ? `@${status.bot_username}` : "bot";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: "var(--sp-4)",
        gap: "var(--sp-3)",
        minHeight: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexShrink: 0 }}>
        <span className="badge success">Connected</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
          Chat with {botLabel} — Hermes replies in Telegram
        </span>
        {messagesLoading ? <Spinner size="sm" /> : null}
      </div>

      <div className="card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div className="card-body" style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {messages.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">✈️</span>
              <span className="empty-state-title">No messages yet</span>
              <span className="empty-state-desc">
                Send a message below. Replies from {botLabel} appear here after Hermes processes them.
              </span>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message, i) => (
                <motion.div
                  className="message"
                  key={message.id}
                  initial={prefersReduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2 }}
                >
                  <div className={`message-bubble ${roleClass(message.role)}`}>
                    <div className="message-content">{message.content}</div>
                    {message.timestamp ? (
                      <div className="message-meta">{formatTimestamp(message.timestamp)}</div>
                    ) : null}
                  </div>
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div
          className="card-footer"
          style={{
            display: "flex",
            gap: "var(--sp-2)",
            alignItems: "flex-end",
            borderTop: "1px solid var(--border)",
            padding: "var(--sp-3)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Message ${botLabel}…`}
            rows={1}
            disabled={sending}
            style={{ flex: 1, resize: "none", minHeight: 40, maxHeight: 160 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
          />
          <button className="primary" onClick={() => send()} disabled={sending || !input.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>

      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", margin: 0, flexShrink: 0 }}>
        Messages you send here appear in Telegram as your account. Bot replies refresh every few seconds.
      </p>
    </div>
  );
}
