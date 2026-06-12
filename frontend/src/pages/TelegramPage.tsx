import { motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  getHermesFolder,
  telegramMediaDownloadUrl,
  telegramMessages,
  telegramSend,
  telegramStatus,
  type TelegramMessage,
  type TelegramStatus,
} from "../api/client";
import { Spinner } from "../components/Spinner";
import { TelegramIcon } from "../components/TelegramIcon";
import type { ToastKind } from "../components/Toast";

type Props = { setToast: (msg: string, kind?: ToastKind) => void };

const POLL_MS = 3000;
const SCROLL_THRESHOLD = 80;
const ACCEPTED_EXTENSIONS =
  ".xlsx,.xls,.docx,.doc,.pptx,.ppt,.txt,.csv,.pdf,.png,.jpg,.jpeg,.gif,.webp,.zip,.mp3,.ogg,.wav,.m4a,.mp4,.webm";

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

function isNearBottom(el: HTMLElement, threshold = SCROLL_THRESHOLD): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function lastMessageId(msgs: TelegramMessage[]): number | null {
  if (!msgs.length) return null;
  return msgs[msgs.length - 1].id;
}

function awaitingReply(messages: TelegramMessage[]): boolean {
  if (!messages.length) return false;
  const last = messages[messages.length - 1];
  return last.role === "user";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mediaIcon(mediaType: string | null | undefined): string {
  if (mediaType === "photo") return "🖼";
  if (mediaType === "video") return "🎬";
  if (mediaType === "voice" || mediaType === "audio") return "🎵";
  return "📎";
}

function mergeSentMessage(messages: TelegramMessage[], sent: TelegramMessage): TelegramMessage[] {
  const idx = messages.findIndex((m) => m.id === sent.id);
  if (idx >= 0) {
    const next = [...messages];
    next[idx] = sent;
    return next;
  }
  return [...messages, sent];
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
  const [messagesInitialLoad, setMessagesInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialLoadRef = useRef(true);
  const lastSeenMessageIdRef = useRef<number | null>(null);

  const scrollToBottom = useCallback((force = false) => {
    if (!force && !pinnedToBottomRef.current) return;

    const anchor = bottomAnchorRef.current;
    if (anchor) {
      anchor.scrollIntoView({ block: "end" });
      return;
    }

    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

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

  const refreshMessages = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!status?.connected) return;
      const silent = opts?.silent ?? !isInitialLoadRef.current;
      if (silent) {
        setRefreshing(true);
      }
      try {
        const data = await telegramMessages(80);
        const nextId = lastMessageId(data.messages);

        setMessages(data.messages);
        lastSeenMessageIdRef.current = nextId;
      } catch (err) {
        setToast(String(err), "error");
      } finally {
        isInitialLoadRef.current = false;
        setMessagesInitialLoad(false);
        if (silent) {
          setRefreshing(false);
        }
      }
    },
    [setToast, status?.connected],
  );

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, [refreshStatus]);

  useEffect(() => {
    getHermesFolder()
      .then((folder) => setDriveFolderLink(folder.folder_link))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!status?.connected) return;
    isInitialLoadRef.current = true;
    setMessagesInitialLoad(true);
    lastSeenMessageIdRef.current = null;
    pinnedToBottomRef.current = true;
    setPinnedToBottom(true);
    refreshMessages({ silent: false }).catch(() => undefined);
  }, [status?.connected, refreshMessages]);

  useEffect(() => {
    if (!status?.connected) return;
    const id = window.setInterval(() => {
      refreshMessages({ silent: true }).catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshMessages, status?.connected]);

  const showAwaitingReply = awaitingReply(messages);

  useLayoutEffect(() => {
    if (messagesInitialLoad) return;
    if (pinnedToBottomRef.current) {
      scrollToBottom(false);
    }
  }, [messages, showAwaitingReply, messagesInitialLoad, scrollToBottom]);

  function handleScroll() {
    const el = messagesScrollRef.current;
    if (!el) return;
    const nearBottom = isNearBottom(el);
    pinnedToBottomRef.current = nearBottom;
    setPinnedToBottom(nearBottom);
  }

  async function send() {
    const text = input.trim();
    const file = pendingFile;
    if ((!text && !file) || sending || !status?.connected) return;
    setInput("");
    setPendingFile(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSending(true);
    pinnedToBottomRef.current = true;
    setPinnedToBottom(true);
    try {
      const sent = await telegramSend(text, file ?? undefined);
      setMessages((prev) => {
        const next = mergeSentMessage(prev, sent);
        lastSeenMessageIdRef.current = lastMessageId(next);
        return next;
      });
      refreshMessages({ silent: true }).catch(() => undefined);
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setSending(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const maxMb = status?.max_file_size_mb ?? 25;
    const maxBytes = maxMb * 1024 * 1024;
    if (selected.size > maxBytes) {
      setToast(`${selected.name} exceeds ${maxMb} MB limit`, "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPendingFile(selected);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleKey(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      send().catch(() => undefined);
    }
  }

  function adjustHeight(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  }

  if (statusLoading) {
    return (
      <div className="page">
        <div className="loading-center">
          <Spinner size="lg" />
        </div>
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
        height: "calc(100vh - 130px)",
        gap: "var(--sp-3)",
        padding: "var(--sp-4)",
        minHeight: 0,
      }}
    >
      {/* Options bar */}
      <div className="card" style={{ flexShrink: 0 }}>
        <div className="card-body" style={{ padding: "var(--sp-2) var(--sp-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
            <span className="badge success">Connected</span>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-2)", flex: 1, minWidth: 200 }}>
              Chat with {botLabel} — Hermes replies in Telegram
            </span>
            {refreshing ? (
              <span className="badge" title="Syncing messages">
                syncing
              </span>
            ) : null}
            <button
              className="btn-ghost"
              onClick={() => refreshMessages({ silent: true }).catch(() => undefined)}
              disabled={refreshing}
              style={{ marginLeft: "auto" }}
            >
              Refresh
            </button>
            {driveFolderLink ? (
              <a
                href={driveFolderLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost drive-folder-btn"
                title="Open Drive folder"
              >
                📁 Drive
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="card"
        style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}
      >
        <div
          ref={messagesScrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--sp-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-3)",
          }}
        >
          {messagesInitialLoad ? (
            <div className="loading-center">
              <Spinner size="md" />
            </div>
          ) : messages.length === 0 && !showAwaitingReply ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <TelegramIcon size={28} />
              </span>
              <span className="empty-state-title">No messages yet</span>
              <span className="empty-state-desc">
                Send a message below. Replies from {botLabel} appear here after Hermes processes them.
              </span>
            </div>
          ) : (
            <>
              {messages.map((message, i) => (
                <motion.div
                  className="message"
                  key={message.id}
                  initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.01, 0.2), duration: 0.18 }}
                >
                  <div className="message-header">
                    <span className={`role-chip ${roleClass(message.role)}`}>{message.role}</span>
                    {message.timestamp ? (
                      <span className="badge" style={{ marginLeft: "auto" }}>
                        {formatTimestamp(message.timestamp)}
                      </span>
                    ) : null}
                  </div>
                  <div className="message-body">
                    {message.has_media ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--sp-2)",
                          marginBottom: message.content ? "var(--sp-2)" : 0,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{mediaIcon(message.media_type)}</span>
                        <span style={{ fontSize: "var(--text-sm)" }}>
                          {message.file_name || message.media_type || "Attachment"}
                          {message.file_size ? ` · ${formatFileSize(message.file_size)}` : ""}
                        </span>
                        {!message.outgoing ? (
                          <a
                            href={telegramMediaDownloadUrl(message.id)}
                            download={message.file_name || undefined}
                            className="btn-ghost"
                            style={{ padding: "2px 8px", fontSize: "var(--text-xs)" }}
                          >
                            Download
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    {message.content ? <pre>{message.content}</pre> : null}
                  </div>
                </motion.div>
              ))}

              {showAwaitingReply ? (
                <motion.div
                  className="message"
                  key="awaiting-reply"
                  initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="message-header">
                    <span className="role-chip assistant">assistant</span>
                    <Spinner size="sm" />
                  </div>
                  <div className="message-body">
                    <span style={{ color: "var(--text-3)", fontSize: "var(--text-sm)" }}>
                      waiting for reply…
                    </span>
                  </div>
                </motion.div>
              ) : null}

              <div ref={bottomAnchorRef} aria-hidden="true" style={{ height: 0, flexShrink: 0 }} />
            </>
          )}
        </div>

        {!pinnedToBottom && messages.length > 0 ? (
          <button
            className="btn-ghost"
            onClick={() => {
              pinnedToBottomRef.current = true;
              setPinnedToBottom(true);
              scrollToBottom(true);
            }}
            title="Scroll to bottom"
            style={{
              position: "absolute",
              right: "var(--sp-3)",
              bottom: "var(--sp-3)",
              borderRadius: "var(--r-full)",
              padding: "6px 10px",
              fontSize: "var(--text-sm)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              background: "var(--surface-2)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            ↓
          </button>
        ) : null}
      </div>

      {/* Input area */}
      <div className="card" style={{ flexShrink: 0 }}>
        <div
          className="card-body"
          style={{ padding: "var(--sp-2) var(--sp-3)", display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}
        >
          {pendingFile ? (
            <div className="chat-attach-bar">
              <div className="chat-attach-item">
                <span>📎</span>
                <span className="chat-attach-name">{pendingFile.name}</span>
                <span className="badge">{formatFileSize(pendingFile.size)}</span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPendingFile(null)}
                  title="Remove attachment"
                  style={{ marginLeft: "auto", padding: "2px 6px" }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-end" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Attach file"
              style={{ flexShrink: 0, padding: "4px 8px", fontSize: 18, lineHeight: 1 }}
            >
              📎
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={adjustHeight}
              onKeyDown={handleKey}
              placeholder={`Message ${botLabel}… (Ctrl+Enter to send)`}
              disabled={sending}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                minHeight: 36,
                maxHeight: 200,
                lineHeight: 1.5,
                fontFamily: "var(--font)",
                fontSize: "var(--text-md)",
                overflowY: "auto",
              }}
            />
            {sending ? (
              <button
                className="primary"
                disabled
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "var(--sp-1)" }}
              >
                <Spinner size="sm" /> Sending
              </button>
            ) : (
              <button
                className="primary"
                onClick={() => send().catch(() => undefined)}
                disabled={!input.trim() && !pendingFile}
                style={{ flexShrink: 0 }}
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", margin: 0, flexShrink: 0 }}>
        Text and attachments (max {status.max_file_size_mb ?? 25} MB) are sent as your Telegram account.
        Bot replies and files refresh every few seconds — use Download on received attachments.
      </p>
    </div>
  );
}
