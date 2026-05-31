import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  kanbanSummary,
  kanbanBoards,
  kanbanBoardDetail,
  kanbanAgents,
  kanbanActivity,
  type KanbanSummary,
  type KanbanBoard,
  type KanbanBoardDetail,
  type KanbanAgent,
  type KanbanActivityEvent,
} from "../api/client";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";

/* ── Types ──────────────────────────────────────────────── */

type ActivityTabId = "boards" | "agents" | "activity";
type Props = { setToast: (msg: string, kind?: ToastKind) => void };

/* ── Status color mapping ────────────────────────────────── */

const STATUS_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  todo:     { bg: "var(--surface-3)",  text: "var(--text-2)",  bar: "var(--text-3)" },
  ready:    { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", bar: "#3b82f6" },
  running:  { bg: "var(--warning-sub)", text: "var(--warning)", bar: "var(--warning)" },
  done:     { bg: "var(--success-sub)", text: "var(--success)", bar: "var(--success)" },
  blocked:  { bg: "var(--danger-sub)",  text: "var(--danger)",  bar: "var(--danger)" },
  triage:   { bg: "var(--surface-3)",  text: "var(--text-3)",  bar: "var(--text-3)" },
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? STATUS_COLORS.todo;
}

/* ── Helpers ─────────────────────────────────────────────── */

