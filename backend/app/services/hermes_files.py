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

    def _list_directory_files(
        self,
        dir_path: Path,
        *,
        allowed_names: set[str] | None = None,
        default_kind: str = "memory",
        search: str | None = None,
        sort: str = "mtime",
        sort_dir: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Core file listing with filtering, sorting, and pagination."""
        files: list[dict] = []
        if dir_path.exists():
            for file_path in dir_path.iterdir():
                if not file_path.is_file():
                    continue
                if allowed_names is not None and file_path.name not in allowed_names:
                    continue
                try:
                    validate_memory_file(file_path)
                except HTTPException:
                    continue
                # Apply search filter before pagination
                if search and search.lower() not in file_path.name.lower():
                    continue
                stat = file_path.stat()
                files.append(
                    {
                        "name": file_path.name,
                        "size": stat.st_size,
                        "mtime": stat.st_mtime,
                        "kind": default_kind,
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
        return {"dir": str(dir_path), "files": paginated, "total": total, "limit": limit, "offset": offset}

    def _list_pinned_files(
        self,
        *,
        search: str | None = None,
        sort: str = "name",
        sort_dir: str = "asc",
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """List pinned files with filtering, sorting, and pagination."""
        files: list[dict] = []
        for file_name in sorted(self._pinned_files):
            if search and search.lower() not in file_name.lower():
                continue
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

        # Sort pinned: sort by existence first (present before absent), then by field
        reverse = sort_dir == "desc"
        if sort == "name":
            # Pinned files: present first, then alphabetical
            files.sort(
                key=lambda f: (not f["exists"], f["name"].lower()),
                reverse=False,
            )
            if reverse:
                files.reverse()
        elif sort == "size":
            files.sort(key=lambda f: (f["size"] if f["exists"] else -1), reverse=reverse)
        else:  # mtime — None mtime sorts last
            files.sort(
                key=lambda f: (f["mtime"] is None, f["mtime"] or 0),
                reverse=reverse,
            )

        total = len(files)
        paginated = files[offset : offset + limit]
        return {"dir": str(self._home), "files": paginated, "total": total, "limit": limit, "offset": offset}

    def list_memory_files(
        self,
        *,
        search: str | None = None,
        sort: str = "mtime",
        sort_dir: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        return self._list_directory_files(
            self._memories_dir,
            default_kind="memory",
            search=search,
            sort=sort,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )

    def list_pinned_files(
        self,
        *,
        search: str | None = None,
        sort: str = "name",
        sort_dir: str = "asc",
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        return self._list_pinned_files(
            search=search,
            sort=sort,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )

    def search_all_files(self, *, query: str, limit: int = 20) -> dict:
        """Unified search across global memories, pinned files, and profile memories."""
        # Search global memories
        mem_results = self._list_directory_files(
            self._memories_dir,
            default_kind="memory",
            search=query,
            sort="name",
            sort_dir="asc",
            limit=limit,
            offset=0,
        )

        # Search pinned files
        pinned_results = self._list_pinned_files(
            search=query,
            sort="name",
            sort_dir="asc",
            limit=limit,
            offset=0,
        )

        # Search profile memories
        profile_results: list[dict] = []
        profiles_dir = self._home / "profiles"
        if profiles_dir.exists():
            for pdir in sorted(profiles_dir.iterdir()):
                if not pdir.is_dir():
                    continue
                # Check SOUL.md
                soul_path = pdir / "SOUL.md"
                if soul_path.is_file() and query.lower() in "SOUL.md".lower():
                    profile_results.append(
                        {
                            "profile": pdir.name,
                            "name": "SOUL.md",
                            "kind": "soul",
                            "path": str(soul_path),
                        }
                    )
                # Check memory files in profile
                mem_dir = pdir / "memories"
                if mem_dir.exists():
                    for fp in sorted(mem_dir.iterdir()):
                        if not fp.is_file():
                            continue
                        if query.lower() in fp.name.lower():
                            try:
                                validate_memory_file(fp)
                            except HTTPException:
                                continue
                            profile_results.append(
                                {
                                    "profile": pdir.name,
                                    "name": fp.name,
                                    "kind": "memory",
                                    "path": str(fp),
                                }
                            )

        return {
            "query": query,
            "results": {
                "memories": mem_results["files"],
                "pinned": pinned_results["files"],
                "profiles": profile_results[:limit],
            },
            "counts": {
                "memories": len(mem_results["files"]),
                "pinned": len(pinned_results["files"]),
                "profiles": len(profile_results[:limit]),
            },
        }

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
