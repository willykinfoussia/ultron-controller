from __future__ import annotations

import logging
import re
from pathlib import Path

from fastapi import HTTPException

logger = logging.getLogger(__name__)

from app.core.config import Settings
from app.utils.paths import (
    ALLOWED_MEMORY_EXTENSIONS,
    validate_memory_file,
    validate_profile_name,
)

_ROLE_RE = re.compile(r"^[ \t]*#\s+(.+)$", re.MULTILINE)


class HermesProfilesService:
    def __init__(self, settings: Settings) -> None:
        self._home = settings.hermes_home
        self._profiles_dir = self._home / "profiles"

    # ── helpers ────────────────────────────────────────────────────────────

    def _profile_dir(self, name: str) -> Path:
        validate_profile_name(name)
        return self._profiles_dir / name

    def _role_from_soul(self, path: Path) -> str | None:
        if not path.exists():
            return None
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return None
        m = _ROLE_RE.search(text)
        return m.group(1).strip() if m else None

    # ── public API ─────────────────────────────────────────────────────────

    def list_profiles(self, *, search: str | None = None, sort: str = "name", sort_dir: str = "asc", limit: int = 50, offset: int = 0) -> dict:
        profiles = []
        try:
            if not self._profiles_dir.exists():
                return {"profiles": [], "total": 0, "limit": limit, "offset": offset}
            entries = list(self._profiles_dir.iterdir())
        except OSError as exc:
            logger.exception("Cannot iterate profiles directory at %s", self._profiles_dir)
            raise
        for entry in sorted(entries, key=lambda e: e.name):
            if not entry.is_dir():
                continue
            name = entry.name
            if search and search.lower() not in name.lower():
                continue
            soul_path = entry / "SOUL.md"
            memories_dir = entry / "memories"
            mem_count = 0
            if memories_dir.is_dir():
                try:
                    for fp in memories_dir.iterdir():
                        if not fp.is_file():
                            continue
                        try:
                            validate_memory_file(fp)
                        except HTTPException:
                            continue
                        mem_count += 1
                except OSError as exc:
                    logger.warning("Cannot iterate memories dir for profile %s: %s", name, exc)
                    # Continue with partial count rather than failing the whole endpoint
            profiles.append(
                {
                    "name": name,
                    "has_soul": soul_path.is_file(),
                    "memories_count": mem_count,
                    "role": self._role_from_soul(soul_path),
                }
            )

        # Sort
        reverse = sort_dir == "desc"
        if sort == "memories_count":
            profiles.sort(key=lambda p: p["memories_count"], reverse=reverse)
        else:  # name
            profiles.sort(key=lambda p: p["name"].lower(), reverse=reverse)

        total = len(profiles)
        paginated = profiles[offset : offset + limit]
        return {"profiles": paginated, "total": total, "limit": limit, "offset": offset}

    def read_soul(self, name: str) -> dict:
        profile_dir = self._profile_dir(name)
        soul_path = profile_dir / "SOUL.md"
        return {
            "name": name,
            "content": soul_path.read_text(encoding="utf-8") if soul_path.exists() else "",
            "path": str(soul_path),
            "exists": soul_path.exists(),
        }

    def write_soul(self, name: str, content: str, mode: str) -> dict:
        profile_dir = self._profile_dir(name)
        soul_path = profile_dir / "SOUL.md"
        profile_dir.mkdir(parents=True, exist_ok=True)
        if mode == "append" and soul_path.exists():
            previous = soul_path.read_text(encoding="utf-8")
            soul_path.write_text(previous + content, encoding="utf-8")
        else:
            soul_path.write_text(content, encoding="utf-8")
        return {"status": "ok", "path": str(soul_path)}

    def list_memories(
        self,
        name: str,
        *,
        search: str | None = None,
        sort: str = "mtime",
        sort_dir: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        profile_dir = self._profile_dir(name)
        mem_dir = profile_dir / "memories"
        files = []
        if mem_dir.exists():
            try:
                entries = list(mem_dir.iterdir())
            except OSError as exc:
                logger.exception("Cannot iterate memories directory at %s", mem_dir)
                raise
            for fp in entries:
                if not fp.is_file():
                    continue
                try:
                    validate_memory_file(fp)
                except HTTPException:
                    continue
                if search and search.lower() not in fp.name.lower():
                    continue
                try:
                    st = fp.stat()
                except OSError as exc:
                    logger.warning("Cannot stat memory file %s: %s", fp, exc)
                    continue
                files.append(
                    {
                        "name": fp.name,
                        "size": st.st_size,
                        "mtime": st.st_mtime,
                        "kind": "memory",
                    }
                )

        # Sort
        reverse = sort_dir == "desc"
        if sort == "name":
            files.sort(key=lambda f: f["name"].lower(), reverse=reverse)
        elif sort == "size":
            files.sort(key=lambda f: f["size"], reverse=reverse)
        else:  # mtime
            files.sort(key=lambda f: f["mtime"], reverse=reverse)

        total = len(files)
        paginated = files[offset : offset + limit]
        return {"dir": str(mem_dir), "files": paginated, "total": total, "limit": limit, "offset": offset}

    def read_memory(self, name: str, filename: str) -> dict:
        profile_dir = self._profile_dir(name)
        mem_dir = profile_dir / "memories"
        path = mem_dir / filename
        try:
            path.relative_to(mem_dir)
        except ValueError:
            raise HTTPException(status_code=403, detail="Path traversal detected")
        validate_memory_file(path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Not found")
        return {
            "name": filename,
            "content": path.read_text(encoding="utf-8", errors="replace"),
            "path": str(path),
        }

    def write_memory(self, name: str, filename: str, content: str, mode: str) -> dict:
        profile_dir = self._profile_dir(name)
        mem_dir = profile_dir / "memories"
        mem_dir.mkdir(parents=True, exist_ok=True)
        path = mem_dir / filename
        try:
            path.relative_to(mem_dir)
        except ValueError:
            raise HTTPException(status_code=403, detail="Path traversal detected")
        validate_memory_file(path)
        if mode == "append" and path.exists():
            previous = path.read_text(encoding="utf-8")
            path.write_text(previous + content, encoding="utf-8")
        else:
            path.write_text(content, encoding="utf-8")
        return {"status": "ok", "path": str(path)}

    def delete_memory(self, name: str, filename: str) -> dict:
        profile_dir = self._profile_dir(name)
        mem_dir = profile_dir / "memories"
        path = mem_dir / filename
        try:
            path.relative_to(mem_dir)
        except ValueError:
            raise HTTPException(status_code=403, detail="Path traversal detected")
        validate_memory_file(path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Not found")
        path.unlink()
        return {"status": "deleted", "path": str(path)}
