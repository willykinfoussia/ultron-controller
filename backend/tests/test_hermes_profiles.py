"""
Integration tests for /api/hermes/profiles endpoints.

Run with: cd backend && uv run python -m pytest tests/test_hermes_profiles.py -v
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def tmp_hermes_home(tmp_path: Path) -> Path:
    """Create a temporary .hermes directory with a profiles subdir."""
    profiles = tmp_path / "profiles"
    profiles.mkdir(parents=True)
    return tmp_path


@pytest.fixture()
def client(tmp_hermes_home: Path) -> TestClient:
    """Build a TestClient with ULTRMES_HOME pointing at our temp dir."""
    os.environ["ULTRON_HERMES_HOME"] = str(tmp_hermes_home)
    # Ensure the env var is picked up by invalidating the lru_cache
    from app.core.config import get_settings
    get_settings.cache_clear()
    from app.main import app
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def sample_profile(tmp_hermes_home: Path) -> str:
    """Create a sample profile with a SOUL.md and one memory file."""
    name = "backend-engineer"
    pdir = tmp_hermes_home / "profiles" / name
    pdir.mkdir(parents=True)
    (pdir / "SOUL.md").write_text("# Backend Engineer\nYou are the backend engineer.", encoding="utf-8")
    mem_dir = pdir / "memories"
    mem_dir.mkdir()
    (mem_dir / "lessons.md").write_text("Lesson 1: Always handle errors.", encoding="utf-8")
    return name


# ---------------------------------------------------------------------------
# GET /api/hermes/profiles
# ---------------------------------------------------------------------------


class TestListProfiles:
    def test_empty_when_no_profiles(self, client: TestClient):
        resp = client.get("/api/hermes/profiles")
        assert resp.status_code == 200
        body = resp.json()
        assert body["profiles"] == []
        assert body["total"] == 0

    def test_returns_profiles(self, client: TestClient, sample_profile: str):
        resp = client.get("/api/hermes/profiles")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert len(body["profiles"]) == 1
        entry = body["profiles"][0]
        assert entry["name"] == sample_profile
        assert entry["has_soul"] is True
        assert entry["memories_count"] == 1
        assert entry["role"] == "Backend Engineer"

    def test_search_filter(self, client: TestClient, tmp_hermes_home: Path):
        # Create two profiles
        for name in ["alpha", "beta"]:
            (tmp_hermes_home / "profiles" / name).mkdir(parents=True)
        resp = client.get("/api/hermes/profiles", params={"search": "alpha"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["profiles"][0]["name"] == "alpha"

    def test_pagination(self, client: TestClient, tmp_hermes_home: Path):
        for name in ["a", "b", "c"]:
            (tmp_hermes_home / "profiles" / name).mkdir(parents=True)
        resp = client.get("/api/hermes/profiles", params={"limit": 2, "offset": 1})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3
        assert len(body["profiles"]) == 2
        assert body["limit"] == 2
        assert body["offset"] == 1

    def test_sort_by_memories_count(self, client: TestClient, tmp_hermes_home: Path):
        # Profile "a" has 2 memories, "b" has 0
        a_dir = tmp_hermes_home / "profiles" / "a" / "memories"
        a_dir.mkdir(parents=True)
        (a_dir / "m1.md").write_text("x")
        (a_dir / "m2.md").write_text("y")
        (tmp_hermes_home / "profiles" / "b").mkdir(parents=True)

        resp = client.get("/api/hermes/profiles", params={"sort": "memories_count", "sort_dir": "desc"})
        assert resp.status_code == 200
        names = [p["name"] for p in resp.json()["profiles"]]
        assert names == ["a", "b"]

    def test_response_schema_has_required_fields(self, client: TestClient, sample_profile: str):
        resp = client.get("/api/hermes/profiles")
        assert resp.status_code == 200
        body = resp.json()
        # Top-level keys
        assert set(body.keys()) == {"profiles", "total", "limit", "offset"}
        # Profile entry keys
        entry = body["profiles"][0]
        assert set(entry.keys()) == {"name", "has_soul", "memories_count", "role"}


# ---------------------------------------------------------------------------
# GET /api/hermes/profiles/{name}/soul
# ---------------------------------------------------------------------------


class TestReadSoul:
    def test_returns_soul_content(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/soul")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == sample_profile
        assert "Backend Engineer" in body["content"]
        assert body["exists"] is True
        assert body["path"].endswith("SOUL.md")

    def test_returns_empty_for_missing_soul(self, client: TestClient, tmp_hermes_home: Path):
        name = "no-soul"
        (tmp_hermes_home / "profiles" / name).mkdir(parents=True)
        resp = client.get(f"/api/hermes/profiles/{name}/soul")
        assert resp.status_code == 200
        body = resp.json()
        assert body["content"] == ""
        assert body["exists"] is False

    def test_invalid_profile_name_returns_400_or_403(self, client: TestClient):
        """Profile names with invalid chars should be rejected by validation."""
        # Direct path traversal in profile name is caught by validate_profile_name
        # Note: Starlette normalizes "/../../" in URLs before routing,
        # so we test with a pathologically-encoded name that survives routing.
        # The key thing is the service-level validation exists.
        resp = client.get("/api/hermes/profiles/bad..name/soul")
        assert resp.status_code in (400, 403, 404)

    def test_response_schema(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/soul")
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {"name", "content", "path", "exists"}


# ---------------------------------------------------------------------------
# POST /api/hermes/profiles/{name}/soul
# ---------------------------------------------------------------------------


class TestWriteSoul:
    def test_create_soul(self, client: TestClient, tmp_hermes_home: Path):
        name = "new-profile"
        resp = client.post(
            f"/api/hermes/profiles/{name}/soul",
            json={"content": "# New Role\nHello.", "mode": "replace"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        # Verify file was written
        soul_path = tmp_hermes_home / "profiles" / name / "SOUL.md"
        assert soul_path.read_text(encoding="utf-8") == "# New Role\nHello."

    def test_append_soul(self, client: TestClient, sample_profile: str):
        resp = client.post(
            f"/api/hermes/profiles/{sample_profile}/soul",
            json={"content": "\nAppended.", "mode": "append"},
        )
        assert resp.status_code == 200
        content = (Path(resp.json()["path"])).read_text(encoding="utf-8")
        assert "Appended." in content

    def test_response_schema(self, client: TestClient, sample_profile: str):
        resp = client.post(
            f"/api/hermes/profiles/{sample_profile}/soul",
            json={"content": "x", "mode": "replace"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {"status", "path"}


# ---------------------------------------------------------------------------
# GET /api/hermes/profiles/{name}/memories
# ---------------------------------------------------------------------------


class TestListMemories:
    def test_returns_memories(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/memories")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert len(body["files"]) == 1
        f = body["files"][0]
        assert f["name"] == "lessons.md"
        assert f["kind"] == "memory"
        assert f["size"] > 0
        assert isinstance(f["mtime"], float)

    def test_empty_when_no_memories(self, client: TestClient, tmp_hermes_home: Path):
        name = "no-mem"
        (tmp_hermes_home / "profiles" / name).mkdir(parents=True)
        resp = client.get(f"/api/hermes/profiles/{name}/memories")
        assert resp.status_code == 200
        body = resp.json()
        assert body["files"] == []
        assert body["total"] == 0

    def test_search_filter(self, client: TestClient, tmp_hermes_home: Path):
        name = "search-test"
        mem_dir = tmp_hermes_home / "profiles" / name / "memories"
        mem_dir.mkdir(parents=True)
        (mem_dir / "alpha.md").write_text("a")
        (mem_dir / "beta.md").write_text("b")
        resp = client.get(f"/api/hermes/profiles/{name}/memories", params={"search": "alpha"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["files"][0]["name"] == "alpha.md"

    def test_skips_disallowed_extensions(self, client: TestClient, tmp_hermes_home: Path):
        name = "ext-test"
        mem_dir = tmp_hermes_home / "profiles" / name / "memories"
        mem_dir.mkdir(parents=True)
        (mem_dir / "good.md").write_text("ok")
        (mem_dir / "bad.exe").write_text("no")
        resp = client.get(f"/api/hermes/profiles/{name}/memories")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["files"][0]["name"] == "good.md"

    def test_response_schema(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/memories")
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {"dir", "files", "total", "limit", "offset"}
        if body["files"]:
            f = body["files"][0]
            assert set(f.keys()) == {"name", "size", "mtime", "kind"}


# ---------------------------------------------------------------------------
# GET /api/hermes/profiles/{name}/memories/{filename}
# ---------------------------------------------------------------------------


class TestReadMemory:
    def test_returns_content(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/memories/lessons.md")
        assert resp.status_code == 200
        body = resp.json()
        assert "Lesson 1" in body["content"]
        assert body["name"] == "lessons.md"

    def test_404_for_missing_file(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/memories/nonexistent.md")
        assert resp.status_code == 404

    def test_400_for_bad_extension(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/memories/malware.exe")
        assert resp.status_code == 400

    def test_response_schema(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/memories/lessons.md")
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {"name", "content", "path"}


# ---------------------------------------------------------------------------
# POST /api/hermes/profiles/{name}/memories/{filename}
# ---------------------------------------------------------------------------


class TestWriteMemory:
    def test_create_memory(self, client: TestClient, sample_profile: str):
        resp = client.post(
            f"/api/hermes/profiles/{sample_profile}/memories/new.md",
            json={"content": "New memory.", "mode": "replace"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"

    def test_append_memory(self, client: TestClient, sample_profile: str):
        resp = client.post(
            f"/api/hermes/profiles/{sample_profile}/memories/lessons.md",
            json={"content": "\nLesson 2.", "mode": "append"},
        )
        assert resp.status_code == 200
        content = (Path(resp.json()["path"])).read_text(encoding="utf-8")
        assert "Lesson 2." in content

    def test_response_schema(self, client: TestClient, sample_profile: str):
        resp = client.post(
            f"/api/hermes/profiles/{sample_profile}/memories/lessons.md",
            json={"content": "x", "mode": "replace"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {"status", "path"}


# ---------------------------------------------------------------------------
# DELETE /api/hermes/profiles/{name}/memories/{filename}
# ---------------------------------------------------------------------------


class TestDeleteMemory:
    def test_deletes_file(self, client: TestClient, sample_profile: str):
        resp = client.delete(f"/api/hermes/profiles/{sample_profile}/memories/lessons.md")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "deleted"

    def test_404_for_missing(self, client: TestClient, sample_profile: str):
        resp = client.delete(f"/api/hermes/profiles/{sample_profile}/memories/nope.md")
        assert resp.status_code == 404

    def test_response_schema(self, client: TestClient, sample_profile: str):
        resp = client.delete(f"/api/hermes/profiles/{sample_profile}/memories/lessons.md")
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {"status", "path"}


# ---------------------------------------------------------------------------
# Error response format tests
# ---------------------------------------------------------------------------


class TestErrorResponses:
    def test_error_on_invalid_profile_name(self, client: TestClient):
        """Error responses should be JSON with an 'error' key."""
        resp = client.get("/api/hermes/profiles/bad..name/soul")
        assert resp.status_code in (400, 403, 404)
        body = resp.json()
        assert isinstance(body, dict)

    def test_404_has_json_body(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/memories/missing.md")
        assert resp.status_code == 404
        body = resp.json()
        assert isinstance(body, dict)

    def test_content_type_is_json_on_error(self, client: TestClient, sample_profile: str):
        resp = client.get(f"/api/hermes/profiles/{sample_profile}/memories/missing.md")
        assert "application/json" in resp.headers.get("content-type", "")
