import { motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  kanbanListCards,
  kanbanMoveCard,
  kanbanTaskDetail,
  kanbanAddComment,
  kanbanCreateTask,
  kanbanUpdateTask,
  kanbanDeleteTask,
  kanbanBlockTask,
  kanbanUnblockTask,
  kanbanReclaimTask,
  kanbanAssignTask,
  kanbanAgents,
  kanbanSummary,
  kanbanSearch,
  type KanbanCard,
  type KanbanTaskDetail,
  type KanbanAgent,
  type KanbanSummary,
} from "../api/client";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";

/* ── Types ──────────────────────────────────────────────── */

type ColumnId = "triage" | "todo" | "ready" | "running" | "review" | "blocked" | "done";

type Props = { setToast: (msg: string, kind?: ToastKind) => void };

interface ColumnDef {
  id: ColumnId;
  label: string;
  icon: string;
  color: string;
  colorSub: string;
}

const COLUMNS: ColumnDef[] = [
  { id: "triage",  label: "Triage",      icon: "🔍", color: "#62627a", colorSub: "rgba(98,98,122,0.08)"  },
  { id: "todo",    label: "To Do",       icon: "📋", color: "#3b82f6", colorSub: "rgba(59,130,246,0.08)"  },
  { id: "ready",   label: "Ready",       icon: "⚡", color: "#8b5cf6", colorSub: "rgba(139,92,246,0.08)"  },
  { id: "running", label: "In Progress", icon: "🔄", color: "#f5a524", colorSub: "rgba(245,165,36,0.08)"  },
  { id: "review",  label: "Review",      icon: "👁️", color: "#06b6d4", colorSub: "rgba(6,182,212,0.08)"   },
  { id: "blocked", label: "Blocked",     icon: "🚫", color: "#f43f5e", colorSub: "rgba(244,63,94,0.08)"   },
  { id: "done",    label: "Done",        icon: "✅", color: "#1acd8e", colorSub: "rgba(26,205,142,0.08)"  },
];

const ALL_STATUSES: ColumnId[] = ["triage", "todo", "ready", "running", "review", "blocked", "done"];

/* ── Helpers ─────────────────────────────────────────────── */

function fmtDate(ts: number) {
  if (!ts) return "--";
  try {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      month: "short", day: "numeric",
    });
  } catch { return "--"; }
}

function fmtDateTime(ts: number) {
  if (!ts) return "--";
  try {
    return new Date(ts * 1000).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "--"; }
}

function priorityLabel(p: number): string | null {
  if (p >= 3) return "P0";
  if (p === 2) return "P1";
  if (p === 1) return "P2";
  return null;
}

function priorityColor(p: number) {
  if (p >= 3) return { bg: "var(--danger-sub)", text: "var(--danger)", border: "var(--danger-border)" };
  if (p === 2) return { bg: "var(--warning-sub)", text: "var(--warning)", border: "var(--warning-border)" };
  if (p === 1) return { bg: "var(--primary-sub)", text: "var(--primary)", border: "var(--primary-ring)" };
  return null;
}

function statusColor(status: string): string {
  const col = COLUMNS.find(c => c.id === status);
  return col?.color ?? "#62627a";
}

/* =================================================================
   TASK DETAIL MODAL
   ================================================================= */