function fmtDate(ts: number) {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function fmtRelative(ts: number) {
  if (!ts) return "—";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

/* ═══════════════════════════════════════════════════════════
   SUMMARY CARDS
   ═══════════════════════════════════════════════════════════ */

function SummaryCards({ summary }: { summary: KanbanSummary }) {
  const cards = [
    { label: "Total Tasks",  value: summary.total_tasks,    icon: "📋" },
    { label: "Completed",    value: summary.tasks_by_status.done, icon: "✅" },
    { label: "In Progress",  value: summary.tasks_by_status.running, icon: "🔄" },
    { label: "Blocked",      value: summary.tasks_by_status.blocked, icon: "🚫" },
    { label: "Active Agents",value: summary.active_agents,  icon: "🤖" },
  ];

  const pct = summary.total_tasks > 0
    ? Math.round((summary.tasks_by_status.done / summary.total_tasks) * 100)
    : 0;

  return (
    <div className="card" style={{ flexShrink: 0 }}>
      <div className="card-body" style={{ padding: "var(--sp-3) var(--sp-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--sp-3)" }}>
          {cards.map((c) => (
            <div key={c.label} style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-md)",
              padding: "var(--sp-3)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-1)",
            }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
                <span aria-hidden="true">{c.icon}</span>
                {c.label}
              </span>
              <span style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text)" }}>
                {c.value}
              </span>
            </div>
          ))}
        </div>
        {/* Overall progress bar */}
        <div style={{ marginTop: "var(--sp-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-1)" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>Overall Progress</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-2)", fontWeight: 600 }}>{pct}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-bar success"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Overall progress: ${pct}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BOARDS TAB
   ═══════════════════════════════════════════════════════════ */

function BoardCard({
  board,
  onExpand,
  expanded,
}: {
  board: KanbanBoard;
  onExpand: () => void;
  expanded: boolean;
}) {
  const pct = board.total_tasks > 0
    ? Math.round((board.done / board.total_tasks) * 100)
    : 0;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        className="card-body"
        style={{ padding: "var(--sp-3) var(--sp-4)", cursor: "pointer" }}
        onClick={onExpand}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Board ${board.board_name}, ${board.total_tasks} tasks`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(); } }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-2)" }}>
          <span className="card-title" style={{ fontSize: "var(--text-md)", margin: 0 }}>{board.board_name}</span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
            {board.total_tasks} tasks · {pct}%
          </span>
        </div>
        {/* Stacked progress bar */}
        <div className="progress-track" style={{ height: 8, marginBottom: "var(--sp-2)" }}>
          {board.statuses.map((s) => {
            const w = board.total_tasks > 0 ? (s.count / board.total_tasks) * 100 : 0;
            const c = statusColor(s.status);
            return (
              <div
                key={s.status}
                style={{
                  height: "100%",
                  width: `${w}%`,
                  background: c.bar,
                  display: "inline-block",
                  transition: "width var(--t-mid) var(--ease-out)",
                }}
                title={`${s.status}: ${s.count}`}
                aria-label={`${s.status}: ${s.count}`}
              />
            );
          })}
        </div>
        {/* Status badges */}
        <div style={{ display: "flex", gap: "var(--sp-1)", flexWrap: "wrap" }}>
          {board.statuses.map((s) => {
            const c = statusColor(s.status);
            return (
              <span
                key={s.status}
                className="badge"
                style={{
                  background: c.bg,
                  color: c.text,
                  borderColor: c.text,
                  opacity: 0.85,
                }}
              >
                {s.status}: {s.count}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: "var(--sp-1)", fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
          {expanded ? "▾ Click to collapse" : "▸ Click to expand"}
        </div>
      </div>
    </div>
  );
}

function BoardDetail({ boardId }: { boardId: string }) {
  const [detail, setDetail] = useState<KanbanBoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    kanbanBoardDetail(boardId, { limit: 50 })
      .then((d) => { if (!cancelled) { setDetail(d); setError(null); } })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [boardId]);

  if (loading) return <div style={{ padding: "var(--sp-3)" }}><Spinner size="sm" /> Loading tasks…</div>;
  if (error) return <div style={{ padding: "var(--sp-3)", color: "var(--danger)" }}>Error: {error}</div>;
  if (!detail) return null;

  if (detail.tasks.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "var(--sp-4)" }}>
        <span className="empty-state-icon">📭</span>
        <span className="empty-state-title">No tasks found</span>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={{ textAlign: "left", padding: "var(--sp-2) var(--sp-3)", color: "var(--text-3)", fontWeight: 500 }}>Task</th>
            <th style={{ textAlign: "left", padding: "var(--sp-2) var(--sp-3)", color: "var(--text-3)", fontWeight: 500 }}>Status</th>
            <th style={{ textAlign: "left", padding: "var(--sp-2) var(--sp-3)", color: "var(--text-3)", fontWeight: 500 }}>Assignee</th>
            <th style={{ textAlign: "left", padding: "var(--sp-2) var(--sp-3)", color: "var(--text-3)", fontWeight: 500 }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {detail.tasks.map((task) => {
            const c = statusColor(task.status);
            return (
              <tr key={task.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "var(--sp-2) var(--sp-3)" }}>
                  <div style={{ fontWeight: 500, color: "var(--text)" }}>{task.title}</div>
                  {task.body && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginTop: 2, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {task.body}
                    </div>
                  )}
                </td>
                <td style={{ padding: "var(--sp-2) var(--sp-3)" }}>
                  <span
                    className="badge"
                    style={{ background: c.bg, color: c.text, borderColor: c.text, opacity: 0.85 }}
                  >
                    {task.status}
                  </span>
                </td>
                <td style={{ padding: "var(--sp-2) var(--sp-3)", color: "var(--text-2)" }}>
                  {task.assignee ?? "—"}
                </td>
                <td style={{ padding: "var(--sp-2) var(--sp-3)", color: "var(--text-3)", fontSize: "var(--text-xs)" }}>
                  {fmtDate(task.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {detail.total > detail.limit && (
        <div style={{ padding: "var(--sp-2) var(--sp-3)", fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
          Showing {detail.limit} of {detail.total} tasks
        </div>
      )}
    </div>
  );
}

function BoardsTab({ setToast }: Props) {
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBoard, setExpandedBoard] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBoards = useCallback(async () => {
    try {
      const data = await kanbanBoards();
      setBoards(data.boards);
      setError(null);
    } catch (err) {
      setError(String(err));
      setToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  }, [setToast]);

  useEffect(() => {
    fetchBoards();
    const id = setInterval(fetchBoards, 30_000);
    return () => clearInterval(id);
  }, [fetchBoards]);

  if (loading) {
    return (
      <div className="empty-state">
        <Spinner size="md" />
        <span className="empty-state-title">Loading boards…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <span className="empty-state-title">Failed to load boards</span>
        <span className="empty-state-desc">{error}</span>
        <button className="btn-ghost" onClick={fetchBoards} style={{ marginTop: "var(--sp-2)" }}>
          Retry
        </button>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">📋</span>
        <span className="empty-state-title">No boards found</span>
        <span className="empty-state-desc">There are no Kanban boards configured yet.</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-ghost" onClick={fetchBoards} aria-label="Refresh boards">
          🔄 Refresh
        </button>
      </div>
      {boards.map((board) => (
        <div key={board.board_id}>
          <BoardCard
            board={board}
            expanded={expandedBoard === board.board_id}
            onExpand={() => setExpandedBoard(
              expandedBoard === board.board_id ? null : board.board_id
            )}
          />
          <AnimatePresence>
            {expandedBoard === board.board_id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                <div className="card" style={{ borderRadius: "0 0 var(--r-lg) var(--r-lg)", borderTop: "none" }}>
                  <BoardDetail boardId={board.board_id} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AGENTS TAB
   ═══════════════════════════════════════════════════════════ */

function AgentsTab({ setToast }: Props) {
  const [agents, setAgents] = useState<KanbanAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await kanbanAgents();
      setAgents(data.agents);
      setError(null);
    } catch (err) {
      setError(String(err));
      setToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  }, [setToast]);

  useEffect(() => {
    fetchAgents();
    const id = setInterval(fetchAgents, 30_000);
    return () => clearInterval(id);
  }, [fetchAgents]);

  if (loading) {
    return (
      <div className="empty-state">
        <Spinner size="md" />
        <span className="empty-state-title">Loading agents…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <span className="empty-state-title">Failed to load agents</span>
        <span className="empty-state-desc">{error}</span>
        <button className="btn-ghost" onClick={fetchAgents} style={{ marginTop: "var(--sp-2)" }}>
          Retry
        </button>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">🤖</span>
        <span className="empty-state-title">No agents found</span>
        <span className="empty-state-desc">No agent profiles have been assigned tasks yet.</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-ghost" onClick={fetchAgents} aria-label="Refresh agents">
          🔄 Refresh
        </button>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "var(--sp-3)",
      }}>
        {agents.map((agent) => {
          const pct = agent.total_tasks > 0
            ? Math.round((agent.completed_30d / agent.total_tasks) * 100)
            : 0;
          return (
            <div key={agent.assignee} className="card">
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="card-title" style={{ fontSize: "var(--text-md)", margin: 0 }}>
                    🤖 {agent.assignee}
                  </span>
                  {agent.active_tasks > 0 && (
                    <span className="badge warning" aria-label={`${agent.active_tasks} active tasks`}>
                      {agent.active_tasks} active
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)", fontSize: "var(--text-sm)" }}>
                  <div>
                    <span style={{ color: "var(--text-3)" }}>Total</span>
                    <div style={{ fontWeight: 600 }}>{agent.total_tasks}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-3)" }}>Active</span>
                    <div style={{ fontWeight: 600, color: "var(--warning)" }}>{agent.active_tasks}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-3)" }}>Done 24h</span>
                    <div style={{ fontWeight: 600, color: "var(--success)" }}>{agent.completed_24h}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-3)" }}>Done 7d</span>
                    <div style={{ fontWeight: 600, color: "var(--success)" }}>{agent.completed_7d}</div>
                  </div>
                </div>
                <div style={{ marginTop: "var(--sp-1)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>30d completion</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-2)" }}>{pct}%</span>
                  </div>
                  <div className="progress-track" style={{ height: 6 }}>
                    <div
                      className="progress-bar success"
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ACTIVITY FEED TAB
   ═══════════════════════════════════════════════════════════ */

const EVENT_KIND_ICONS: Record<string, string> = {
  created:   "🆕",
  claimed:   "🙋",
  promoted:  "⬆️",
  completed: "✅",
  blocked:   "🚫",
  commented: "💬",
  spawned:   "🚀",
  heartbeat: "💓",
  linked:    "🔗",
  updated:   "✏️",
  gave_up:   "❌",
  unblocked: "🔓",
};

function eventIcon(kind: string) {
  return EVENT_KIND_ICONS[kind] ?? "📌";
}

function eventKindBadge(kind: string) {
  if (kind === "completed") return "success";
  if (kind === "blocked" || kind === "gave_up") return "danger";
  if (kind === "claimed" || kind === "spawned" || kind === "promoted") return "warning";
  return "";
}

function ActivityFeedTab({ setToast }: Props) {
  const [events, setEvents] = useState<KanbanActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [limit] = useState(30);

  const fetchActivity = useCallback(async () => {
    try {
      const data = await kanbanActivity({
        limit,
        offset: 0,
        type: filterType || undefined,
      });
      setEvents(data.events);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(String(err));
      setToast(String(err), "error");
    } finally {
      setLoading(false);
    }
  }, [filterType, limit, setToast]);

  useEffect(() => {
    fetchActivity();
    const id = setInterval(fetchActivity, 30_000);
    return () => clearInterval(id);
  }, [fetchActivity]);

  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    events.forEach((e) => types.add(e.kind));
    return Array.from(types).sort();
  }, [events]);

  if (loading) {
    return (
      <div className="empty-state">
        <Spinner size="md" />
        <span className="empty-state-title">Loading activity…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <span className="empty-state-title">Failed to load activity</span>
        <span className="empty-state-desc">{error}</span>
        <button className="btn-ghost" onClick={fetchActivity} style={{ marginTop: "var(--sp-2)" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
          <label htmlFor="activity-filter" style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>
            Filter:
          </label>
          <select
            id="activity-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              background: "var(--surface-2)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              padding: "2px 8px",
              fontSize: "var(--text-sm)",
            }}
            aria-label="Filter events by type"
          >
            <option value="">All events</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
            {total} events
          </span>
        </div>
        <button className="btn-ghost" onClick={fetchActivity} aria-label="Refresh activity feed">
          🔄 Refresh
        </button>
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📭</span>
          <span className="empty-state-title">No activity</span>
          <span className="empty-state-desc">No events match the current filter.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {events.map((ev, i) => (
            <motion.div
              key={`${ev.id}-${ev.created_at}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.15 }}
              style={{
                display: "flex",
                gap: "var(--sp-3)",
                padding: "var(--sp-2) var(--sp-3)",
                borderBottom: "1px solid var(--border-subtle)",
                alignItems: "flex-start",
              }}
            >
              {/* Timeline dot */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flexShrink: 0,
                paddingTop: 2,
              }}>
                <span style={{ fontSize: "var(--text-md)" }} aria-hidden="true">
                  {eventIcon(ev.kind)}
                </span>
                {i < events.length - 1 && (
                  <div style={{
                    width: 1,
                    flex: 1,
                    minHeight: 16,
                    background: "var(--border-subtle)",
                    marginTop: 2,
                  }} />
                )}
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                  <span className={`badge ${eventKindBadge(ev.kind)}`}>
                    {ev.kind}
                  </span>
                  {ev.task_title && (
                    <span style={{ fontWeight: 500, fontSize: "var(--text-sm)", color: "var(--text)" }}>
                      {ev.task_title}
                    </span>
                  )}
                  {ev.task_assignee && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
                      · {ev.task_assignee}
                    </span>
                  )}
                </div>
                {ev.task_status && (
                  <span
                    className="badge"
                    style={{
                      ...((() => { const c = statusColor(ev.task_status); return { background: c.bg, color: c.text, borderColor: c.text, opacity: 0.7 }; })()),
                      marginLeft: "var(--sp-1)",
                      fontSize: "10px",
                    }}
                  >
                    {ev.task_status}
                  </span>
                )}
                {ev.payload && (
                  <pre style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-3)",
                    marginTop: "var(--sp-1)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "var(--font-mono)",
                    maxHeight: 60,
                    overflow: "hidden",
                  }}>
                    {ev.payload.length > 200 ? ev.payload.slice(0, 200) + "…" : ev.payload}
                  </pre>
                )}
              </div>
              {/* Timestamp */}
              <span style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-3)",
                flexShrink: 0,
                whiteSpace: "nowrap",
                paddingTop: 2,
              }} title={fmtDate(ev.created_at)}>
                {fmtRelative(ev.created_at)}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN ACTIVITY PAGE
   ═══════════════════════════════════════════════════════════ */

