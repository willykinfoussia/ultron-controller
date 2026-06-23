from __future__ import annotations

import asyncio

from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import Settings
from app.core.schemas import StorageAnalyzeQuery, StorageScanQuery
from app.storage_analyzer.analyzer import StorageAnalyzer
from app.utils.safe_path import is_excluded_system_path, validate_scan_path


class StorageService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._analyzer = StorageAnalyzer(cache_ttl_sec=settings.storage_cache_ttl_sec)

    def _validate_params(self, path: str, depth: int, limit: int) -> tuple[str, int, int]:
        try:
            params = StorageScanQuery(path=path, depth=depth, limit=limit)
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid scan parameters: {exc}") from exc

        max_depth = min(self._settings.storage_max_depth, 16)
        max_limit = min(self._settings.storage_max_limit, 100)
        bounded_depth = min(params.depth, max_depth)
        bounded_limit = min(params.limit, max_limit)
        return params.path, bounded_depth, bounded_limit

    def _validate_analyze_params(
        self, path: str, depth: int, limit: int, old_days: int, min_size: int
    ) -> tuple[str, int, int, int, int]:
        try:
            params = StorageAnalyzeQuery(
                path=path, depth=depth, limit=limit, old_days=old_days, min_size=min_size
            )
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid analyze parameters: {exc}") from exc

        max_depth = min(self._settings.storage_max_depth, 16)
        max_limit = min(self._settings.storage_max_limit, 100)
        bounded_depth = min(params.depth, max_depth)
        bounded_limit = min(params.limit, max_limit)
        return params.path, bounded_depth, bounded_limit, params.old_days, params.min_size

    async def scan(self, path: str, depth: int, limit: int) -> dict:
        path_raw, bounded_depth, bounded_limit = self._validate_params(path=path, depth=depth, limit=limit)
        root = validate_scan_path(path_raw, max_length=self._settings.storage_max_path_length)
        if self._settings.storage_exclude_system_paths and is_excluded_system_path(root):
            raise HTTPException(status_code=403, detail="Scanning this system path is not allowed")

        result = await asyncio.to_thread(
            self._analyzer.scan,
            root,
            bounded_depth,
            bounded_limit,
            self._settings.storage_max_entries,
            self._settings.storage_scan_timeout_sec,
            self._settings.storage_follow_symlinks,
            self._settings.storage_exclude_system_paths,
        )
        result["status"] = "partial" if result.get("partial") else "ok"
        return result

    async def analyze(
        self, path: str, depth: int, limit: int, old_days: int, min_size: int
    ) -> dict:
        path_raw, bounded_depth, bounded_limit, bounded_old_days, bounded_min_size = (
            self._validate_analyze_params(
                path=path, depth=depth, limit=limit, old_days=old_days, min_size=min_size
            )
        )
        root = validate_scan_path(path_raw, max_length=self._settings.storage_max_path_length)
        if self._settings.storage_exclude_system_paths and is_excluded_system_path(root):
            raise HTTPException(status_code=403, detail="Scanning this system path is not allowed")

        result = await asyncio.to_thread(
            self._analyzer.analyze,
            root,
            bounded_depth,
            bounded_limit,
            self._settings.storage_max_entries,
            self._settings.storage_scan_timeout_sec,
            self._settings.storage_follow_symlinks,
            self._settings.storage_exclude_system_paths,
            bounded_old_days,
            bounded_min_size,
            self._settings.storage_dup_min_size_bytes,
            self._settings.storage_dup_max_hashes,
            self._settings.storage_analyze_hash_budget_sec,
        )
        result["status"] = "partial" if result.get("partial") else "ok"
        return result

    async def top_folders(self, path: str, depth: int, limit: int) -> dict:
        result = await self.scan(path=path, depth=depth, limit=limit)
        return {
            "status": result["status"],
            "path": result["path"],
            "items": result["top_folders"],
            "meta": {
                "from_cache": result.get("from_cache", False),
                "partial": result.get("partial", False),
                "stop_reason": result.get("stop_reason", ""),
                "entries_visited": result.get("entries_visited", 0),
                "elapsed_ms": result.get("elapsed_ms", 0),
                "generated_at": result.get("generated_at"),
            },
        }

    async def top_files(self, path: str, depth: int, limit: int) -> dict:
        result = await self.scan(path=path, depth=depth, limit=limit)
        return {
            "status": result["status"],
            "path": result["path"],
            "items": result["top_files"],
            "meta": {
                "from_cache": result.get("from_cache", False),
                "partial": result.get("partial", False),
                "stop_reason": result.get("stop_reason", ""),
                "entries_visited": result.get("entries_visited", 0),
                "elapsed_ms": result.get("elapsed_ms", 0),
                "generated_at": result.get("generated_at"),
            },
        }