function TaskDetailModal({
  taskId,
  setToast,
  onClose,
  onRefresh,
}: {
  taskId: string;
  setToast: (msg: string, kind?: ToastKind) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<KanbanTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editPriority, setEditPriority] = useState(0);
  const [saving, setSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const d = await kanbanTaskDetail(taskId);
      setDetail(d);
      setEditTitle(d.title);
      setEditBody(d.body ?? "");
      setEditAssignee(d.assignee ?? "");
      setEditPriority(d.priority);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load task";
      setToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [taskId, setToast]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setAddingComment(true);
    try {
      await kanbanAddComment(taskId, commentText.trim());
      setCommentText("");
      setToast("Comment added", "success");
      await loadDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add comment";
      setToast(msg, "error");
    } finally {
      setAddingComment(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await kanbanUpdateTask(taskId, {
        title: editTitle,
        body: editBody,
        assignee: editAssignee,
        priority: editPriority,
      });
      setToast("Task updated", "success");
      setEditing(false);
      await loadDetail();
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update";
      setToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBlock = async () => {
    const reason = prompt("Block reason:");
    if (!reason) return;
    try {
      await kanbanBlockTask(taskId, reason);
      setToast("Task blocked", "warning");
      await loadDetail();
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to block";
      setToast(msg, "error");
    }
  };

  const handleUnblock = async () => {
    try {
      await kanbanUnblockTask(taskId, "ready");
      setToast("Task unblocked", "success");
      await loadDetail();
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to unblock";
      setToast(msg, "error");
    }
  };

  const handleReclaim = async () => {
    if (!confirm("Reclaim this task? This will release the claim lock and reset to ready.")) return;
    try {
      await kanbanReclaimTask(taskId);
      setToast("Task reclaimed", "success");
      await loadDetail();
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reclaim";
      setToast(msg, "error");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task permanently?")) return;
    try {
      await kanbanDeleteTask(taskId);
      setToast("Task deleted", "success");
      onRefresh();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      setToast(msg, "error");
    }
  };

  const handleMove = async (newStatus: ColumnId) => {
    try {
      await kanbanMoveCard(taskId, newStatus);
      setToast(`Moved to ${COLUMNS.find(c => c.id === newStatus)?.label ?? newStatus}`, "success");
      await loadDetail();
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Move failed";
      setToast(msg, "error");
    }
  };

  if (loading) {
    return (
      <div className="kanban-modal-overlay" onClick={onClose}>
        <div className="kanban-modal" onClick={e => e.stopPropagation()}>
          <div className="kanban-modal-loading"><Spinner /></div>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const prio = priorityColor(detail.priority);

  return (
    <div className="kanban-modal-overlay" onClick={onClose}>
      <motion.div
        className="kanban-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.15 }}
      >
        {/* Header */}
        <div className="kanban-modal-header">
          <div className="kanban-modal-header-left">
            {editing ? (
              <input
                className="kanban-modal-title-input"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
            ) : (
              <h2 className="kanban-modal-title">{detail.title}</h2>
            )}
            <div className="kanban-modal-badges">
              <span className="kanban-badge" style={{ background: statusColor(detail.status) + "22", color: statusColor(detail.status) }}>
                {COLUMNS.find(c => c.id === detail.status)?.label ?? detail.status}
              </span>
              {prio && (
                <span className="kanban-badge" style={{ background: prio.bg, color: prio.text, borderColor: prio.border }}>
                  {priorityLabel(detail.priority)}
                </span>
              )}
              {detail.assignee && (
                <span className="kanban-badge kanban-badge-assignee">@{detail.assignee}</span>
              )}
            </div>
          </div>
          <button className="kanban-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="kanban-modal-body">
          {/* Left: description + comments */}
          <div className="kanban-modal-main">
            {/* Description */}
            <div className="kanban-modal-section">
              <h4 className="kanban-modal-section-title">Description</h4>
              {editing ? (
                <textarea
                  className="kanban-modal-desc-input"
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={4}
                />
              ) : (
                <p className="kanban-modal-desc">{detail.body || "No description"}</p>
              )}
            </div>

            {/* Metadata */}
            <div className="kanban-modal-section">
              <h4 className="kanban-modal-section-title">Details</h4>
              <div className="kanban-modal-meta-grid">
                <div className="kanban-modal-meta-item">
                  <span className="kanban-modal-meta-label">Created</span>
                  <span>{fmtDateTime(detail.created_at)}</span>
                </div>
                <div className="kanban-modal-meta-item">
                  <span className="kanban-modal-meta-label">Started</span>
                  <span>{fmtDateTime(detail.started_at ?? 0)}</span>
                </div>
                <div className="kanban-modal-meta-item">
                  <span className="kanban-modal-meta-label">Completed</span>
                  <span>{fmtDateTime(detail.completed_at ?? 0)}</span>
                </div>
                {detail.workspace_kind && (
                  <div className="kanban-modal-meta-item">
                    <span className="kanban-modal-meta-label">Workspace</span>
                    <span>{detail.workspace_kind}{detail.workspace_path ? ` (${detail.workspace_path})` : ""}</span>
                  </div>
                )}
                {detail.claim_lock && (
                  <div className="kanban-modal-meta-item">
                    <span className="kanban-modal-meta-label">Claim Lock</span>
                    <span>{detail.claim_lock}</span>
                  </div>
                )}
                {detail.consecutive_failures > 0 && (
                  <div className="kanban-modal-meta-item">
                    <span className="kanban-modal-meta-label">Failures</span>
                    <span style={{ color: "var(--danger)" }}>{detail.consecutive_failures}</span>
                  </div>
                )}
                {detail.last_failure_error && (
                  <div className="kanban-modal-meta-item">
                    <span className="kanban-modal-meta-label">Last Error</span>
                    <span style={{ color: "var(--danger)", fontSize: "var(--text-xs)" }}>{detail.last_failure_error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Parents / Children */}
            {(detail.parents.length > 0 || detail.children.length > 0) && (
              <div className="kanban-modal-section">
                <h4 className="kanban-modal-section-title">Dependencies</h4>
                {detail.parents.length > 0 && (
                  <div className="kanban-modal-links">
                    <span className="kanban-modal-links-label">Parents:</span>
                    {detail.parents.map(p => (
                      <span key={p.id} className="kanban-badge" style={{ background: statusColor(p.status) + "22", color: statusColor(p.status) }}>
                        {p.title}
                      </span>
                    ))}
                  </div>
                )}
                {detail.children.length > 0 && (
                  <div className="kanban-modal-links">
                    <span className="kanban-modal-links-label">Children:</span>
                    {detail.children.map(c => (
                      <span key={c.id} className="kanban-badge" style={{ background: statusColor(c.status) + "22", color: statusColor(c.status) }}>
                        {c.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Runs */}
            {detail.runs.length > 0 && (
              <div className="kanban-modal-section">
                <h4 className="kanban-modal-section-title">Runs ({detail.runs.length})</h4>
                <div className="kanban-modal-runs">
                  {detail.runs.map(run => (
                    <div key={run.id} className="kanban-modal-run">
                      <div className="kanban-modal-run-header">
                        <span className="kanban-modal-run-profile">{run.profile ?? "unknown"}</span>
                        <span className={`kanban-modal-run-status kanban-modal-run-status--${run.status}`}>{run.status}</span>
                        <span className="kanban-modal-run-time">{fmtDateTime(run.started_at)}</span>
                      </div>
                      {run.summary && <p className="kanban-modal-run-summary">{run.summary}</p>}
                      {run.error && <p className="kanban-modal-run-error">{run.error}</p>}
                      {run.outcome && <span className="kanban-modal-run-outcome">{run.outcome}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="kanban-modal-section">
              <h4 className="kanban-modal-section-title">Comments ({detail.comments.length})</h4>
              <div className="kanban-modal-comments">
                {detail.comments.map(c => (
                  <div key={c.id} className="kanban-modal-comment">
                    <div className="kanban-modal-comment-header">
                      <span className="kanban-modal-comment-author">{c.author}</span>
                      <span className="kanban-modal-comment-time">{fmtDateTime(c.created_at)}</span>
                    </div>
                    <p className="kanban-modal-comment-body">{c.body}</p>
                  </div>
                ))}
                <div className="kanban-modal-comment-add">
                  <textarea
                    className="kanban-modal-comment-input"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                  />
                  <button
                    className="btn btn-sm"
                    onClick={handleAddComment}
                    disabled={addingComment || !commentText.trim()}
                  >
                    {addingComment ? <Spinner /> : "Comment"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: actions sidebar */}
          <div className="kanban-modal-sidebar">
            <h4 className="kanban-modal-section-title">Actions</h4>

            {editing ? (
              <div className="kanban-modal-actions">
                <div className="kanban-modal-form-group">
                  <label>Assignee</label>
                  <input value={editAssignee} onChange={e => setEditAssignee(e.target.value)} />
                </div>
                <div className="kanban-modal-form-group">
                  <label>Priority</label>
                  <select value={editPriority} onChange={e => setEditPriority(Number(e.target.value))}>
                    <option value={0}>None</option>
                    <option value={1}>P2</option>
                    <option value={2}>P1</option>
                    <option value={3}>P0</option>
                  </select>
                </div>
                <button className="btn btn-sm" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? <Spinner /> : "Save"}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            ) : (
              <div className="kanban-modal-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>✏️ Edit</button>
                {detail.status !== "blocked" && (
                  <button className="btn btn-sm btn-ghost" onClick={handleBlock}>🚫 Block</button>
                )}
                {detail.status === "blocked" && (
                  <button className="btn btn-sm btn-ghost" onClick={handleUnblock}>▶️ Unblock</button>
                )}
                {detail.status === "running" && (
                  <button className="btn btn-sm btn-ghost" onClick={handleReclaim}>🔄 Reclaim</button>
                )}
                <button className="btn btn-sm btn-ghost btn-danger" onClick={handleDelete}>🗑️ Delete</button>
              </div>
            )}

            <h4 className="kanban-modal-section-title" style={{ marginTop: "var(--sp-4)" }}>Move to</h4>
            <div className="kanban-modal-move-actions">
              {ALL_STATUSES.filter(s => s !== detail.status).map(s => {
                const col = COLUMNS.find(c => c.id === s)!;
                return (
                  <button
                    key={s}
                    className="btn btn-sm btn-ghost kanban-modal-move-btn"
                    onClick={() => handleMove(s)}
                    style={{ borderColor: col.color + "44" }}
                  >
                    {col.icon} {col.label}
                  </button>
                );
              })}
            </div>

            {/* Assign */}
            <h4 className="kanban-modal-section-title" style={{ marginTop: "var(--sp-4)" }}>Assign</h4>
            <form
              className="kanban-modal-assign-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const input = form.elements.namedItem("assignee") as HTMLInputElement;
                if (!input.value.trim()) return;
                try {
                  await kanbanAssignTask(taskId, input.value.trim());
                  setToast(`Assigned to ${input.value.trim()}`, "success");
                  await loadDetail();
                  onRefresh();
                  input.value = "";
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Failed to assign";
                  setToast(msg, "error");
                }
              }}
            >
              <input name="assignee" placeholder="Profile name..." />
              <button type="submit" className="btn btn-sm">Assign</button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* =================================================================
   CREATE TASK MODAL
   ================================================================= */

function CreateTaskModal({
  setToast,
  onClose,
  onRefresh,
  initialStatus = "triage",
}: {
  setToast: (msg: string, kind?: ToastKind) => void;
  onClose: () => void;
  onRefresh: () => void;
  initialStatus?: ColumnId;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState(0);
  const [status, setStatus] = useState<ColumnId>(initialStatus);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await kanbanCreateTask({
        title: title.trim(),
        body: body.trim(),
        assignee: assignee.trim(),
        priority,
        status,
      });
      setToast("Task created", "success");
      onRefresh();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create task";
      setToast(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="kanban-modal-overlay" onClick={onClose}>
      <motion.div
        className="kanban-modal kanban-modal--sm"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        <div className="kanban-modal-header">
          <h2 className="kanban-modal-title">New Task</h2>
          <button className="kanban-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="kanban-modal-body">
          <div className="kanban-modal-form">
            <div className="kanban-modal-form-group">
              <label>Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title..." autoFocus />
            </div>
            <div className="kanban-modal-form-group">
              <label>Description</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Description..." />
            </div>
            <div className="kanban-modal-form-row">
              <div className="kanban-modal-form-group">
                <label>Assignee</label>
                <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Profile name..." />
              </div>
              <div className="kanban-modal-form-group">
                <label>Priority</label>
                <select value={priority} onChange={e => setPriority(Number(e.target.value))}>
                  <option value={0}>None</option>
                  <option value={1}>P2</option>
                  <option value={2}>P1</option>
                  <option value={3}>P0</option>
                </select>
              </div>
              <div className="kanban-modal-form-group">
                <label>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as ColumnId)}>
                  {COLUMNS.filter(c => c.id !== "done" && c.id !== "running").map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="kanban-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleCreate} disabled={creating || !title.trim()}>
            {creating ? <Spinner /> : "Create Task"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* =================================================================
   TASK CARD
   ================================================================= */

function TaskCard({
  card,
  columnColor,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  card: KanbanCard;
  columnColor: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, card: KanbanCard) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onClick: (card: KanbanCard) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const prio = priorityColor(card.priority);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
    >
      <div
        className="kanban-card"
        draggable
        onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
          setIsDragging(true);
          onDragStart(e, card);
        }}
        onDragEnd={(e: React.DragEvent<HTMLDivElement>) => {
          setIsDragging(false);
          onDragEnd(e);
        }}
        onClick={() => onClick(card)}
      >
        <div className="kanban-card-stripe" style={{ background: columnColor }} />
        <div className="kanban-card-body">
          <p className="kanban-card-title">{card.title}</p>
          {card.body && (
            <p className="kanban-card-desc">{card.body}</p>
          )}
          <div className="kanban-card-footer">
            {prio && (
              <span
                className="kanban-card-priority"
                style={{
                  background: prio.bg,
                  color: prio.text,
                  borderColor: prio.border,
                }}
              >
                {priorityLabel(card.priority)}
              </span>
            )}
            {card.assignee && (
              <span className="kanban-card-assignee" title={card.assignee}>
                @{card.assignee}
              </span>
            )}
            <span className="kanban-card-date">
              {fmtDate(card.created_at)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* =================================================================
   COLUMN
   ================================================================= */

function KanbanColumn({
  column,
  cards,
  isLoading,
  onDragStart,
  onDragEnd,
  onDrop,
  onCardClick,
}: {
  column: ColumnDef;
  cards: KanbanCard[];
  isLoading: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, card: KanbanCard) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (targetColumnId: ColumnId) => void;
  onCardClick: (card: KanbanCard) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const rect = columnRef.current?.getBoundingClientRect();
    if (rect) {
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (
        clientX < rect.left || clientX > rect.right ||
        clientY < rect.top || clientY > rect.bottom
      ) {
        setIsOver(false);
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
    onDrop(column.id);
  }, [column.id, onDrop]);

  const cssVars = {
    "--col-color": column.color,
    "--col-color-sub": column.colorSub,
  } as React.CSSProperties;

  return (
    <div
      ref={columnRef}
      className={`kanban-column ${isOver ? "kanban-column--over" : ""}`}
      data-column={column.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={cssVars}
    >
      <div className="kanban-column-header">
        <div className="kanban-column-title-row">
          <span className="kanban-column-icon">{column.icon}</span>
          <h3 className="kanban-column-title">{column.label}</h3>
          <span className="kanban-column-count">
            {isLoading ? "..." : cards.length}
          </span>
        </div>
        <div className="kanban-column-bar" />
      </div>

      <div className="kanban-column-cards">
        {isLoading ? (
          <div className="kanban-column-loading">
            <Spinner />
          </div>
        ) : cards.length === 0 ? (
          <div className="kanban-column-empty">
            <span className="kanban-column-empty-icon">{column.icon}</span>
            <p>No tasks</p>
            <p className="kanban-column-empty-hint">Drop cards here</p>
          </div>
        ) : (
          cards.map((card) => (
            <TaskCard
              key={card.id}
              card={card}
              columnColor={column.color}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* =================================================================
   AGENTS PANEL
   ================================================================= */

function AgentsPanel({ agents, summary }: { agents: KanbanAgent[]; summary: KanbanSummary | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`kanban-agents-panel ${open ? "kanban-agents-panel--open" : ""}`}>
      <button className="kanban-agents-toggle" onClick={() => setOpen(!open)}>
        🤖 Agents
        {summary && <span className="kanban-agents-badge">{summary.active_agents}</span>}
      </button>
      {open && (
        <div className="kanban-agents-content">
          {summary && (
            <div className="kanban-agents-summary">
              <div className="kanban-agents-stat">
                <span className="kanban-agents-stat-value">{summary.total_tasks}</span>
                <span className="kanban-agents-stat-label">Total</span>
              </div>
              <div className="kanban-agents-stat">
                <span className="kanban-agents-stat-value" style={{ color: "var(--success)" }}>{summary.tasks_by_status.done}</span>
                <span className="kanban-agents-stat-label">Done</span>
              </div>
              <div className="kanban-agents-stat">
                <span className="kanban-agents-stat-value" style={{ color: "var(--warning)" }}>{summary.tasks_by_status.running}</span>
                <span className="kanban-agents-stat-label">Running</span>
              </div>
              <div className="kanban-agents-stat">
                <span className="kanban-agents-stat-value" style={{ color: "var(--danger)" }}>{summary.tasks_by_status.blocked}</span>
                <span className="kanban-agents-stat-label">Blocked</span>
              </div>
              <div className="kanban-agents-stat">
                <span className="kanban-agents-stat-value">{Math.round(summary.completion_rate * 100)}%</span>
                <span className="kanban-agents-stat-label">Rate</span>
              </div>
            </div>
          )}
          <div className="kanban-agents-list">
            {agents.map(a => (
              <div key={a.assignee} className="kanban-agents-agent">
                <span className="kanban-agents-agent-name">@{a.assignee}</span>
                <span className="kanban-agents-agent-stats">
                  {a.active_tasks > 0 && <span className="kanban-agents-agent-active">{a.active_tasks} active</span>}
                  <span>{a.total_tasks} total</span>
                  <span style={{ color: "var(--success)" }}>{a.completed_24h}d</span>
                  <span style={{ color: "var(--primary)" }}>{a.completed_7d}w</span>
                </span>
              </div>
            ))}
            {agents.length === 0 && <p className="kanban-agents-empty">No agents yet</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* =================================================================
   MAIN PAGE
   ================================================================= */

export function KanbanBoardPage({ setToast }: Props) {
  const [cardsByColumn, setCardsByColumn] = useState<Record<ColumnId, KanbanCard[]>>({
    triage: [],
    todo: [],
    ready: [],
    running: [],
    review: [],
    blocked: [],
    done: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState<ColumnId>("triage");
  const [agents, setAgents] = useState<KanbanAgent[]>([]);
  const [summary, setSummary] = useState<KanbanSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<number | null>(null);

  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        COLUMNS.map((col) =>
          kanbanListCards({ status: col.id, limit: 200 }).then((r) => ({
            col: col.id,
            tasks: r.tasks,
          })),
        ),
      );
      const next: Record<ColumnId, KanbanCard[]> = {
        triage: [],
        todo: [],
        ready: [],
        running: [],
        review: [],
        blocked: [],
        done: [],
      };
      for (const r of results) {
        next[r.col] = r.tasks;
      }
      setCardsByColumn(next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load cards";
      setError(msg);
      setToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  }, [setToast]);

  const fetchAgents = useCallback(async () => {
    try {
      const [agentsRes, summaryRes] = await Promise.all([
        kanbanAgents(),
        kanbanSummary(),
      ]);
      setAgents(agentsRes.agents);
      setSummary(summaryRes);
    } catch { /* non-critical */ }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchCards(), fetchAgents()]);
  }, [fetchCards, fetchAgents]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const dragCardRef = useRef<KanbanCard | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, card: KanbanCard) => {
    dragCardRef.current = card;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
  }, []);

  const handleDragEnd = useCallback((_e: React.DragEvent<HTMLDivElement>) => {
    dragCardRef.current = null;
  }, []);

  const handleDrop = useCallback(
    async (targetColumnId: ColumnId) => {
      const card = dragCardRef.current;
      if (!card) return;
      if (card.status === targetColumnId) return;

      const previousStatus = card.status;
      setMoving(card.id);

      setCardsByColumn((prev) => {
        const updated = { ...prev };
        updated[previousStatus as ColumnId] = updated[previousStatus as ColumnId].filter(
          (c) => c.id !== card.id,
        );
        updated[targetColumnId] = [
          ...updated[targetColumnId],
          { ...card, status: targetColumnId },
        ];
        return updated;
      });

      try {
        await kanbanMoveCard(card.id, targetColumnId);
        const colLabel = COLUMNS.find((c) => c.id === targetColumnId)?.label ?? targetColumnId;
        setToast(`Moved "${card.title}" to ${colLabel}`, "success");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Move failed";
        setToast(msg, "error");
        fetchCards();
      } finally {
        setMoving(null);
        dragCardRef.current = null;
      }
    },
    [fetchCards, setToast],
  );

  const handleCardClick = useCallback((card: KanbanCard) => {
    setSelectedTask(card.id);
  }, []);

  const handleCreateClick = useCallback((status: ColumnId) => {
    setCreateStatus(status);
    setShowCreate(true);
  }, []);

  const totalCards = Object.values(cardsByColumn).reduce((s, c) => s + c.length, 0);

  // Filter cards
  const filteredCardsByColumn = useCallback(() => {
    const filtered: Record<ColumnId, KanbanCard[]> = {
      triage: [], todo: [], ready: [], running: [], review: [], blocked: [], done: [],
    };
    for (const col of COLUMNS) {
      let cards = cardsByColumn[col.id];
      if (filterAssignee) {
        cards = cards.filter(c => c.assignee?.toLowerCase().includes(filterAssignee.toLowerCase()));
      }
      if (filterPriority !== null) {
        cards = cards.filter(c => c.priority === filterPriority);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        cards = cards.filter(c => c.title.toLowerCase().includes(q) || (c.body ?? "").toLowerCase().includes(q));
      }
      filtered[col.id] = cards;
    }
    return filtered;
  }, [cardsByColumn, filterAssignee, filterPriority, searchQuery])();

  return (
    <div className="page kanban-page">
      {/* Header */}
      <div className="kanban-board-header">
        <div className="kanban-board-header-left">
          <h2 className="kanban-board-title">📌 Kanban Board</h2>
          <span className="kanban-board-meta">
            {isLoading ? "Loading..." : `${totalCards} task${totalCards !== 1 ? "s" : ""}`}
          </span>
          {summary && (
            <span className="kanban-board-meta" style={{ color: "var(--text-3)" }}>
              · {Math.round(summary.completion_rate * 100)}% complete
            </span>
          )}
        </div>
        <div className="kanban-board-header-right">
          {/* Search */}
          <input
            className="kanban-search-input"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {/* Filter by assignee */}
          <input
            className="kanban-filter-input"
            placeholder="Filter assignee..."
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
          />
          {/* Filter by priority */}
          <select
            className="kanban-filter-select"
            value={filterPriority ?? ""}
            onChange={e => setFilterPriority(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All priorities</option>
            <option value="3">P0</option>
            <option value="2">P1</option>
            <option value="1">P2</option>
          </select>
          {/* New task button */}
          <button className="btn" onClick={() => handleCreateClick("triage")}>
            + New Task
          </button>
          {/* Refresh */}
          <button
            className="btn btn-ghost"
            onClick={() => { refresh(); setToast("Board refreshed", "success"); }}
            disabled={isLoading}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Agents panel */}
      <AgentsPanel agents={agents} summary={summary} />

      {/* Error banner */}
      {error && (
        <div className="kanban-error-banner">
          <span>⚠️ {error}</span>
          <button className="btn" onClick={refresh}>Retry</button>
        </div>
      )}

      {/* Moving overlay */}
      {moving && <div className="kanban-moving-overlay"><Spinner /></div>}

      {/* Board */}
      <motion.div
        className="kanban-board"
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            cards={filteredCardsByColumn[col.id]}
            isLoading={isLoading}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onCardClick={handleCardClick}
          />
        ))}
      </motion.div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          taskId={selectedTask}
          setToast={setToast}
          onClose={() => setSelectedTask(null)}
          onRefresh={refresh}
        />
      )}

      {/* Create task modal */}
      {showCreate && (
        <CreateTaskModal
          setToast={setToast}
          onClose={() => setShowCreate(false)}
          onRefresh={refresh}
          initialStatus={createStatus}
        />
      )}
    </div>
  );
}
