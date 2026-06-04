"""Writable Kanban service — move / update / delete / link / block tasks.

Separate from KanbanReader so the read-only HTTP endpoints stay
read-only and the write path gets its own lifecycle.
"""

from __future__ import annotations

import json
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException

# Valid statuses a card can be moved to via the Kanban board.
VALID_STATUSES = {"triage", "todo", "ready", "running", "blocked", "review", "done"}

# Statuses that archive / unarchive a card.
ARCHIVED_STATUS = "archived"


class KanbanWriter:
    """Write service for Kanban card mutations (status changes, moves, etc.)."""

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
        if new_status not in VALID_STATUSES and new_status != ARCHIVED_STATUS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{new_status}'. Must be one of: {sorted(VALID_STATUSES)}",
            )

        now = int(time.time())

        with self._connect() as conn:
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

                old_status = current_status

                # Set completed_at / started_at based on status transitions
                extra_sets = ""
                extra_params: list[Any] = []
                if new_status == "done" and current_status != "done":
                    extra_sets = ", completed_at = ?"
                    extra_params.append(now)
                elif new_status == "running" and current_status != "running":
                    extra_sets = ", started_at = COALESCE(started_at, ?)"
                    extra_params.append(now)
                elif new_status != "done" and current_status == "done":
                    extra_sets = ", completed_at = NULL"

                conn.execute(
                    f"UPDATE tasks SET status = ? {extra_sets} WHERE id = ?",
                    [new_status] + extra_params + [card_id],
                )

                # Append a 'moved' event for audit trail
                payload = {
                    "old_status": old_status,
                    "new_status": new_status,
                    "moved_at": now,
                }
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

        return self._get_card(card_id)

    # ------------------------------------------------------------------ #
    # update_task — partial update (title, body, assignee, priority)      #
    # ------------------------------------------------------------------ #

    def update_task(
        self,
        task_id: str,
        title: str | None = None,
        body: str | None = None,
        assignee: str | None = None,
        priority: int | None = None,
    ) -> dict[str, Any]:
        """Partially update a task. Only provided fields are changed."""
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                row = conn.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if not row:
                    conn.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

                sets: list[str] = []
                params: list[Any] = []

                if title is not None:
                    sets.append("title = ?")
                    params.append(title)
                if body is not None:
                    sets.append("body = ?")
                    params.append(body)
                if assignee is not None:
                    sets.append("assignee = ?")
                    params.append(assignee)
                if priority is not None:
                    sets.append("priority = ?")
                    params.append(priority)

                if not sets:
                    conn.execute("ROLLBACK")
                    return self._get_card(task_id)

                params.append(task_id)
                conn.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?", params)

                # Audit event
                changes = {}
                if title is not None:
                    changes["title"] = title
                if body is not None:
                    changes["body"] = body
                if assignee is not None:
                    changes["assignee"] = assignee
                if priority is not None:
                    changes["priority"] = priority

                conn.execute(
                    "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                    "VALUES (?, NULL, 'updated', ?, ?)",
                    (task_id, json.dumps(changes, ensure_ascii=False), int(time.time())),
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

        return self._get_card(task_id)

    # ------------------------------------------------------------------ #
    # delete_task — permanently remove a task                              #
    # ------------------------------------------------------------------ #

    def delete_task(self, task_id: str) -> dict[str, Any]:
        """Delete a task and its associated data."""
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                row = conn.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if not row:
                    conn.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

                # Remove associated data
                conn.execute("DELETE FROM task_comments WHERE task_id = ?", (task_id,))
                conn.execute("DELETE FROM task_events WHERE task_id = ?", (task_id,))
                conn.execute("DELETE FROM task_links WHERE parent_id = ? OR child_id = ?", (task_id, task_id))
                conn.execute("DELETE FROM task_runs WHERE task_id = ?", (task_id,))
                conn.execute("DELETE FROM task_attachments WHERE task_id = ?", (task_id,))
                conn.execute("DELETE FROM kanban_notify_subs WHERE task_id = ?", (task_id,))
                conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))

                conn.execute("COMMIT")
            except HTTPException:
                raise
            except Exception:
                try:
                    conn.execute("ROLLBACK")
                except sqlite3.OperationalError:
                    pass
                raise

        return {"deleted": True, "task_id": task_id}

    # ------------------------------------------------------------------ #
    # link_tasks — create parent/child dependency link                     #
    # ------------------------------------------------------------------ #

    def link_tasks(self, parent_id: str, child_id: str) -> dict[str, Any]:
        """Create a parent/child link between two tasks."""
        if parent_id == child_id:
            raise HTTPException(status_code=400, detail="Cannot link a task to itself")

        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                # Verify both tasks exist
                for tid in (parent_id, child_id):
                    row = conn.execute("SELECT id FROM tasks WHERE id = ?", (tid,)).fetchone()
                    if not row:
                        conn.execute("ROLLBACK")
                        raise HTTPException(status_code=404, detail=f"Task {tid} not found")

                # Insert link (ignore if already exists)
                conn.execute(
                    "INSERT OR IGNORE INTO task_links (parent_id, child_id) VALUES (?, ?)",
                    (parent_id, child_id),
                )

                now = int(time.time())
                conn.execute(
                    "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                    "VALUES (?, NULL, 'linked', ?, ?)",
                    (child_id, json.dumps({"parent_id": parent_id}, ensure_ascii=False), now),
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

        return {"parent_id": parent_id, "child_id": child_id, "linked": True}

    # ------------------------------------------------------------------ #
    # unlink_tasks — remove a parent/child link                            #
    # ------------------------------------------------------------------ #

    def unlink_tasks(self, parent_id: str, child_id: str) -> dict[str, Any]:
        """Remove a parent/child link between two tasks."""
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                conn.execute(
                    "DELETE FROM task_links WHERE parent_id = ? AND child_id = ?",
                    (parent_id, child_id),
                )
                now = int(time.time())
                conn.execute(
                    "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                    "VALUES (?, NULL, 'unlinked', ?, ?)",
                    (child_id, json.dumps({"parent_id": parent_id}, ensure_ascii=False), now),
                )
                conn.execute("COMMIT")
            except Exception:
                try:
                    conn.execute("ROLLBACK")
                except sqlite3.OperationalError:
                    pass
                raise

        return {"parent_id": parent_id, "child_id": child_id, "unlinked": True}

    # ------------------------------------------------------------------ #
    # create_task — insert a new task                                     #
    # ------------------------------------------------------------------ #

    def create_task(
        self,
        title: str,
        body: str = "",
        assignee: str = "",
        priority: int = 0,
        status: str = "triage",
        created_by: str = "dashboard",
        parent_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create a new task and return it.
        
        Optionally link to parent tasks via parent_ids.
        If linked to parents, status is forced to 'todo' (waiting for parents).
        """
        now = int(time.time())
        task_id = f"t_{uuid.uuid4().hex[:12]}"

        # If parents provided, start as 'todo' (blocked by parents)
        if parent_ids:
            status = "todo"

        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                conn.execute(
                    """
                    INSERT INTO tasks (id, title, body, assignee, status, priority,
                                       created_by, created_at, workspace_kind)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scratch')
                    """,
                    (task_id, title, body, assignee, status, priority, created_by, now),
                )

                # Create parent links
                if parent_ids:
                    for pid in parent_ids:
                        # Verify parent exists
                        prow = conn.execute("SELECT id FROM tasks WHERE id = ?", (pid,)).fetchone()
                        if prow:
                            conn.execute(
                                "INSERT OR IGNORE INTO task_links (parent_id, child_id) VALUES (?, ?)",
                                (pid, task_id),
                            )

                payload: dict[str, Any] = {"title": title, "status": status}
                if parent_ids:
                    payload["parent_ids"] = parent_ids
                conn.execute(
                    "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                    "VALUES (?, NULL, 'created', ?, ?)",
                    (task_id, json.dumps(payload, ensure_ascii=False), now),
                )

                conn.execute("COMMIT")
            except Exception:
                try:
                    conn.execute("ROLLBACK")
                except sqlite3.OperationalError:
                    pass
                raise

        card = self._get_card(task_id)
        if parent_ids:
            card["parent_ids"] = parent_ids
        return card

    # ------------------------------------------------------------------ #
    # add_comment — add a comment to a task                               #
    # ------------------------------------------------------------------ #

    def add_comment(
        self,
        task_id: str,
        body: str,
        author: str = "dashboard",
    ) -> dict[str, Any]:
        """Add a comment to a task. Returns the created comment."""
        now = int(time.time())

        with self._connect() as conn:
            row = conn.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

            conn.execute(
                "INSERT INTO task_comments (task_id, author, body, created_at) "
                "VALUES (?, ?, ?, ?)",
                (task_id, author, body, now),
            )

            comment_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

            # Audit event
            conn.execute(
                "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                "VALUES (?, NULL, 'comment', ?, ?)",
                (task_id, json.dumps({"author": author, "body": body[:100]}, ensure_ascii=False), now),
            )

        return {
            "id": comment_id,
            "task_id": task_id,
            "author": author,
            "body": body,
            "created_at": now,
        }

    # ------------------------------------------------------------------ #
    # block_task — mark a task as blocked with a reason                   #
    # ------------------------------------------------------------------ #

    def block_task(self, task_id: str, reason: str) -> dict[str, Any]:
        """Block a task with a reason."""
        now = int(time.time())
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                row = conn.execute("SELECT id, status FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if not row:
                    conn.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

                old_status = row["status"]
                conn.execute("UPDATE tasks SET status = 'blocked' WHERE id = ?", (task_id,))
                conn.execute(
                    "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                    "VALUES (?, NULL, 'blocked', ?, ?)",
                    (task_id, json.dumps({"reason": reason, "old_status": old_status}, ensure_ascii=False), now),
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

        return self._get_card(task_id)

    # ------------------------------------------------------------------ #
    # unblock_task — move a blocked task back to a working status         #
    # ------------------------------------------------------------------ #

    def unblock_task(self, task_id: str, new_status: str = "ready") -> dict[str, Any]:
        """Unblock a task, moving it to the specified status (default: ready)."""
        new_status = new_status.strip().lower()
        if new_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{new_status}'",
            )

        now = int(time.time())
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                row = conn.execute("SELECT id, status FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if not row:
                    conn.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

                old_status = row["status"]
                conn.execute("UPDATE tasks SET status = ? WHERE id = ?", (new_status, task_id))
                conn.execute(
                    "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                    "VALUES (?, NULL, 'unblocked', ?, ?)",
                    (task_id, json.dumps({"old_status": old_status, "new_status": new_status}, ensure_ascii=False), now),
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

        return self._get_card(task_id)

    # ------------------------------------------------------------------ #
    # reclaim_task — force-release claim and reset to ready               #
    # ------------------------------------------------------------------ #

    def reclaim_task(self, task_id: str) -> dict[str, Any]:
        """Claim-lock reset — aborts running worker and sets task to ready."""
        now = int(time.time())
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                row = conn.execute("SELECT id, status, claim_lock FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if not row:
                    conn.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

                conn.execute(
                    "UPDATE tasks SET status = 'ready', claim_lock = NULL, claim_expires = NULL, worker_pid = NULL WHERE id = ?",
                    (task_id,),
                )
                conn.execute(
                    "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                    "VALUES (?, NULL, 'reclaimed', ?, ?)",
                    (task_id, json.dumps({"at": now}, ensure_ascii=False), now),
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

        return self._get_card(task_id)

    # ------------------------------------------------------------------ #
    # assign_task — change the assignee of a task                         #
    # ------------------------------------------------------------------ #

    def assign_task(self, task_id: str, assignee: str) -> dict[str, Any]:
        """Assign a task to a profile/agent."""
        now = int(time.time())
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                row = conn.execute("SELECT id, assignee FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if not row:
                    conn.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

                old_assignee = row["assignee"]
                conn.execute("UPDATE tasks SET assignee = ? WHERE id = ?", (assignee, task_id))
                conn.execute(
                    "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
                    "VALUES (?, NULL, 'assigned', ?, ?)",
                    (task_id, json.dumps({"old": old_assignee, "new": assignee}, ensure_ascii=False), now),
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

        return self._get_card(task_id)

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    def _get_card(self, card_id: str) -> dict[str, Any]:
        """Fetch a single task by id."""
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, title, body, assignee, status, priority, "
                "created_by, created_at, started_at, completed_at, "
                "workspace_kind, workspace_path, claim_lock, claim_expires, "
                "tenant, result, consecutive_failures, last_failure_error, "
                "max_runtime_seconds, last_heartbeat_at, current_run_id, "
                "workflow_template_id, current_step_key, model_override, "
                "max_retries, session_id "
                "FROM tasks WHERE id = ?",
                (card_id,),
            ).fetchone()

            if not row:
                raise HTTPException(status_code=404, detail=f"Card {card_id} not found")

            return dict(row)
