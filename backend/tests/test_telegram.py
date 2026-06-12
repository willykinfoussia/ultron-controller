"""
Tests for /api/telegram endpoints (no real Telegram connection required).
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client_no_telegram() -> TestClient:
    os.environ.pop("ULTRON_TELEGRAM_API_ID", None)
    os.environ.pop("ULTRON_TELEGRAM_API_HASH", None)
    os.environ.pop("ULTRON_TELEGRAM_SESSION_STRING", None)
    os.environ.pop("ULTRON_TELEGRAM_BOT_USERNAME", None)
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

    def test_send_when_not_configured(self, client_no_telegram: TestClient):
        resp = client_no_telegram.post("/api/telegram/send", json={"text": "hello"})
        assert resp.status_code == 503

    def test_messages_when_not_configured(self, client_no_telegram: TestClient):
        resp = client_no_telegram.get("/api/telegram/messages")
        assert resp.status_code == 503
