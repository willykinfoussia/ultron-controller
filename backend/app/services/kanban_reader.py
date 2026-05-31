from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException


class KanbanReader:
    """Read-only service to query the Hermes Kanban SQLite database.

    Features:
    - Opens the DB in read-only mode via URI to prevent accidental writes.
    - In-memory TTL cache (10 s) to reduce DB hits on repeated queries.
    - Parameterized queries only (injection-safe).
    - Returns 503 with a clear message when the DB is unavailable.
    """

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_ttl = 10.0  # seconds

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    def _check_db(self) -> None:
        if not self._db_path.exists():
            raise HTTPException(
                status_code=503,
                detail="Kanban database is unavailable", # noqa: E501
            )

    def _connect(self) -> sqlite3.Connection:
        self._check_db()
        uri = f"file:{self._db_path.as_posix()}?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def _cached(self, key: str, fetch_fn) -> Any:
        now = time.monotonic()
        if key in self._cache:
            ts, value = self._cache[key]
            if now - ts < self._cache_ttl:
                return value
        value = fetch_fn()
        self._cache[key] = (now, value)
        return value

    def invalidate_cache(self) -> None:
        self._cache.clear()

    # ------------------------------------------------------------------ #
    # Query methods
    # ------------------------------------------------------------------ #

    def get_summary(self) -> dict[str, Any]:
        """Global kanban metrics."""
        return self._cached("summary", self._fetch_summary)

    def _fetch_summary(self) -> dict[str, Any]:
        with self._connect() as conn:
            total_tasks = conn.execute(
                "SELECT COUNT(*) FROM tasks"
            ).fetchone()[0]

            done_count = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE status = 'done'"
            ).fetchone()[0]

            running_count = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE status = 'running'"
            ).fetchone()[0]

            todo_count = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE status = 'todo'"
            ).fetchone()[0]

            blocked_count = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE status = 'blocked'"
            ).fetchone()[0]

            triage_count = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE status = 'triage'"
            ).fetchone()[0]

            # active_agents: count of distinct assignees among running tasks
            row = conn.execute(
                "SELECT COUNT(DISTINCT assignee) FROM tasks WHERE status = 'running' AND assignee IS NOT NULL AND assignee != ''"
            ).fetchone()
            active_agents = row[0] if row else 0

        completion_rate = round(done_count / total_tasks, 4) if total_tasks > 0 else 0.0

        return {
            "total_boards": 1,          # single-board deployment
            "total_tasks": total_tasks,
            "tasks_by_status": {
                "done": done_count,
                "running": running_count,
                "todo": todo_count,
                "blocked": blocked_count,
                "triage": triage_count,
            },
            "completion_rate": completion_rate,
            "active_agents": active_agents,
            "blocked_count": blocked_count,
        }

    def get_boards(self) -> list[dict[str, Any]]:
        """List boards (one board in v1) with per-status stats."""
        return self._cached("boards", self._fetch_boards)

    def _fetch_boards(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    status,
                    COUNT(*) AS count
                FROM tasks
                GROUP BY status
                ORDER BY count DESC
                """
            ).fetchall()
            total = sum(r["count"] for r in rows)

        status_map = {r["status"]: r["count"] for r in rows}

        return [
            {
                "board_id": "default",
                "board_name": "Kanban Board",
                "total_tasks": total,
                "statuses": [
                    {"status": status, "count": count}
                    for status, count in status_map.items()
                ],
                "done": status_map.get("done", 0),
                "running": status_map.get("running", 0),
                "todo": status_map.get("todo", 0),
                "blocked": status_map.get("blocked", 0),
                "triage": status_map.get("triage", 0),
            }
        ]

    def get_board_detail(
        self,
        board_id: str,
        status_filter: str | None = None,
        assignee_filter: str | None = None,
        priority_filter: int | None = None,
        sort: str = "created_at",
        sort_dir: str = "desc",
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Detail of a single board with optional filters and pagination."""
        # In v1 there is a single board
        if board_id != "default":
            raise HTTPException(status_code=404, detail="Board not found")

        # Whitelist sort columns to prevent injection
        allowed_sort = {"created_at", "updated_at", "started_at", "priority", "status", "title"}
        if sort not in allowed_sort:
            sort = "created_at"
        if sort_dir not in ("asc", "desc"):
            sort_dir = "desc"

        # Build the query dynamically with parameterized WHERE clauses
        conditions: list[str] = []
        params: list[Any] = []

        if status_filter:
            conditions.append("status = ?")
            params.append(status_filter)
        if assignee_filter:
            conditions.append("assignee = ?")
            params.append(assignee_filter)
        if priority_filter is not None:
            conditions.append("priority = ?")
            params.append(priority_filter)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        count_sql = f"SELECT COUNT(*) FROM tasks {where_clause}"

        # Order by the whitelisted column
        if sort in ("status", "title", "priority"):
            order_fragment = f"{sort} {sort_dir.upper()}, created_at {sort_dir.upper()}"
        else:
            order_fragment = f"{sort} {sort_dir.upper()}"

        data_sql = f"""
            SELECT
                id, title, body, assignee, status, priority,
                created_by, created_at, started_at, completed_at,
                workspace_kind, tenant, result
            FROM tasks
            {where_clause}
            ORDER BY {order_fragment}
            LIMIT ? OFFSET ?
        """

        with self._connect() as conn:
            total = conn.execute(count_sql, params).fetchone()[0]
            rows = conn.execute(data_sql, params + [limit, offset]).fetchall()

        tasks = [dict(r) for r in rows]

        return {
            "board_id": "default",
            "board_name": "Kanban Board",
            "total": total,
            "limit": limit,
            "offset": offset,
            "filters": {
                "status": status_filter,
                "assignee": assignee_filter,
                "priority": priority_filter,
                "sort": sort,
                "sort_dir": sort_dir,
            },
            "tasks": tasks,
        }

    def get_agents(self) -> list[dict[str, Any]]:
        """Metrics per assignee/profile."""
        return self._cached("agents", self._fetch_agents)

    def _fetch_agents(self) -> list[dict[str, Any]]:
        now = int(time.time())

        day_ago = now - 86400
        week_ago = now - 7 * 86400
        month_ago = now - 30 * 86400

        with self._connect() as conn:
            # All distinct assignees
            assignee_rows = conn.execute(
                """
                SELECT DISTINCT assignee
                FROM tasks
                WHERE assignee IS NOT NULL AND assignee != ''
                ORDER BY assignee
                """
            ).fetchall()
            assignees = [r["assignee"] for r in assignee_rows]

            agents = []
            for assignee in assignees:
                # Active (running) tasks
                active_row = conn.execute(
                    "SELECT COUNT(*) FROM tasks WHERE assignee = ? AND status = 'running'",
                    (assignee,),
                ).fetchone()
                active_count = active_row[0]

                # Completed in last 24h
                d24 = conn.execute(
                    "SELECT COUNT(*) FROM tasks WHERE assignee = ? AND status = 'done' AND completed_at >= ?",
                    (assignee, day_ago),
                ).fetchone()[0]

                # Completed in last 7d
                d7 = conn.execute(
                    "SELECT COUNT(*) FROM tasks WHERE assignee = ? AND status = 'done' AND completed_at >= ?",
                    (assignee, week_ago),
                ).fetchone()[0]

                # Completed in last 30d
                d30 = conn.execute(
                    "SELECT COUNT(*) FROM tasks WHERE assignee = ? AND status = 'done' AND completed_at >= ?",
                    (assignee, month_ago),
                ).fetchone()[0]

                # Total tasks assigned
                total = conn.execute(
                    "SELECT COUNT(*) FROM tasks WHERE assignee = ?",
                    (assignee,),
                ).fetchone()[0]

                agents.append({
                    "assignee": assignee,
                    "total_tasks": total,
                    "active_tasks": active_count,
                    "completed_24h": d24,
                    "completed_7d": d7,
                    "completed_30d": d30,
                })

        return agents

    def get_activity(
        self,
        limit: int = 20,
        offset: int = 0,
        event_type: str | None = None,
        since: int | None = None,
    ) -> dict[str, Any]:
        """Activity feed from task_events, optionally filtered."""
        # Clamp limit
        limit = min(max(limit, 1), 100)

        conditions: list[str] = []
        params: list[Any] = []

        if event_type:
            conditions.append("kind = ?")
            params.append(event_type)
        if since is not None:
            conditions.append("created_at >= ?")
            params.append(since)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        count_sql = f"SELECT COUNT(*) FROM task_events {where_clause}"
        data_sql = f"""
            SELECT
                e.id,
                e.task_id,
                e.run_id,
                e.kind,
                e.payload,
                e.created_at,
                t.title AS task_title,
                t.assignee AS task_assignee,
                t.status AS task_status
            FROM task_events e
            LEFT JOIN tasks t ON t.id = e.task_id
            {where_clause}
            ORDER BY e.created_at DESC
            LIMIT ? OFFSET ?
        """

        with self._connect() as conn:
            total = conn.execute(count_sql, params).fetchone()[0]
            rows = conn.execute(data_sql, params + [limit, offset]).fetchall()

        events = [dict(r) for r in rows]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "filters": {
                "type": event_type,
                "since": since,
            },
            "events": events,
        }
