"""Tests for /api/gws endpoints – hermes-folder, upload validation.

Run with: cd backend && uv run python -m pytest tests/test_gws.py -v
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

FOLDER_ID = "1a2b3c4d5e6f7g8h9j0k"


@pytest.fixture(autouse=True)
def _gws_folder_id_file(tmp_path: Path):
    """Write a valid folder ID file so _read_hermes_folder_id() succeeds."""
    folder_file = tmp_path / ".gws_hermes_folder_id"
    folder_file.write_text(FOLDER_ID, encoding="utf-8")
    # Patch the constant in the gws module to point at our temp file
    with patch("app.api.gws.GWS_FOLDER_ID_FILE", folder_file):
        yield folder_file


@pytest.fixture()
def client() -> TestClient:
    """Build a TestClient with a valid settings env."""
    os.environ.setdefault("ULTRON_HERMES_HOME", "/tmp/hermes-home")
    from app.core.config import get_settings
    get_settings.cache_clear()
    from app.main import app
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# GET /api/gws/hermes-folder – 200
# ---------------------------------------------------------------------------


class TestHermesFolder:
    def test_returns_folder_info_200(self, client: TestClient):
        resp = client.get("/api/gws/hermes-folder")
        assert resp.status_code == 200
        body = resp.json()
        assert body["folder_id"] == FOLDER_ID
        assert FOLDER_ID in body["folder_link"]
        assert body["folder_link"].startswith("https://drive.google.com/drive/folders/")


class TestHermesFolderMissingFile:
    def test_returns_500_when_folder_id_file_missing(self, tmp_path: Path, client: TestClient):
        with patch("app.api.gws.GWS_FOLDER_ID_FILE", tmp_path / "nonexistent"):
            resp = client.get("/api/gws/hermes-folder")
            assert resp.status_code == 500


# ---------------------------------------------------------------------------
# POST /api/gws/upload – oversized → 413
# ---------------------------------------------------------------------------


class TestUploadOversized:
    def test_rejects_file_exceeding_25mb(self, client: TestClient):
        """A file > 25 MB must be rejected with 413."""
        # Send 10 bytes of content with a 1-byte limit to trigger 413
        file_content = b"x" * 10
        with patch("app.api.gws.MAX_FILE_SIZE", 1):  # 1 byte limit for test
            resp = client.post(
                "/api/gws/upload",
                files={"file": ("report.pdf", file_content, "application/pdf")},
            )
            assert resp.status_code == 413
            assert "maximum size" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# POST /api/gws/upload – disallowed type → 415
# ---------------------------------------------------------------------------


class TestUploadDisallowedType:
    def test_rejects_disallowed_extension(self, client: TestClient):
        """Files with extensions not in ALLOWED_EXTENSIONS must be rejected with 415."""
        resp = client.post(
            "/api/gws/upload",
            files={"file": ("malware.exe", b"MZ", "application/x-msdownload")},
        )
        assert resp.status_code == 415
        detail = resp.json()["detail"]
        assert "not allowed" in detail

    def test_rejects_disallowed_mime_type(self, client: TestClient):
        """Even if the extension is allowed, a disallowed MIME type is rejected with 415."""
        resp = client.post(
            "/api/gws/upload",
            files={"file": ("document.pdf", b"%PDF", "application/x-msdownload")},
        )
        assert resp.status_code == 415
        detail = resp.json()["detail"]
        assert "MIME type" in detail

    def test_rejects_no_extension(self, client: TestClient):
        """Files with no extension (e.g. 'Makefile') are rejected with 415."""
        resp = client.post(
            "/api/gws/upload",
            files={"file": ("Makefile", b"all:", "text/plain")},
        )
        assert resp.status_code == 415


# ---------------------------------------------------------------------------
# POST /api/gws/upload – valid file acceptance (mocked gws CLI)
# ---------------------------------------------------------------------------


class TestUploadValidFile:
    def test_accepts_valid_pdf(self, client: TestClient):
        """A valid PDF within size & type limits should reach the gws CLI (mocked)."""
        # Mock _run_gws to return valid JSON for upload + permission steps
        upload_json = json.dumps({
            "id": "file123",
            "webViewLink": "https://drive.google.com/file/d/file123/view",
            "mimeType": "application/pdf",
        })

        async def mock_run_gws(*args: str) -> str:
            # The first call is the upload; second is permissions
            if "permissions" in args:
                return "{}"
            return upload_json

        with patch("app.api.gws._run_gws", new=mock_run_gws):
            resp = client.post(
                "/api/gws/upload",
                files={"file": ("report.pdf", b"%PDF-1.4", "application/pdf")},
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["file_name"] == "report.pdf"
            assert body["drive_id"] == "file123"
            assert "drive.google.com" in body["drive_link"]
            assert body["mime_type"] == "application/pdf"

    def test_accepts_valid_xlsx(self, client: TestClient):
        """A valid XLSX file is accepted."""
        upload_json = json.dumps({
            "id": "sheet456",
            "webViewLink": "https://drive.google.com/file/d/sheet456/view",
            "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })

        async def mock_run_gws(*args: str) -> str:
            if "permissions" in args:
                return "{}"
            return upload_json

        with patch("app.api.gws._run_gws", new=mock_run_gws):
            resp = client.post(
                "/api/gws/upload",
                files={"file": (
                    "data.xlsx",
                    b"PK\x03\x04",  # ZIP/XLSX magic bytes
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )},
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["file_name"] == "data.xlsx"
            assert body["drive_id"] == "sheet456"

    def test_accepts_valid_image(self, client: TestClient):
        """A valid PNG image is accepted."""
        upload_json = json.dumps({
            "id": "img789",
            "webViewLink": "https://drive.google.com/file/d/img789/view",
            "mimeType": "image/png",
        })

        async def mock_run_gws(*args: str) -> str:
            if "permissions" in args:
                return "{}"
            return upload_json

        with patch("app.api.gws._run_gws", new=mock_run_gws):
            resp = client.post(
                "/api/gws/upload",
                files={"file": ("photo.png", b"\x89PNG", "image/png")},
            )
            assert resp.status_code == 200
            assert resp.json()["file_name"] == "photo.png"