const TABS: Array<{ id: ActivityTabId; label: string; icon: string }> = [
  { id: "boards",   label: "Boards",   icon: "📋" },
  { id: "agents",   label: "Agents",   icon: "🤖" },
  { id: "activity", label: "Activity", icon: "📡" },
];

export function ActivityPage({ setToast }: Props) {
  const prefersReduced = useReducedMotion();
  const [activeTab, setActiveTab] = useState<ActivityTabId>("boards");
  const [summary, setSummary] = useState<KanbanSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await kanbanSummary();
      setSummary(data);
      setSummaryError(null);
    } catch (err) {
      setSummaryError(String(err));
      setToast(String(err), "error");
    } finally {
      setSummaryLoading(false);
    }
  }, [setToast]);

  useEffect(() => {
    fetchSummary();
    const id = setInterval(fetchSummary, 30_000);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, [fetchSummary]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", height: "100%" }}>
      {/* ── Summary cards ── */}
      {summaryLoading && !summary && (
        <div className="empty-state" style={{ minHeight: 80 }}>
          <Spinner size="sm" />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>Loading summary…</span>
        </div>
      )}
      {summaryError && !summary && (
        <div className="card">
          <div className="card-body" style={{ padding: "var(--sp-2) var(--sp-3)" }}>
            <span style={{ color: "var(--danger)", fontSize: "var(--text-sm)" }}>
              ⚠️ Failed to load summary: {summaryError}
            </span>
            <button className="btn-ghost" onClick={fetchSummary} style={{ marginLeft: "var(--sp-2)" }}>
              Retry
            </button>
          </div>
        </div>
      )}
      {summary && <SummaryCards summary={summary} />}

      {/* ── Tab bar ── */}
      <div
        style={{
          display: "flex",
          gap: 2,
          background: "var(--surface-2)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-lg)",
          padding: 3,
          flexShrink: 0,
        }}
        role="tablist"
        aria-label="Activity sections"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "var(--sp-2) var(--sp-3)",
                borderRadius: "var(--r-md)",
                border: "none",
                background: isActive ? "var(--surface)" : "transparent",
                color: isActive ? "var(--text)" : "var(--text-3)",
                fontWeight: isActive ? 600 : 400,
                fontSize: "var(--text-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--sp-2)",
                boxShadow: isActive ? "var(--shadow-xs)" : "none",
                transition: "all var(--t-fast) var(--ease-out)",
              }}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab panels ── */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {activeTab === "boards" && (
          <div role="tabpanel" id="tabpanel-boards" aria-labelledby="tab-boards">
            <BoardsTab setToast={setToast} />
          </div>
        )}
        {activeTab === "agents" && (
          <div role="tabpanel" id="tabpanel-agents" aria-labelledby="tab-agents">
            <AgentsTab setToast={setToast} />
          </div>
        )}
        {activeTab === "activity" && (
          <div role="tabpanel" id="tabpanel-activity" aria-labelledby="tab-activity">
            <ActivityFeedTab setToast={setToast} />
          </div>
        )}
      </div>
    </div>
  );
}
