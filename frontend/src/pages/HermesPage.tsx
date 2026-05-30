import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type ChatStreamChunk,
  type HermesAgentSession,
  type HermesCapabilities,
  type HermesChatMessage,
  type HermesJob,
  type HermesRunStatus,
  type HermesSkill,
  type HermesToolset,
  hermesApiCapabilities,
  hermesApiHealth,
  hermesApiHealthDetailed,
  hermesApiModels,
  hermesApiSkills,
  hermesApiToolsets,
  hermesChatStream,
  hermesCreateJob,
  hermesCreateRun,
  hermesCreateSession,
  hermesDeleteJob,
  hermesDeleteSession,
  hermesForkSession,
  hermesGetRun,
  hermesGetSessionMessages,
  hermesListJobs,
  hermesListSessions,
  hermesPauseJob,
  hermesResumeJob,
  hermesRunEventStream,
  hermesRunJob,
  hermesSessionChatStream,
  hermesStopRun,
  type RunStreamEvent,
  type SessionMessage,
} from "../api/client";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";
import {
  clearHermesSessionState,
  readHermesSessionState,
  touchHermesSessionState,
  writeHermesSessionState,
} from "../state/hermesSessionStore";

/* ── Types ──────────────────────────────────────────────── */

type HermesView = "chat" | "runs" | "sessions" | "jobs" | "info";

type LocalMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  toolEvents?: string[];
};

type Props = { setToast: (msg: string, kind?: ToastKind) => void };

/* ── Helpers ─────────────────────────────────────────────── */

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

function uid() {
  return Math.random().toString(36).slice(2);
}

