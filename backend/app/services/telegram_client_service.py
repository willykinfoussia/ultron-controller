from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timezone
from typing import Any

from fastapi import HTTPException
from telethon import TelegramClient
from telethon.errors import FloodWaitError, RPCError
from telethon.sessions import StringSession
from telethon.tl.types import Message, User

from app.core.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class TelegramMessageDTO:
    id: int
    role: str
    content: str
    timestamp: str | None
    outgoing: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "outgoing": self.outgoing,
        }


class TelegramClientService:
    """MTProto user client — sends messages to a Telegram bot as the configured user."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: TelegramClient | None = None
        self._bot_entity: User | None = None
        self._connected = False
        self._connect_error: str | None = None
        self._bot_username: str | None = None

    @property
    def configured(self) -> bool:
        return self._settings.telegram_configured

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def connect_error(self) -> str | None:
        return self._connect_error

    @property
    def bot_username(self) -> str | None:
        return self._bot_username

    async def connect(self) -> None:
        if not self.configured:
            self._connected = False
            self._connect_error = None
            return

        settings = self._settings
        bot_username = settings.telegram_bot_username.lstrip("@").strip()

        client = TelegramClient(
            StringSession(settings.telegram_session_string.strip()),
            settings.telegram_api_id,
            settings.telegram_api_hash.strip(),
        )
        try:
            await client.connect()
            if not await client.is_user_authorized():
                raise RuntimeError(
                    "Telegram session is not authorized — regenerate ULTRON_TELEGRAM_SESSION_STRING"
                )
            bot_entity = await client.get_entity(bot_username)
            if not isinstance(bot_entity, User):
                raise RuntimeError(f"@{bot_username} is not a user/bot entity")
        except Exception as exc:
            await client.disconnect()
            self._client = None
            self._bot_entity = None
            self._connected = False
            self._connect_error = str(exc)
            self._bot_username = None
            logger.warning("Telegram client failed to connect: %s", exc)
            return

        self._client = client
        self._bot_entity = bot_entity
        self._connected = True
        self._connect_error = None
        self._bot_username = bot_username
        logger.info("Telegram client connected (bot @%s)", bot_username)

    async def disconnect(self) -> None:
        if self._client is not None:
            await self._client.disconnect()
        self._client = None
        self._bot_entity = None
        self._connected = False
        self._bot_username = None

    def _require_ready(self) -> tuple[TelegramClient, User]:
        if not self.configured:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Telegram is not configured — set ULTRON_TELEGRAM_API_ID, "
                    "ULTRON_TELEGRAM_API_HASH, ULTRON_TELEGRAM_SESSION_STRING, "
                    "and ULTRON_TELEGRAM_BOT_USERNAME"
                ),
            )
        if not self._connected or self._client is None or self._bot_entity is None:
            detail = self._connect_error or "Telegram client is not connected"
            raise HTTPException(status_code=503, detail=detail)
        return self._client, self._bot_entity

    @staticmethod
    def _message_timestamp(message: Message) -> str | None:
        if message.date is None:
            return None
        dt = message.date
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()

    @staticmethod
    def _message_to_dto(message: Message, *, bot_id: int) -> TelegramMessageDTO | None:
        text = (message.message or "").strip()
        if not text:
            return None
        outgoing = bool(message.out)
        role = "user" if outgoing else "assistant"
        return TelegramMessageDTO(
            id=message.id,
            role=role,
            content=text,
            timestamp=TelegramClientService._message_timestamp(message),
            outgoing=outgoing,
        )

    async def get_status(self) -> dict[str, Any]:
        configured = self.configured
        status: dict[str, Any] = {
            "configured": configured,
            "connected": self._connected,
            "bot_username": self._bot_username,
            "error": self._connect_error,
        }
        if not configured:
            status["missing"] = [
                key
                for key, ok in (
                    ("telegram_api_id", bool(self._settings.telegram_api_id)),
                    ("telegram_api_hash", bool(self._settings.telegram_api_hash.strip())),
                    ("telegram_session_string", bool(self._settings.telegram_session_string.strip())),
                    ("telegram_bot_username", bool(self._settings.telegram_bot_username.strip())),
                )
                if not ok
            ]
        return status

    async def send_to_bot(self, text: str) -> dict[str, Any]:
        client, bot = self._require_ready()
        cleaned = text.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Message text is required")

        try:
            message = await client.send_message(bot, cleaned)
        except FloodWaitError as exc:
            raise HTTPException(
                status_code=429,
                detail=f"Telegram rate limit — retry in {exc.seconds}s",
            ) from exc
        except RPCError as exc:
            raise HTTPException(status_code=502, detail=f"Telegram error: {exc}") from exc

        dto = self._message_to_dto(message, bot_id=bot.id)
        if dto is None:
            return {"id": message.id, "status": "sent"}
        return dto.to_dict()

    async def get_bot_messages(self, *, limit: int = 50) -> list[dict[str, Any]]:
        client, bot = self._require_ready()
        capped = max(1, min(limit, self._settings.telegram_messages_max_limit))

        try:
            rows: list[dict[str, Any]] = []
            async for message in client.iter_messages(bot, limit=capped):
                dto = self._message_to_dto(message, bot_id=bot.id)
                if dto is not None:
                    rows.append(dto.to_dict())
            rows.reverse()
            return rows
        except FloodWaitError as exc:
            raise HTTPException(
                status_code=429,
                detail=f"Telegram rate limit — retry in {exc.seconds}s",
            ) from exc
        except RPCError as exc:
            raise HTTPException(status_code=502, detail=f"Telegram error: {exc}") from exc
