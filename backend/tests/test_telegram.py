"""
Tests for /api/telegram endpoints and media parsing helpers.
"""

from __future__ import annotations

import io
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.datastructures import UploadFile

from app.services.telegram_client_service import TelegramClientService


@pytest.fixture()
def client_no_telegram() -> TestClient:
    os.environ.pop("ULTRON_TELEGRAM_API_ID", None)
    os.environ.pop("ULTRON_TELEGRAM_API_HASH", None)
    os.environ.pop("ULTRON_TELEGRAM_SESSION_STRING", None)
    os.environ.pop("ULTRON_TELEGRAM_BOT_USERNAME", None)
    os.environ.pop("ULTRON_TELEGRAM_MAX_FILE_SIZE_MB", None)
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.main import app

    return TestClient(app, raise_server_exceptions=False)


class TestTelegramStatus:
    def test_status_not_configured(self, client_no_telegram: TestClient):
        resp = client_no_telegram.get("/api/telegram/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["configured"] is False
        assert body["connected"] is False
        assert "missing" in body
        assert body.get("max_file_size_mb") == 25

    def test_send_when_not_configured(self, client_no_telegram: TestClient):
        resp = client_no_telegram.post("/api/telegram/send", json={"text": "hello"})
        assert resp.status_code == 503

    def test_send_multipart_when_not_configured(self, client_no_telegram: TestClient):
        resp = client_no_telegram.post(
            "/api/telegram/send",
            data={"text": "hi"},
            files={"file": ("test.txt", b"hello", "text/plain")},
        )
        assert resp.status_code == 503

    def test_messages_when_not_configured(self, client_no_telegram: TestClient):
        resp = client_no_telegram.get("/api/telegram/messages")
        assert resp.status_code == 503

    def test_media_download_when_not_configured(self, client_no_telegram: TestClient):
        resp = client_no_telegram.get("/api/telegram/messages/1/media")
        assert resp.status_code == 503


class TestExtractMediaInfo:
    def test_no_media(self):
        message = SimpleNamespace(media=None, message="hello")
        info = TelegramClientService.extract_media_info(message)
        assert info["has_media"] is False

    def test_photo_media(self):
        from telethon.tl.types import MessageMediaPhoto

        message = SimpleNamespace(
            media=MessageMediaPhoto(photo=SimpleNamespace()),
            message="",
        )
        info = TelegramClientService.extract_media_info(message)
        assert info["has_media"] is True
        assert info["media_type"] == "photo"

    def test_document_media(self):
        from telethon.tl.types import DocumentAttributeFilename, MessageMediaDocument

        doc = SimpleNamespace(
            mime_type="application/pdf",
            size=12345,
            attributes=[DocumentAttributeFilename(file_name="report.pdf")],
        )
        message = SimpleNamespace(
            media=MessageMediaDocument(document=doc),
            message="See attached",
        )
        info = TelegramClientService.extract_media_info(message)
        assert info["has_media"] is True
        assert info["media_type"] == "document"
        assert info["file_name"] == "report.pdf"
        assert info["file_size"] == 12345

    def test_message_to_dto_media_only(self):
        from telethon.tl.types import MessageMediaPhoto

        message = SimpleNamespace(
            id=42,
            out=True,
            date=None,
            message="",
            media=MessageMediaPhoto(photo=SimpleNamespace()),
        )
        dto = TelegramClientService._message_to_dto(message, bot_id=1)
        assert dto is not None
        assert dto.has_media is True
        assert dto.content == "[Photo]"


class TestSendValidation:
    @pytest.mark.asyncio
    async def test_send_requires_text_or_file(self):
        from app.core.config import Settings

        settings = Settings(
            telegram_api_id=1,
            telegram_api_hash="hash",
            telegram_session_string="session",
            telegram_bot_username="bot",
        )
        service = TelegramClientService(settings)
        service._connected = True
        service._client = MagicMock()
        service._bot_entity = MagicMock()

        with pytest.raises(HTTPException) as exc:
            await service.send_to_bot(None, None)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_disallowed_extension(self):
        from app.core.config import Settings

        settings = Settings(
            telegram_api_id=1,
            telegram_api_hash="hash",
            telegram_session_string="session",
            telegram_bot_username="bot",
        )
        service = TelegramClientService(settings)
        service._connected = True
        service._client = MagicMock()
        service._bot_entity = MagicMock()

        upload = UploadFile(filename="evil.exe", file=io.BytesIO(b"data"))
        with pytest.raises(HTTPException) as exc:
            await service.send_to_bot("caption", upload)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_oversized_file(self):
        from app.core.config import Settings

        settings = Settings(
            telegram_api_id=1,
            telegram_api_hash="hash",
            telegram_session_string="session",
            telegram_bot_username="bot",
            telegram_max_file_size_mb=1,
        )
        service = TelegramClientService(settings)
        service._connected = True
        service._client = MagicMock()
        service._bot_entity = MagicMock()

        big = b"x" * (1024 * 1024 + 1)
        upload = UploadFile(filename="big.txt", file=io.BytesIO(big))
        with pytest.raises(HTTPException) as exc:
            await service.send_to_bot(None, upload)
        assert exc.value.status_code == 413

    @pytest.mark.asyncio
    async def test_send_file_delegates_to_telethon(self):
        from app.core.config import Settings

        settings = Settings(
            telegram_api_id=1,
            telegram_api_hash="hash",
            telegram_session_string="session",
            telegram_bot_username="bot",
        )
        service = TelegramClientService(settings)
        client = MagicMock()
        bot = MagicMock()
        bot.id = 99
        service._connected = True
        service._client = client
        service._bot_entity = bot

        sent_message = SimpleNamespace(
            id=7,
            out=True,
            date=None,
            message="caption",
            media=None,
        )
        client.send_file = AsyncMock(return_value=sent_message)

        upload = UploadFile(filename="note.txt", file=io.BytesIO(b"hello"))
        result = await service.send_to_bot("caption", upload)
        assert result["id"] == 7
        client.send_file.assert_awaited_once()