function statusBadge(status: string) {
  if (status === "completed") return "success";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "running" || status === "started") return "warning";
  return "";
}

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function formatTtl(ms: number) {
  if (ms <= 0) return "expired";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/* ═══════════════════════════════════════════════════════════
   CHAT VIEW
   ═══════════════════════════════════════════════════════════ */

function ChatView({ setToast }: Props) {
  const prefersReduced = useReducedMotion();
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionKey, setSessionKey] = useState("");
  const [conversationMode, setConversationMode] = useState<"stateless" | "session">("session");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [showRestoredBadge, setShowRestoredBadge] = useState(false);
  const [ttlRemainingMs, setTtlRemainingMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const persisted = readHermesSessionState();
    const savedKey = localStorage.getItem("uc-hermes-session-key") ?? "";
    setConversationMode(persisted.conversationMode);
    setActiveSessionId(persisted.activeSessionId);
    setActiveRunId(persisted.activeRunId);
    setSessionKey(savedKey || persisted.sessionKey || "");
    setTtlRemainingMs(Math.max(0, persisted.expiresAt - Date.now()));
  }, []);

  useEffect(() => {
    localStorage.setItem("uc-hermes-session-key", sessionKey);
    writeHermesSessionState({ sessionKey });
  }, [sessionKey]);

  useEffect(() => {
    writeHermesSessionState({
      activeSessionId,
      activeRunId,
      conversationMode,
      sessionKey,
    });
    const persisted = readHermesSessionState();
    setTtlRemainingMs(Math.max(0, persisted.expiresAt - Date.now()));
  }, [activeSessionId, activeRunId, conversationMode, sessionKey]);

  useEffect(() => {
    const updateTtl = () => {
      const persisted = readHermesSessionState();
      setTtlRemainingMs(Math.max(0, persisted.expiresAt - Date.now()));
    };
    const id = window.setInterval(updateTtl, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "uc-hermes-session-key" && typeof ev.newValue === "string") {
        setSessionKey(ev.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!activeSessionId || isRestoringRef.current) return;
    isRestoringRef.current = true;
    const restore = async () => {
      try {
        await waitForHermesHealth();
        const sessionData = await hermesGetSessionMessages(activeSessionId, 500);
        const recovered = normalizeSessionMessages(sessionData);
        setMessages(recovered);
        touchHermesSessionState();
        setShowRestoredBadge(true);

        if (!activeRunId) return;
        const run = await hermesGetRun(activeRunId);
        if (run.status === "started" || run.status === "running" || run.status === "stopping") {
          const assistantId = appendStreamingPlaceholder();
          await streamRun(activeRunId, assistantId);
        } else {
          setActiveRunId(null);
          writeHermesSessionState({ activeRunId: null });
        }
      } catch (err) {
        setToast(String(err), "error");
      } finally {
        isRestoringRef.current = false;
      }
    };
    restore().catch(() => undefined);
  }, [activeSessionId, activeRunId, setToast]);

  useEffect(() => {
    if (!showRestoredBadge) return;
    const id = window.setTimeout(() => setShowRestoredBadge(false), 8000);
    return () => window.clearTimeout(id);
  }, [showRestoredBadge]);

  async function waitForHermesHealth() {
    const delays = [0, 500, 1000, 2000, 3000];
    let lastError: unknown;
    for (const ms of delays) {
      if (ms) await new Promise((resolve) => setTimeout(resolve, ms));
      try {
        await hermesApiHealth();
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new Error("Hermes API is unavailable");
  }

  useEffect(() => {
    return () => {
      // Detach from stream when leaving page. The run keeps executing server-side.
      abortRef.current?.abort();
    };
  }, []);

  function stop() {
    abortRef.current?.abort();
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let sessionId = activeSessionId;
    if (!sessionId) {
      const created = await hermesCreateSession();
      sessionId = (created as HermesAgentSession).id;
      setActiveSessionId(sessionId);
      setConversationMode("session");
    }

    const userMsg: LocalMsg = { id: uid(), role: "user", content: text };
    const assistantId = uid();
    const assistantMsg: LocalMsg = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
      toolEvents: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (conversationMode === "stateless") {
        const history: HermesChatMessage[] = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: text },
        ];
        for await (const chunk of hermesChatStream(history, controller.signal, sessionKey || undefined)) {
          applyChunk(assistantId, chunk);
          touchHermesSessionState();
        }
      } else if (sessionId) {
        const run = await hermesCreateRun({ input: text, session_id: sessionId }, sessionKey || undefined);
        const runId = run.run_id;
        setActiveRunId(runId);
        writeHermesSessionState({ activeSessionId: sessionId, activeRunId: runId, conversationMode: "session" });
        await streamRun(runId, assistantId);
        const sessionData = await hermesGetSessionMessages(sessionId, 500);
        setMessages(normalizeSessionMessages(sessionData));
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setToast(String(err), "error");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content || "(error)", streaming: false } : m,
          ),
        );
      }
    } finally {
      setActiveRunId(null);
      writeHermesSessionState({ activeRunId: null });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
      );
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function applyChunk(assistantId: string, chunk: ChatStreamChunk) {
    if (chunk.kind === "text") {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk.text } : m)),
      );
    } else if (chunk.kind === "tool_progress") {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, toolEvents: [...(m.toolEvents ?? []), chunk.content] }
            : m,
        ),
      );
    }
  }

  function appendStreamingPlaceholder() {
    const assistantId = uid();
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.streaming) return prev;
      return [
        ...prev,
        { id: assistantId, role: "assistant", content: "", streaming: true, toolEvents: [] },
      ];
    });
    return assistantId;
  }

  async function streamRun(runId: string, assistantId: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    try {
      for await (const ev of hermesRunEventStream(runId, controller.signal)) {
        if (ev.kind === "token") {
          applyChunk(assistantId, { kind: "text", text: ev.text });
        } else if (ev.kind === "tool") {
          applyChunk(assistantId, { kind: "tool_progress", content: ev.content });
        } else if (ev.kind === "error") {
          throw new Error(ev.message);
        }
        touchHermesSessionState();
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function normalizeSessionMessages(payload: unknown): LocalMsg[] {
    const raw = (Array.isArray(payload)
      ? payload
      : (payload as { messages?: SessionMessage[] }).messages) ?? [];
    return raw.map((m) => ({
      id: String(m.id),
      role:
        m.role === "assistant" || m.role === "system"
          ? m.role
          : "user",
      content: m.content_text ?? m.content ?? "",
      streaming: false,
      toolEvents: m.tool_calls ? [m.tool_calls] : [],
    }));
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send().catch(() => undefined);
    }
  }

  function adjustHeight(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  }

  async function createAndAttachSession() {
    try {
      const s = await hermesCreateSession();
      const id = (s as HermesAgentSession).id;
      setActiveSessionId(id);
      setConversationMode("session");
      writeHermesSessionState({ activeSessionId: id, conversationMode: "session" });
      setToast(`Session created: ${id.slice(0, 8)}…`, "success");
    } catch (err) {
      setToast(String(err), "error");
    }
  }

  async function reconnectRun() {
    if (!activeRunId || !activeSessionId || streaming) return;
    try {
      await waitForHermesHealth();
      const run = await hermesGetRun(activeRunId);
      if (!(run.status === "started" || run.status === "running" || run.status === "stopping")) {
        setActiveRunId(null);
        writeHermesSessionState({ activeRunId: null });
        setToast("No active run to reconnect.", "info");
        return;
      }
      const assistantId = appendStreamingPlaceholder();
      await streamRun(activeRunId, assistantId);
      const sessionData = await hermesGetSessionMessages(activeSessionId, 500);
      setMessages(normalizeSessionMessages(sessionData));
      setToast("Run stream reconnected.", "success");
    } catch (err) {
      setToast(String(err), "error");
    }
  }

  function clearChat() {
    setMessages([]);
    setActiveRunId(null);
    setActiveSessionId(null);
    setConversationMode("stateless");
    clearHermesSessionState();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 130px)",
        gap: "var(--sp-3)",
      }}
    >
      {/* Options bar */}
      <div className="card" style={{ flexShrink: 0 }}>
        <div className="card-body" style={{ padding: "var(--sp-2) var(--sp-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
            <div className="btn-group">
              <button
                className={conversationMode === "stateless" ? "active" : ""}
                onClick={() => setConversationMode("stateless")}
              >
                Stateless
              </button>
              <button
                className={conversationMode === "session" ? "active" : ""}
                onClick={() => {
                  if (!activeSessionId) createAndAttachSession().catch(() => undefined);
                  else setConversationMode("session");
                }}
              >
                Session
              </button>
            </div>

            {activeSessionId && (
              <span className="badge success" title={activeSessionId}>
                session {activeSessionId.slice(0, 8)}…
              </span>
            )}

            {showRestoredBadge && (
              <span className="badge warning" title="Recovered from local persisted session">
                restored
              </span>
            )}

            {ttlRemainingMs !== null && activeSessionId && (
              <span className="badge" title="Local persistence TTL">
                ttl {formatTtl(ttlRemainingMs)}
              </span>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                Session key
              </label>
              <input
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
                placeholder="X-Hermes-Session-Key (optional)"
                style={{ height: 28, fontSize: "var(--text-sm)" }}
              />
            </div>

            {activeRunId && !streaming && (
              <button onClick={() => reconnectRun().catch(() => undefined)}>
                Reconnect run
              </button>
            )}

            <button onClick={clearChat} className="btn-ghost" style={{ marginLeft: "auto" }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="card" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--sp-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-3)",
          }}
        >
          {messages.length === 0 && (
            <div className="empty-state">
              <span className="empty-state-icon">💬</span>
              <span className="empty-state-title">Start a conversation</span>
              <span className="empty-state-desc">
                Type a message below and press Ctrl+Enter or click Send.
              </span>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              className="message"
              initial={prefersReduced ? {} : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.01, 0.2), duration: 0.18 }}
            >
              <div className="message-header">
                <span className={`role-chip ${msg.role}`}>{msg.role}</span>
                {msg.streaming && <Spinner size="sm" />}
              </div>
              <div className="message-body">
                {msg.content && <pre>{msg.content}</pre>}
                {msg.streaming && !msg.content && (
                  <span style={{ color: "var(--text-3)", fontSize: "var(--text-sm)" }}>
                    thinking…
                  </span>
                )}
                {(msg.toolEvents?.length ?? 0) > 0 && (
                  <details style={{ marginTop: "var(--sp-2)" }}>
                    <summary>Tool activity ({msg.toolEvents!.length})</summary>
                    {msg.toolEvents!.map((ev, j) => (
                      <pre key={j} style={{ marginTop: "var(--sp-1)", fontSize: 11 }}>
                        {ev}
                      </pre>
                    ))}
                  </details>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="card" style={{ flexShrink: 0 }}>
        <div className="card-body" style={{ padding: "var(--sp-2) var(--sp-3)", display: "flex", gap: "var(--sp-2)", alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={adjustHeight}
            onKeyDown={handleKey}
            placeholder="Message Hermes… (Ctrl+Enter to send)"
            disabled={streaming}
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
          {streaming ? (
            <button className="danger" onClick={stop} style={{ flexShrink: 0 }}>
              Stop
            </button>
          ) : (
            <button
              className="primary"
              onClick={() => send().catch(() => undefined)}
              disabled={!input.trim()}
              style={{ flexShrink: 0 }}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RUNS VIEW
   ═══════════════════════════════════════════════════════════ */

type RunEntry = {
  runId: string;
  input: string;
  status: HermesRunStatus["status"] | "pending";
  events: string[];
  output?: string;
};

function RunsView({ setToast }: Props) {
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [instructions, setInstructions] = useState("");
  const [launching, setLaunching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeRun = runs.find((r) => r.runId === selected);

  async function createRun() {
    if (!input.trim() || launching) return;
    setLaunching(true);
    try {
      const res = await hermesCreateRun({
        input: input.trim(),
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      }, localStorage.getItem("uc-hermes-session-key") || undefined);
      const { run_id } = res as { run_id: string };
      const entry: RunEntry = { runId: run_id, input: input.trim(), status: "started", events: [] };
      setRuns((prev) => [entry, ...prev]);
      setSelected(run_id);
      setInput("");
      streamRunEvents(run_id);
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setLaunching(false);
    }
  }

  function streamRunEvents(runId: string) {
    const controller = new AbortController();
    abortRef.current = controller;

    const go = async () => {
      try {
        for await (const ev of hermesRunEventStream(runId, controller.signal)) {
          handleRunEvent(runId, ev);
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setToast(String(err), "error");
        }
      }
    };
    go().catch(() => undefined);
  }

  function handleRunEvent(runId: string, ev: RunStreamEvent) {
    setRuns((prev) =>
      prev.map((r) => {
        if (r.runId !== runId) return r;
        if (ev.kind === "done") return { ...r, status: "completed", output: ev.output ?? r.output };
        if (ev.kind === "error") return { ...r, status: "failed", events: [...r.events, `ERROR: ${ev.message}`] };
        if (ev.kind === "token") return { ...r, output: (r.output ?? "") + ev.text };
        if (ev.kind === "status") return { ...r, status: ev.status as RunEntry["status"] };
        if (ev.kind === "tool") return { ...r, events: [...r.events, `[tool] ${ev.content}`] };
        return r;
      }),
    );
  }

  async function pollStatus(runId: string) {
    try {
      const s = await hermesGetRun(runId);
      setRuns((prev) =>
        prev.map((r) =>
          r.runId === runId
            ? { ...r, status: s.status, output: s.output ?? r.output }
            : r,
        ),
      );
    } catch (err) {
      setToast(String(err), "error");
    }
  }

  async function stopRun(runId: string) {
    try {
      abortRef.current?.abort();
      await hermesStopRun(runId);
      setRuns((prev) =>
        prev.map((r) => (r.runId === runId ? { ...r, status: "stopping" as RunEntry["status"] } : r)),
      );
    } catch (err) {
      setToast(String(err), "error");
    }
  }

  return (
    <div className="page split-2" style={{ paddingTop: 0, alignItems: "start" }}>
      {/* Left: runs list + create */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">New Run</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Prompt for Hermes…"
              rows={3}
              style={{ resize: "vertical", fontFamily: "var(--font)", fontSize: "var(--text-md)" }}
            />
            <input
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="System instructions (optional)"
            />
            <button
              className="primary"
              onClick={() => createRun().catch(() => undefined)}
              disabled={!input.trim() || launching}
            >
              {launching ? <Spinner size="sm" /> : null}
              {launching ? "Creating…" : "Create Run"}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              Runs{" "}
              {runs.length > 0 && <span className="badge" style={{ marginLeft: 6 }}>{runs.length}</span>}
            </span>
          </div>
          <div className="card-body no-padding" style={{ padding: 8 }}>
            {runs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">⚡</span>
                <span className="empty-state-title">No runs yet</span>
              </div>
            ) : (
              <div className="list">
                {runs.map((r) => (
                  <button
                    key={r.runId}
                    className={`list-item ${selected === r.runId ? "active" : ""}`}
                    onClick={() => setSelected(r.runId)}
                  >
                    <span className="list-item-name truncate">{r.input}</span>
                    <div className="list-item-row" style={{ marginTop: 2 }}>
                      <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span>
                      <span className="badge">{r.runId.slice(0, 8)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: run detail */}
      <div className="card" style={{ minHeight: 400 }}>
        <div className="card-header">
          <div style={{ flex: 1 }}>
            <div className="card-title">Run Detail</div>
            {activeRun && (
              <div className="card-subtitle">{activeRun.runId}</div>
            )}
          </div>
          {activeRun && (
            <div className="toolbar">
              <span className={`badge ${statusBadge(activeRun.status)}`}>{activeRun.status}</span>
              {(activeRun.status === "running" || activeRun.status === "started") && (
                <button className="danger" onClick={() => stopRun(activeRun.runId).catch(() => undefined)}>
                  Stop
                </button>
              )}
              <button onClick={() => pollStatus(activeRun.runId).catch(() => undefined)}>
                Refresh
              </button>
            </div>
          )}
        </div>
        <div className="card-body">
          {!activeRun ? (
            <div className="empty-state">
              <span className="empty-state-icon">⚡</span>
              <span className="empty-state-title">Select a run</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {activeRun.output && (
                <div>
                  <div className="section-label">Output</div>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
                    {activeRun.output}
                  </pre>
                </div>
              )}
              {activeRun.events.length > 0 && (
                <details>
                  <summary style={{ fontSize: "var(--text-sm)", color: "var(--text-3)", cursor: "pointer" }}>
                    Tool activity ({activeRun.events.length})
                  </summary>
                  <div style={{ marginTop: "var(--sp-2)", display: "flex", flexDirection: "column", gap: 4 }}>
                    {activeRun.events.map((ev, i) => (
                      <pre key={i} style={{ fontSize: 11, color: "var(--warning)" }}>{ev}</pre>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SESSIONS VIEW (Hermes live sessions)
   ═══════════════════════════════════════════════════════════ */

function HermesSessionsView({ setToast }: Props) {
  const prefersReduced = useReducedMotion();
  const [sessions, setSessions] = useState<HermesAgentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<HermesAgentSession | null>(null);
  const [msgs, setMsgs] = useState<SessionMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hermesListSessions({ limit: 100 });
      const arr = Array.isArray(data) ? data : (data as { sessions?: HermesAgentSession[] }).sessions ?? [];
      setSessions(arr);
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  }, [setToast]);

  useEffect(() => { fetchSessions().catch(() => undefined); }, [fetchSessions]);

  async function selectSession(s: HermesAgentSession) {
    setSelected(s);
    setLoadingMsgs(true);
    setMsgs([]);
    try {
      const res = await hermesGetSessionMessages(s.id);
      const arr = Array.isArray(res) ? res : (res as { messages?: SessionMessage[] }).messages ?? [];
      setMsgs(arr);
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function sendChat() {
    if (!selected || !chatInput.trim() || chatting) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatting(true);
    const msgId = uid();
    const userEntry: SessionMessage = { id: Date.now(), role: "user", content: text };
    const assistantEntry: SessionMessage = { id: Date.now() + 1, role: "assistant", content: "" };
    setMsgs((prev) => [...prev, userEntry, assistantEntry]);
    setStreamingMsgId(msgId);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      for await (const chunk of hermesSessionChatStream(selected.id, text, controller.signal)) {
        if (chunk.kind === "text") {
          setMsgs((prev) =>
            prev.map((m) =>
              m.id === assistantEntry.id ? { ...m, content: m.content + chunk.text } : m,
            ),
          );
        }
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) setToast(String(err), "error");
    } finally {
      setChatting(false);
      setStreamingMsgId(null);
      abortRef.current = null;
    }
  }

  async function newSession() {
    try {
      const s = await hermesCreateSession();
      setSessions((prev) => [s as HermesAgentSession, ...prev]);
      setToast("Session created", "success");
    } catch (err) {
      setToast(String(err), "error");
    }
  }

  async function deleteSession(s: HermesAgentSession) {
    try {
      await hermesDeleteSession(s.id);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
      if (selected?.id === s.id) { setSelected(null); setMsgs([]); }
      setToast("Session deleted", "success");
    } catch (err) {
      setToast(String(err), "error");
    }
  }

  async function forkSession(s: HermesAgentSession) {
    try {
      const fork = await hermesForkSession(s.id, { title: `Fork of ${s.title ?? s.id}` });
      setSessions((prev) => [fork as HermesAgentSession, ...prev]);
      setToast("Session forked", "success");
    } catch (err) {
      setToast(String(err), "error");
    }
  }

  const motionProps = prefersReduced ? {} : FADE;
  const motionT = prefersReduced ? { duration: 0 } : { duration: 0.18 };

  return (
    <div className="page split-2" style={{ paddingTop: 0 }}>
      {/* Left: session list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Sessions{" "}
            {!loading && sessions.length > 0 && (
              <span className="badge" style={{ marginLeft: 6 }}>{sessions.length}</span>
            )}
          </span>
          <div className="toolbar">
            <button onClick={() => fetchSessions().catch(() => undefined)}>Refresh</button>
            <button className="primary" onClick={() => newSession().catch(() => undefined)}>
              + New
            </button>
          </div>
        </div>
        <div className="card-body no-padding" style={{ padding: 8 }}>
          <AnimatePresence mode="wait" initial={false}>
            {loading ? (
              <motion.div key="load" {...motionProps} transition={motionT}>
                <div className="loading-center"><Spinner size="md" /></div>
              </motion.div>
            ) : sessions.length === 0 ? (
              <motion.div key="empty" {...motionProps} transition={motionT}>
                <div className="empty-state">
                  <span className="empty-state-icon">🗂️</span>
                  <span className="empty-state-title">No sessions</span>
                </div>
              </motion.div>
            ) : (
              <motion.div key="list" {...motionProps} transition={motionT}>
                <div className="list">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      className={`list-item ${selected?.id === s.id ? "active" : ""}`}
                      onClick={() => selectSession(s).catch(() => undefined)}
                    >
                      <span className="list-item-name">{s.title ?? s.id}</span>
                      <span className="list-item-meta">
                        {s.model ?? s.source ?? "—"}
                        {s.started_at ? ` · ${fmtDate(s.started_at)}` : ""}
                      </span>
                      {s.end_reason && (
                        <div className="list-item-row" style={{ marginTop: 2 }}>
                          <span className="badge">{s.end_reason}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: session detail + chat */}
      <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 400 }}>
        <div className="card-header">
          <div style={{ flex: 1 }}>
            <div className="card-title">{selected?.title ?? "Session Detail"}</div>
            {selected && <div className="card-subtitle">{selected.id}</div>}
          </div>
          {selected && (
            <div className="toolbar">
              <button onClick={() => forkSession(selected).catch(() => undefined)}>Fork</button>
              <button className="danger" onClick={() => deleteSession(selected).catch(() => undefined)}>
                Delete
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "var(--sp-3)", display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {!selected ? (
            <div className="empty-state">
              <span className="empty-state-icon">💬</span>
              <span className="empty-state-title">Select a session</span>
            </div>
          ) : loadingMsgs ? (
            <div className="loading-center"><Spinner size="md" /></div>
          ) : msgs.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">💬</span>
              <span className="empty-state-title">No messages yet</span>
            </div>
          ) : (
            msgs.map((m) => (
              <div key={m.id} className="message">
                <div className="message-header">
                  <span className={`role-chip ${m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : m.role === "tool" ? "tool" : "system"}`}>
                    {m.role}
                  </span>
                  {m.tool_name && <span className="badge warning">{m.tool_name}</span>}
                  {m.id === (streamingMsgId ? msgs[msgs.length - 1]?.id : null) && chatting && (
                    <Spinner size="sm" />
                  )}
                </div>
                <div className="message-body">
                  <pre>{m.content_text ?? m.content ?? ""}</pre>
                </div>
              </div>
            ))
          )}
        </div>

        {selected && (
          <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "var(--sp-2) var(--sp-3)", display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  sendChat().catch(() => undefined);
                }
              }}
              placeholder="Message session… (Ctrl+Enter)"
              disabled={chatting}
              style={{ flex: 1 }}
            />
            {chatting ? (
              <button className="danger" onClick={() => abortRef.current?.abort()}>Stop</button>
            ) : (
              <button
                className="primary"
                onClick={() => sendChat().catch(() => undefined)}
                disabled={!chatInput.trim()}
              >
                Send
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   JOBS VIEW
   ═══════════════════════════════════════════════════════════ */

function JobsView({ setToast }: Props) {
  const [jobs, setJobs] = useState<HermesJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<HermesJob | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [newSchedule, setNewSchedule] = useState("");

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hermesListJobs();
      const arr = Array.isArray(data) ? data : (data as { jobs?: HermesJob[] }).jobs ?? [];
      setJobs(arr);
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  }, [setToast]);

  useEffect(() => { fetchJobs().catch(() => undefined); }, [fetchJobs]);

  async function createJob() {
    if (!newPrompt.trim()) return;
    setCreating(true);
    try {
      const job = await hermesCreateJob({
        prompt: newPrompt.trim(),
        ...(newSchedule.trim() ? { schedule: newSchedule.trim() } : {}),
      });
      setJobs((prev) => [job as HermesJob, ...prev]);
      setNewPrompt("");
      setNewSchedule("");
      setToast("Job created", "success");
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setCreating(false);
    }
  }

  async function action(jobId: string, fn: () => Promise<unknown>, label: string) {
    try {
      await fn();
      setToast(`${label} OK`, "success");
      fetchJobs().catch(() => undefined);
    } catch (err) {
      setToast(String(err), "error");
    }
  }

  return (
    <div className="page split-2" style={{ paddingTop: 0 }}>
      {/* Left */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        {/* Create job */}
        <div className="card">
          <div className="card-header"><span className="card-title">Schedule Job</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Job prompt…"
              rows={3}
              style={{ resize: "vertical", fontFamily: "var(--font)", fontSize: "var(--text-md)" }}
            />
            <input
              value={newSchedule}
              onChange={(e) => setNewSchedule(e.target.value)}
              placeholder='Schedule (cron or "daily", optional)'
            />
            <button
              className="primary"
              onClick={() => createJob().catch(() => undefined)}
              disabled={!newPrompt.trim() || creating}
            >
              {creating ? <Spinner size="sm" /> : null}
              {creating ? "Creating…" : "Create Job"}
            </button>
          </div>
        </div>

        {/* Job list */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              Jobs{" "}
              {!loading && jobs.length > 0 && <span className="badge" style={{ marginLeft: 6 }}>{jobs.length}</span>}
            </span>
            <button onClick={() => fetchJobs().catch(() => undefined)}>Refresh</button>
          </div>
          <div className="card-body no-padding" style={{ padding: 8 }}>
            {loading ? (
              <div className="loading-center"><Spinner size="md" /></div>
            ) : jobs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📅</span>
                <span className="empty-state-title">No jobs</span>
              </div>
            ) : (
              <div className="list">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    className={`list-item ${selected?.id === job.id ? "active" : ""}`}
                    onClick={() => setSelected(job)}
                  >
                    <span className="list-item-name truncate">{job.prompt}</span>
                    <div className="list-item-row" style={{ marginTop: 2 }}>
                      {job.status && <span className={`badge ${statusBadge(job.status)}`}>{String(job.status)}</span>}
                      {job.schedule && <span className="badge">{String(job.schedule)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: job detail */}
      <div className="card">
        <div className="card-header">
          <div style={{ flex: 1 }}>
            <div className="card-title">Job Detail</div>
            {selected && <div className="card-subtitle">{selected.id}</div>}
          </div>
        </div>
        <div className="card-body">
          {!selected ? (
            <div className="empty-state">
              <span className="empty-state-icon">📅</span>
              <span className="empty-state-title">Select a job</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
              {/* Meta */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>Prompt</div>
                <pre style={{ fontSize: 12.5, whiteSpace: "pre-wrap", color: "var(--text-2)" }}>{selected.prompt}</pre>
                {selected.schedule && (
                  <div>
                    <span className="badge">{String(selected.schedule)}</span>
                  </div>
                )}
                {selected.last_run && (
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>
                    Last run: {fmtDate(selected.last_run)}
                  </div>
                )}
                {selected.next_run && (
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>
                    Next run: {fmtDate(selected.next_run)}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="toolbar" style={{ flexWrap: "wrap" }}>
                <button
                  className="primary"
                  onClick={() => action(selected.id, () => hermesRunJob(selected.id), "Triggered").catch(() => undefined)}
                >
                  Run now
                </button>
                <button
                  onClick={() => action(selected.id, () => hermesPauseJob(selected.id), "Paused").catch(() => undefined)}
                >
                  Pause
                </button>
                <button
                  onClick={() => action(selected.id, () => hermesResumeJob(selected.id), "Resumed").catch(() => undefined)}
                >
                  Resume
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    action(selected.id, async () => {
                      await hermesDeleteJob(selected.id);
                      setJobs((prev) => prev.filter((j) => j.id !== selected.id));
                      setSelected(null);
                    }, "Deleted").catch(() => undefined)
                  }
                >
                  Delete
                </button>
              </div>

              {/* Raw JSON */}
              <details>
                <summary style={{ fontSize: "var(--text-sm)", color: "var(--text-3)", cursor: "pointer" }}>
                  Raw data
                </summary>
                <pre style={{ marginTop: "var(--sp-2)", fontSize: 11, whiteSpace: "pre-wrap", color: "var(--text-3)" }}>
                  {JSON.stringify(selected, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INFO VIEW  (health · models · capabilities · skills · toolsets)
   ═══════════════════════════════════════════════════════════ */

function InfoView({ setToast }: Props) {
  const [health, setHealth] = useState<{ status: string } | null>(null);
  const [healthDetail, setHealthDetail] = useState<Record<string, unknown> | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [caps, setCaps] = useState<HermesCapabilities | null>(null);
  const [skills, setSkills] = useState<HermesSkill[]>([]);
  const [toolsets, setToolsets] = useState<HermesToolset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetches = [
      hermesApiHealth().then(setHealth).catch(() => undefined),
      hermesApiHealthDetailed()
        .then((d) => setHealthDetail(d as Record<string, unknown>))
        .catch(() => undefined),
      hermesApiModels()
        .then((d) => setModels(d.data?.map((m) => m.id) ?? []))
        .catch(() => undefined),
      hermesApiCapabilities().then(setCaps).catch(() => undefined),
      hermesApiSkills()
        .then((d) => setSkills(Array.isArray(d) ? d : []))
        .catch(() => undefined),
      hermesApiToolsets()
        .then((d) => setToolsets(Array.isArray(d) ? d : []))
        .catch(() => undefined),
    ];
    Promise.allSettled(fetches).finally(() => setLoading(false));
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const [h, hd, m, c, sk, ts] = await Promise.allSettled([
        hermesApiHealth(),
        hermesApiHealthDetailed(),
        hermesApiModels(),
        hermesApiCapabilities(),
        hermesApiSkills(),
        hermesApiToolsets(),
      ]);
      if (h.status === "fulfilled") setHealth(h.value);
      if (hd.status === "fulfilled") setHealthDetail(hd.value as Record<string, unknown>);
      if (m.status === "fulfilled") setModels(m.value.data?.map((x) => x.id) ?? []);
      if (c.status === "fulfilled") setCaps(c.value);
      if (sk.status === "fulfilled") setSkills(Array.isArray(sk.value) ? sk.value : []);
      if (ts.status === "fulfilled") setToolsets(Array.isArray(ts.value) ? ts.value : []);
    } catch (err) {
      setToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "var(--sp-4)",
        alignContent: "start",
      }}
    >
      {/* Health */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Health</span>
          <button onClick={() => refresh().catch(() => undefined)}>Refresh</button>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: health?.status === "ok" ? "var(--success)" : "var(--danger)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 500 }}>
              {health ? health.status : "unreachable"}
            </span>
          </div>
          {healthDetail && (
            <details>
              <summary style={{ fontSize: "var(--text-sm)", color: "var(--text-3)", cursor: "pointer" }}>
                Detailed health
              </summary>
              <pre style={{ marginTop: "var(--sp-2)", fontSize: 11, whiteSpace: "pre-wrap", color: "var(--text-3)" }}>
                {JSON.stringify(healthDetail, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>

      {/* Models */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Models</span>
        </div>
        <div className="card-body">
          {models.length === 0 ? (
            <span style={{ color: "var(--text-3)", fontSize: "var(--text-sm)" }}>None</span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
              {models.map((m) => (
                <span key={m} className="badge success">{m}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Capabilities */}
      {caps && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Capabilities</span>
            <span className="badge">{caps.platform}</span>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(caps.features ?? {}).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                  <span style={{ color: "var(--text-2)" }}>{k.replace(/_/g, " ")}</span>
                  <span className={`badge ${v ? "success" : ""}`}>{v ? "yes" : "no"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skills */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Skills</span>
          {skills.length > 0 && <span className="badge">{skills.length}</span>}
        </div>
        <div className="card-body" style={{ maxHeight: 280, overflowY: "auto" }}>
          {skills.length === 0 ? (
            <span style={{ color: "var(--text-3)", fontSize: "var(--text-sm)" }}>None</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              {skills.map((s) => (
                <div key={s.name}>
                  <div style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>{s.name}</div>
                  {s.description && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginTop: 2 }}>
                      {s.description}
                    </div>
                  )}
                  {s.category && <span className="badge" style={{ marginTop: 2 }}>{String(s.category)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toolsets */}
      <div className="card" style={{ gridColumn: "span 2" }}>
        <div className="card-header">
          <span className="card-title">Toolsets</span>
          {toolsets.length > 0 && <span className="badge">{toolsets.length}</span>}
        </div>
        <div className="card-body" style={{ maxHeight: 360, overflowY: "auto" }}>
          {toolsets.length === 0 ? (
            <span style={{ color: "var(--text-3)", fontSize: "var(--text-sm)" }}>None</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {toolsets.map((ts) => (
                <div key={ts.name}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>{ts.label ?? ts.name}</span>
                    <span className={`badge ${ts.enabled ? "success" : ""}`}>{ts.enabled ? "enabled" : "disabled"}</span>
                    {!ts.configured && <span className="badge danger">not configured</span>}
                  </div>
                  {ts.description && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: 4 }}>
                      {ts.description}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {ts.tools.map((t) => (
                      <span key={t} className="badge" style={{ fontSize: 10 }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

const VIEWS: Array<{ id: HermesView; label: string }> = [
  { id: "chat", label: "Chat" },
  { id: "runs", label: "Runs" },
  { id: "sessions", label: "Sessions" },
  { id: "jobs", label: "Jobs" },
  { id: "info", label: "Info" },
];

export function HermesPage({ setToast }: Props) {
  const prefersReduced = useReducedMotion();
  const [view, setView] = useState<HermesView>("chat");

  const pageVariants = prefersReduced
    ? undefined
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };
  const pageTransition = prefersReduced ? { duration: 0 } : { duration: 0.18, ease: [0, 0, 0.2, 1] };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "var(--sp-4)", gap: "var(--sp-3)", minHeight: 0 }}>
      {/* Inner tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexShrink: 0 }}>
        <div className="btn-group">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={view === v.id ? "active" : ""}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span
          style={{
            marginLeft: "var(--sp-3)",
            fontSize: "var(--text-xs)",
            color: "var(--text-3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          hermes:8642
        </span>
      </div>

      {/* View content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          variants={pageVariants}
          initial={prefersReduced ? false : "initial"}
          animate={prefersReduced ? undefined : "animate"}
          exit={prefersReduced ? undefined : "exit"}
          transition={pageTransition}
          style={{ flex: 1, minHeight: 0 }}
        >
          {view === "chat" && <ChatView setToast={setToast} />}
          {view === "runs" && <RunsView setToast={setToast} />}
          {view === "sessions" && <HermesSessionsView setToast={setToast} />}
          {view === "jobs" && <JobsView setToast={setToast} />}
          {view === "info" && <InfoView setToast={setToast} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
