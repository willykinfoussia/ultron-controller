"""Writable Kanban service — move / update card_status.

Separate from KanbanReader so the read-only HTTP endpoints stay
read-only and the write path gets its own lifecycle.
"""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException

# Valid statuses a card can be moved to via the Kanban board.
VALID_STATUSES = {"triage", "todo", "ready", "running", "blocked", "review", "done"}

# Statuses that archive / unarchive a card.
ARCHIVED_STATUS = "archived"


class KanbanWriter:
    """Write service for Kanban card mutations (status changes, moves)."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def _check_db(self) -> None:
        if not self._db_path.exists():
            raise HTTPException(
                status_code=503,
                detail="Kanban database is unavailable",
            )

    def _connect(self) -> sqlite3.Connection:
        self._check_db()
        uri = f"file:{self._db_path.as_posix()}?mode=rw"
        conn = sqlite3.connect(uri, uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    # ------------------------------------------------------------------ #
    # move_card — change a task's status (drag-and-drop)                  #
    # ------------------------------------------------------------------ #

    def move_card(self, card_id: str, new_status: str) -> dict[str, Any]:
        """Move a card to a new status column.

        Returns the updated task dict.
        Raises 404 if card not found, 400 if status is invalid,
        409 if the card is locked by a running worker.
        """
        new_status = new_status.strip().lower()
        if new_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{new_status}'. Must be one of: {sorted(VALID_STATUSES)}",
            )

        now = int(time.time())

        with self._connect() as conn:
            # IMMEDIATE write txn for atomic read-then-write
            conn.execute("BEGIN IMMEDIATE")
            try:
                row = conn.execute(
                    "SELECT id, title, status, assignee, claim_lock FROM tasks WHERE id = ?",
                    (card_id,),
                ).fetchone()

                if not row:
                    conn.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail=f"Card {card_id} not found")

                current_status = row["status"]
                claim_lock = row["claim_lock"]

                # Refuse to move a card that's actively locked by a worker
                if claim_lock is not None and current_status == "running":
                    conn.execute("ROLLBACK")
                    raise HTTPException(
                        status_code=409,
                        detail=f"Card {card_id} is currently locked by an active worker; wait for completion or reclaim first",
                    )

                # Record the old status in the event payload for audit
                old_status = current_status

                # Update the task status
                conn.execute(
                    "UPDATE tasks SET status = ? WHERE id = ?",
                    (new_status, card_id),
                )

                # Append a 'moved' event for audit trail
                payload = {
                    "old_status": old_status,
                    "new_status": new_status,
                    "moved_at": now,
                }
                import json
                conn.execute(
                    "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                    "VALUES (?, NULL, 'moved', ?, ?)",
                    (card_id, json.dumps(payload, ensure_ascii=False), now),
                )

                conn.execute("COMMIT")
            except HTTPException:
                raise
            except Exception:
                try:
                    conn.execute("ROLLBACK")
                except sqlite3.OperationalError:
                    pass
                raise

        # Fetch and return the updated task
        return self._get_card(card_id)

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    def _get_card(self, card_id: str) -> dict[str, Any]:
        """Fetch a single task by id."""
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, title, body, assignee, status, priority, "
                "created_by, created_at, started_at, completed_at, "
                "workspace_kind, tenant, result "
                "FROM tasks WHERE id = ?",
                (card_id,),
            ).fetchone()

            if not row:
                raise HTTPException(status_code=404, detail=f"Card {card_id} not found")

            return dict(row)
