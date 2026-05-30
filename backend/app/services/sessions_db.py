from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import HTTPException


class SessionsDbService:
    def __init__(self, state_db_path: Path) -> None:
        self._db_path = state_db_path

    def _connect(self) -> sqlite3.Connection:
        if not self._db_path.exists():
            raise HTTPException(status_code=404, detail=f"state.db not found at {self._db_path}")
        uri = f"file:{self._db_path.as_posix()}?mode=ro"
        connection = sqlite3.connect(uri, uri=True)
        connection.row_factory = sqlite3.Row
        return connection

    def list_sessions(self, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        query = """
            SELECT
                id,
                source,
                user_id,
                model,
                title,
                started_at,
                ended_at,
                end_reason,
                message_count,
                tool_call_count,
                input_tokens,
                output_tokens,
                reasoning_tokens,
                estimated_cost_usd,
                actual_cost_usd
            FROM sessions
            ORDER BY started_at DESC
            LIMIT ?
            OFFSET ?
        """
        with self._connect() as conn:
            rows = conn.execute(query, (limit, offset)).fetchall()
        return [dict(row) for row in rows]

    def get_session_messages(self, session_id: str, limit: int = 500, offset: int = 0) -> list[dict[str, Any]]:
        query = """
            SELECT
                id,
                session_id,
                role,
                content,
                tool_call_id,
                tool_calls,
                tool_name,
                timestamp,
                token_count,
                finish_reason,
                reasoning,
                reasoning_content,
                platform_message_id
            FROM messages
            WHERE session_id = ?
            ORDER BY id ASC
            LIMIT ?
            OFFSET ?
        """
        with self._connect() as conn:
            rows = conn.execute(query, (session_id, limit, offset)).fetchall()
            if not rows:
                exists = conn.execute(
                    "SELECT 1 FROM sessions WHERE id = ? LIMIT 1",
                    (session_id,),
                ).fetchone()
                if not exists:
                    raise HTTPException(status_code=404, detail="Session not found")
        return [self._normalize_message(dict(row)) for row in rows]

    def search_messages(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        sql = """
            SELECT
                m.id,
                m.session_id,
                m.role,
                m.content,
                m.timestamp,
                s.title,
                s.model
            FROM messages_fts fts
            JOIN messages m ON m.id = fts.rowid
            LEFT JOIN sessions s ON s.id = m.session_id
            WHERE messages_fts MATCH ?
            ORDER BY bm25(messages_fts) ASC
            LIMIT ?
        """
        with self._connect() as conn:
            try:
                rows = conn.execute(sql, (query, limit)).fetchall()
            except sqlite3.OperationalError:
                fallback = conn.execute(
                    """
                    SELECT
                        m.id,
                        m.session_id,
                        m.role,
                        m.content,
                        m.timestamp,
                        s.title,
                        s.model
                    FROM messages m
                    LEFT JOIN sessions s ON s.id = m.session_id
                    WHERE m.content LIKE ?
                    ORDER BY m.id DESC
                    LIMIT ?
                    """,
                    (f"%{query}%", limit),
                ).fetchall()
                rows = fallback
        return [dict(row) for row in rows]

    def _normalize_message(self, row: dict[str, Any]) -> dict[str, Any]:
        content = row.get("content")
        if isinstance(content, str):
            parsed = _parse_json_if_possible(content)
            if isinstance(parsed, dict) and "parts" in parsed:
                row["content_text"] = _parts_to_text(parsed["parts"])
            elif isinstance(parsed, list):
                row["content_text"] = _parts_to_text(parsed)
            elif isinstance(parsed, dict) and "text" in parsed:
                row["content_text"] = str(parsed.get("text", ""))
            else:
                row["content_text"] = content
        else:
            row["content_text"] = str(content)
        return row


def _parse_json_if_possible(value: str) -> Any:
    stripped = value.strip()
    if not stripped:
        return value
    if not (stripped.startswith("{") or stripped.startswith("[")):
        return value
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return value


def _parts_to_text(parts: Any) -> str:
    if not isinstance(parts, list):
        return str(parts)
    chunks: list[str] = []
    for item in parts:
        if isinstance(item, dict):
            if item.get("type") == "text":
                chunks.append(str(item.get("text", "")))
            elif "text" in item:
                chunks.append(str(item["text"]))
            elif "content" in item:
                chunks.append(str(item["content"]))
        elif isinstance(item, str):
            chunks.append(item)
    return "\n".join(chunk for chunk in chunks if chunk).strip()
