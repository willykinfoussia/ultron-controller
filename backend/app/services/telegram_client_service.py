from __future__ import annotations

import io
import logging
import os
import tempfile
from dataclasses import dataclass
from datetime import timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from telethon import TelegramClient
from telethon.errors import FloodWaitError, RPCError
from telethon.sessions import StringSession
from telethon.tl.types import (
    DocumentAttributeAudio,
    DocumentAttributeFilename,
    DocumentAttributeVideo,
    Message,
    MessageMediaDocument,
    MessageMediaPhoto,
    User,
)

from app.core.config import Settings

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS: set[str] = {
    "xlsx", "xls", "docx", "doc", "pptx", "ppt",
    "txt", "csv", "pdf", "png", "jpg", "jpeg", "gif", "webp", "zip",
    "mp3", "ogg", "wav", "m4a", "mp4", "webm",
}

IMAGE_EXTENSIONS: set[str] = {"png", "jpg", "jpeg", "gif", "webp"}


@dataclass
class TelegramMessageDTO:
    id: int
    role: str
    content: str
    timestamp: str | None
    outgoing: bool
    has_media: bool = False
    media_type: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    drive_links: list[str] | None = None

    def to_dict(self) -> dict[str, Any]:
        result = {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "outgoing": self.outgoing,
            "has_media": self.has_media,
            "media_type": self.media_type,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
        }
        if self.drive_links:
            result["drive_links"] = self.drive_links
        return result


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
    def extract_media_info(message: Message) -> dict[str, Any]:
        """Parse Telethon message media into a plain dict (also used in tests)."""
        if not message.media:
            return {
                "has_media": False,
                "media_type": None,
                "file_name": None,
                "file_size": None,
                "mime_type": None,
            }

        if isinstance(message.media, MessageMediaPhoto):
            return {
                "has_media": True,
                "media_type": "photo",
                "file_name": "photo.jpg",
                "file_size": None,
                "mime_type": "image/jpeg",
            }

        if isinstance(message.media, MessageMediaDocument):
            doc = message.media.document
            mime = getattr(doc, "mime_type", None) or "application/octet-stream"
            size = getattr(doc, "size", None)
            file_name: str | None = None
            media_type = "document"

            for attr in getattr(doc, "attributes", []) or []:
                if isinstance(attr, DocumentAttributeFilename):
                    file_name = attr.file_name
                elif isinstance(attr, DocumentAttributeVideo):
                    media_type = "video"
                elif isinstance(attr, DocumentAttributeAudio):
                    media_type = "voice" if getattr(attr, "voice", False) else "audio"

            if mime.startswith("image/") and media_type == "document":
                media_type = "photo"
            if not file_name:
                ext = mime.split("/")[-1] if "/" in mime else "bin"
                file_name = f"file.{ext}"

            return {
                "has_media": True,
                "media_type": media_type,
                "file_name": file_name,
                "file_size": size,
                "mime_type": mime,
            }

        return {
            "has_media": True,
            "media_type": "unknown",
            "file_name": None,
            "file_size": None,
            "mime_type": None,
        }

    @staticmethod
    def _media_fallback_label(media: dict[str, Any]) -> str:
        media_type = media.get("media_type") or "file"
        file_name = media.get("file_name")
        if media_type == "photo":
            return "[Photo]"
        if file_name:
            return f"[{media_type.capitalize()}: {file_name}]"
        return f"[{media_type.capitalize()}]"

    @classmethod
    def _extract_drive_links(cls, text: str) -> list[str]:
        """Extract Google Drive links from message text."""
        import re
        if not text:
            return []
        # Match various Google Drive URL formats
        pattern = r'https?://drive\.google\.com/[^\s\)\"\']+|https?://docs\.google\.com/[^\s\)\"\']+'
        return list(dict.fromkeys(re.findall(pattern, text)))

    @classmethod
    def _message_to_dto(cls, message: Message, *, bot_id: int) -> TelegramMessageDTO | None:
        del bot_id  # reserved for future role heuristics
        media = cls.extract_media_info(message)
        text = (message.message or "").strip()
        if not text and not media["has_media"]:
            return None

        outgoing = bool(message.out)
        role = "user" if outgoing else "assistant"
        content = text or cls._media_fallback_label(media)
        drive_links = cls._extract_drive_links(text)

        return TelegramMessageDTO(
            id=message.id,
            role=role,
            content=content,
            timestamp=cls._message_timestamp(message),
            outgoing=outgoing,
            has_media=bool(media["has_media"]),
            media_type=media["media_type"],
            file_name=media["file_name"],
            file_size=media["file_size"],
            mime_type=media["mime_type"],
            drive_links=drive_links if drive_links else None,
        )

    def _validate_upload(self, upload: UploadFile) -> tuple[str, str]:
        filename = upload.filename or "upload"
        ext = Path(filename).suffix.lstrip(".").lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type '.{ext}' is not allowed",
            )
        return filename, ext

    async def _read_upload_bounded(self, upload: UploadFile) -> bytes:
        max_bytes = self._settings.telegram_max_file_size_bytes
        chunks: list[bytes] = []
        total = 0
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds {self._settings.telegram_max_file_size_mb} MB limit",
                )
            chunks.append(chunk)
        return b"".join(chunks)

    async def get_status(self) -> dict[str, Any]:
        configured = self.configured
        status: dict[str, Any] = {
            "configured": configured,
            "connected": self._connected,
            "bot_username": self._bot_username,
            "error": self._connect_error,
            "max_file_size_mb": self._settings.telegram_max_file_size_mb,
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

    async def _send_with_telethon(
        self,
        client: TelegramClient,
        bot: User,
        *,
        text: str | None,
        tmp_path: str | None,
        force_document: bool,
    ) -> Message:
        try:
            if tmp_path:
                return await client.send_file(
                    bot,
                    tmp_path,
                    caption=text or None,
                    force_document=force_document,
                )
            return await client.send_message(bot, text or "")
        except FloodWaitError as exc:
            raise HTTPException(
                status_code=429,
                detail=f"Telegram rate limit — retry in {exc.seconds}s",
            ) from exc
        except RPCError as exc:
            raise HTTPException(status_code=502, detail=f"Telegram error: {exc}") from exc

    async def send_to_bot(
        self,
        text: str | None = None,
        upload: UploadFile | None = None,
    ) -> dict[str, Any]:
        client, bot = self._require_ready()
        cleaned = (text or "").strip() or None

        if not cleaned and upload is None:
            raise HTTPException(status_code=400, detail="Message text or file is required")

        tmp_path: str | None = None
        force_document = True
        try:
            if upload is not None and upload.filename:
                filename, ext = self._validate_upload(upload)
                data = await self._read_upload_bounded(upload)
                suffix = Path(filename).suffix or f".{ext}"
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(data)
                    tmp_path = tmp.name
                force_document = ext not in IMAGE_EXTENSIONS

            message = await self._send_with_telethon(
                client,
                bot,
                text=cleaned,
                tmp_path=tmp_path,
                force_document=force_document,
            )
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

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

    async def download_message_media(self, message_id: int) -> tuple[bytes, str, str]:
        client, bot = self._require_ready()

        try:
            message = await client.get_messages(bot, ids=message_id)
        except FloodWaitError as exc:
            raise HTTPException(
                status_code=429,
                detail=f"Telegram rate limit — retry in {exc.seconds}s",
            ) from exc
        except RPCError as exc:
            raise HTTPException(status_code=502, detail=f"Telegram error: {exc}") from exc

        if message is None:
            raise HTTPException(status_code=404, detail="Message not found")

        media = self.extract_media_info(message)
        if not media["has_media"]:
            raise HTTPException(status_code=400, detail="Message has no media attachment")

        buffer = io.BytesIO()
        try:
            await client.download_media(message, file=buffer)
        except FloodWaitError as exc:
            raise HTTPException(
                status_code=429,
                detail=f"Telegram rate limit — retry in {exc.seconds}s",
            ) from exc
        except RPCError as exc:
            raise HTTPException(status_code=502, detail=f"Telegram error: {exc}") from exc

        content = buffer.getvalue()
        if not content:
            raise HTTPException(status_code=502, detail="Failed to download media from Telegram")

        filename = media["file_name"] or f"telegram-{message_id}"
        mime_type = media["mime_type"] or "application/octet-stream"
        return content, filename, mime_type
