import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import {
  listSessions,
  sessionMessages,
  type SessionMessage,
  type SessionSummary,
} from "../api/client";
import { MessageList } from "../components/MessageList";
import { SkeletonList, SkeletonListItem } from "../components/Skeleton";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";

type SessionsPageProps = {
  setToast: (message: string, kind?: ToastKind) => void;
};

function formatCost(usd: number) {
  if (usd === 0) return "$0";
  if (usd < 0.001) return "<$0.001";
  return `$${usd.toFixed(3)}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

export function SessionsPage({ setToast }: SessionsPageProps) {
  const prefersReduced = useReducedMotion();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    setLoadingSessions(true);
    listSessions(120)
      .then((result) => setSessions(result.sessions))
      .catch((err: unknown) => setToast(String(err), "error"))
      .finally(() => setLoadingSessions(false));
  }, []);

  async function openSession(session: SessionSummary) {
    setSelected(session);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const result = await sessionMessages(session.id);
      setMessages(result.messages);
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setLoadingMessages(false);
    }
  }

  const motionProps = prefersReduced ? {} : FADE;
  const motionT     = prefersReduced ? { duration: 0 } : { duration: 0.18 };

  return (
    <div className="page split-2">
      {/* ── Left panel: session list ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Sessions
            {!loadingSessions && sessions.length > 0 && (
              <span className="badge" style={{ marginLeft: 6 }}>{sessions.length}</span>
            )}
          </span>
        </div>
        <div className="card-body no-padding" style={{ padding: 8 }}>
          <AnimatePresence mode="wait" initial={false}>
            {loadingSessions ? (
              <motion.div key="skel" {...motionProps} transition={motionT}>
                <SkeletonList count={8} hasBadgeRow />
              </motion.div>
            ) : sessions.length === 0 ? (
              <motion.div key="empty" {...motionProps} transition={motionT}>
                <div className="empty-state">
                  <span className="empty-state-icon">🗂️</span>
                  <span className="empty-state-title">No sessions</span>
                  <span className="empty-state-desc">No recorded sessions found.</span>
                </div>
              </motion.div>
            ) : (
              <motion.div key="list" {...motionProps} transition={motionT}>
                <div className="list">
                  {sessions.map((session, i) => {
                    const isActive = selected?.id === session.id;
                    const date = formatDate(session.started_at);
                    return (
                      <motion.button
                        key={session.id}
                        aria-current={isActive ? "true" : undefined}
                        className={`list-item ${isActive ? "active" : ""}`}
                        onClick={() =>
                          openSession(session).catch((err: unknown) =>
                            setToast(String(err), "error")
                          )
                        }
                        initial={prefersReduced ? {} : { opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.18 }}
                      >
                        <span className="list-item-name">{session.title || session.id}</span>
                        <span className="list-item-meta">
                          {session.model || "unknown model"}
                          {date ? ` · ${date}` : ""}
                        </span>
                        <div className="list-item-row" style={{ marginTop: 2 }}>
                          <span className="badge">{session.message_count ?? 0} msgs</span>
                          <span className="badge">{session.tool_call_count ?? 0} tools</span>
                          <span className="badge">{formatCost(session.estimated_cost_usd ?? 0)}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right panel: message detail ── */}
      <div className="card">
        <div className="card-header">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="card-title">Session Detail</div>
            <div className="card-subtitle" title={selected?.id}>
              {selected?.title || selected?.id || "Select a session"}
            </div>
          </div>
          {selected ? (
            <div className="toolbar">
              <span className="badge success">{selected.model ?? "—"}</span>
            </div>
          ) : null}
        </div>
        <div className="card-body">
          <AnimatePresence mode="wait" initial={false}>
            {loadingMessages ? (
              <motion.div key="skel-msg" {...motionProps} transition={motionT}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <SkeletonListItem key={i} titleWidth="30%" metaWidth="90%" />
                  ))}
                </div>
              </motion.div>
            ) : !selected ? (
              <motion.div key="empty-msg" {...motionProps} transition={motionT}>
                <div className="empty-state">
                  <span className="empty-state-icon">💬</span>
                  <span className="empty-state-title">No session selected</span>
                  <span className="empty-state-desc">
                    Pick a session from the list to view its messages.
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div key={selected.id} {...motionProps} transition={motionT}>
                <MessageList messages={messages} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
