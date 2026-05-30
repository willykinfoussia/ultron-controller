from __future__ import annotations

import json
import time
from threading import Lock
from pathlib import Path

from app.storage_analyzer.scanner import scan_directory


class StorageAnalyzer:
    def __init__(self, cache_ttl_sec: float) -> None:
        self._cache_ttl_sec = max(0.0, cache_ttl_sec)
        self._cache: dict[str, tuple[float, dict]] = {}
        self._lock = Lock()

    def _cache_key(self, **kwargs: object) -> str:
        return json.dumps(kwargs, sort_keys=True, ensure_ascii=True)

    def _get_cached(self, key: str) -> dict | None:
        if self._cache_ttl_sec <= 0:
            return None
        with self._lock:
            item = self._cache.get(key)
            if not item:
                return None
            cache_time, payload = item
            if time.time() - cache_time > self._cache_ttl_sec:
                self._cache.pop(key, None)
                return None
            return payload

    def _set_cached(self, key: str, payload: dict) -> dict:
        if self._cache_ttl_sec <= 0:
            return payload
        with self._lock:
            self._cache[key] = (time.time(), payload)
        return payload

    def scan(
        self,
        path: Path,
        depth: int,
        limit: int,
        max_entries: int,
        timeout_sec: float,
        follow_symlinks: bool,
        exclude_system_paths: bool,
    ) -> dict:
        cache_key = self._cache_key(
            path=str(path),
            depth=depth,
            limit=limit,
            max_entries=max_entries,
            timeout_sec=timeout_sec,
            follow_symlinks=follow_symlinks,
            exclude_system_paths=exclude_system_paths,
        )

        cached = self._get_cached(cache_key)
        if cached is not None:
            return {**cached, "from_cache": True}

        result = scan_directory(
            root_path=path,
            max_depth=depth,
            max_entries=max_entries,
            top_n=limit,
            timeout_sec=timeout_sec,
            follow_symlinks=follow_symlinks,
            exclude_system_paths=exclude_system_paths,
        )
        return self._set_cached(cache_key, {**result, "from_cache": False})
