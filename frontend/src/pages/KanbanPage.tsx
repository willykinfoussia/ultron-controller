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
  type KanbanCard,
} from "../api/client";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";

/* ── Types ──────────────────────────────────────────────── */

type ColumnId = "triage" | "backlog" | "in_progress" | "review";

type Props = { setToast: (msg: string, kind?: ToastKind) => void };

interface ColumnDef {
  id: ColumnId;
  label: string;
  icon: string;
  color: string;
  colorSub: string;
}

const COLUMNS: ColumnDef[] = [
  { id: "triage",      label: "Triage",      icon: "🔍", color: "#62627a", colorSub: "rgba(98,98,122,0.08)"  },
  { id: "backlog",     label: "Backlog",     icon: "📋", color: "#3b82f6", colorSub: "rgba(59,130,246,0.08)"  },
  { id: "in_progress", label: "In Progress", icon: "🔄", color: "#f5a524", colorSub: "rgba(245,165,36,0.08)"  },
  { id: "review",      label: "Review",      icon: "👁️", color: "#1acd8e", colorSub: "rgba(26,205,142,0.08)"  },
];

/* ── Helpers ─────────────────────────────────────────────── */

function fmtDate(ts: number) {
  if (!ts) return "--";
  try {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      month: "short", day: "numeric",
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

/* =================================================================
   TASK CARD (uses native HTML5 drag events on a plain div)
   ================================================================= */

function TaskCard({
  card,
  columnColor,
  onDragStart,
  onDragEnd,
}: {
  card: KanbanCard;
  columnColor: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, card: KanbanCard) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
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
              {card.assignee}
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
}: {
  column: ColumnDef;
  cards: KanbanCard[];
  isLoading: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, card: KanbanCard) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (targetColumnId: ColumnId) => void;
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
            />
          ))
        )}
      </div>
    </div>
  );
}

/* =================================================================
   BOARD HEADER
   ================================================================= */

function BoardHeader({
  totalCards,
  isLoading,
  onRefresh,
  setToast,
}: {
  totalCards: number;
  isLoading: boolean;
  onRefresh: () => void;
  setToast: (msg: string, kind?: ToastKind) => void;
}) {
  return (
    <div className="kanban-board-header">
      <div className="kanban-board-header-left">
        <h2 className="kanban-board-title">📌 Kanban Board</h2>
        <span className="kanban-board-meta">
          {isLoading ? "Loading..." : `${totalCards} task${totalCards !== 1 ? "s" : ""}`}
        </span>
      </div>
      <button
        className="btn kanban-btn-refresh"
        onClick={() => {
          onRefresh();
          setToast("Board refreshed", "success");
        }}
        disabled={isLoading}
        title="Refresh"
      >
        Refresh
      </button>
    </div>
  );
}

/* =================================================================
   MAIN PAGE
   ================================================================= */

export function KanbanBoardPage({ setToast }: Props) {
  const [cardsByColumn, setCardsByColumn] = useState<Record<ColumnId, KanbanCard[]>>({
    triage: [],
    backlog: [],
    in_progress: [],
    review: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

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
        backlog: [],
        in_progress: [],
        review: [],
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

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

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

  const totalCards = Object.values(cardsByColumn).reduce((s, c) => s + c.length, 0);

  return (
    <div className="page kanban-page">
      <BoardHeader
        totalCards={totalCards}
        isLoading={isLoading}
        onRefresh={fetchCards}
        setToast={setToast}
      />

      {error && (
        <div className="kanban-error-banner">
          <span>Warning: {error}</span>
          <button className="btn" onClick={fetchCards}>Retry</button>
        </div>
      )}

      {moving && <div className="kanban-moving-overlay"><Spinner /></div>}

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
            cards={cardsByColumn[col.id]}
            isLoading={isLoading}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
          />
        ))}
      </motion.div>
    </div>
  );
}
