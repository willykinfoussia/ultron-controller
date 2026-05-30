from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from app.core.config import Settings
from app.utils.paths import safe_join, validate_memory_file, validate_pinned_name


class HermesFilesService:
    def __init__(self, settings: Settings) -> None:
        self._home = settings.hermes_home
        self._memories_dir = settings.memories_dir
        self._pinned_files = set(settings.pinned_files)

    def list_memory_files(self) -> dict:
        files = []
        if self._memories_dir.exists():
            for file_path in sorted(
                self._memories_dir.iterdir(),
                key=lambda item: item.stat().st_mtime,
                reverse=True,
            ):
                if file_path.is_file():
                    try:
                        validate_memory_file(file_path)
                    except HTTPException:
                        continue
                    files.append(
                        {
                            "name": file_path.name,
                            "size": file_path.stat().st_size,
                            "mtime": file_path.stat().st_mtime,
                            "kind": "memory",
                        }
                    )
        return {"dir": str(self._memories_dir), "files": files}

    def list_pinned_files(self) -> dict:
        files = []
        for file_name in sorted(self._pinned_files):
            file_path = self._home / file_name
            files.append(
                {
                    "name": file_name,
                    "exists": file_path.exists(),
                    "size": file_path.stat().st_size if file_path.exists() else 0,
                    "mtime": file_path.stat().st_mtime if file_path.exists() else None,
                    "kind": "pinned",
                }
            )
        return {"dir": str(self._home), "files": files}

    def read_memory_file(self, name: str) -> dict:
        path = safe_join(self._memories_dir, name)
        validate_memory_file(path)
        return self._read_file(path)

    def write_memory_file(self, name: str, content: str, mode: str) -> dict:
        path = safe_join(self._memories_dir, name)
        validate_memory_file(path)
        self._memories_dir.mkdir(parents=True, exist_ok=True)
        self._write(path, content, mode)
        return {"status": "ok", "path": str(path)}

    def delete_memory_file(self, name: str) -> dict:
        path = safe_join(self._memories_dir, name)
        validate_memory_file(path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Not found")
        path.unlink()
        return {"status": "deleted", "path": str(path)}

    def read_pinned_file(self, name: str) -> dict:
        validate_pinned_name(name, self._pinned_files)
        path = self._home / name
        return self._read_file(path)

    def write_pinned_file(self, name: str, content: str, mode: str) -> dict:
        validate_pinned_name(name, self._pinned_files)
        path = self._home / name
        self._home.mkdir(parents=True, exist_ok=True)
        self._write(path, content, mode)
        return {"status": "ok", "path": str(path)}

    def _read_file(self, path: Path) -> dict:
        if not path.exists():
            raise HTTPException(status_code=404, detail="Not found")
        return {
            "name": path.name,
            "content": path.read_text(encoding="utf-8"),
            "path": str(path),
        }

    def _write(self, path: Path, content: str, mode: str) -> None:
        if mode == "append" and path.exists():
            previous = path.read_text(encoding="utf-8")
            path.write_text(previous + content, encoding="utf-8")
            return
        path.write_text(content, encoding="utf-8")
