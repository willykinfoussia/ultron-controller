from __future__ import annotations

import time
from collections.abc import Callable
from threading import Lock

from app.core.config import Settings
from app.system_monitor.cpu import get_cpu_usage
from app.system_monitor.disk import get_disk_usage
from app.system_monitor.memory import get_memory_usage
from app.system_monitor.processes import get_top_processes


class SystemService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._cache_ttl_sec = max(0.0, settings.system_cache_ttl_sec)
        self._cache: dict[str, tuple[float, dict]] = {}
        self._lock = Lock()

    def _get_cached(self, key: str) -> dict | None:
        with self._lock:
            cached = self._cache.get(key)
            if not cached:
                return None
            cache_time, payload = cached
            if time.time() - cache_time > self._cache_ttl_sec:
                self._cache.pop(key, None)
                return None
            return payload

    def _set_cached(self, key: str, payload: dict) -> dict:
        with self._lock:
            self._cache[key] = (time.time(), payload)
        return payload

    def _memoize(self, key: str, fetcher: Callable[[], dict]) -> dict:
        if self._cache_ttl_sec <= 0:
            return fetcher()
        cached = self._get_cached(key)
        if cached is not None:
            return cached
        return self._set_cached(key, fetcher())

    def cpu(self) -> dict:
        return self._memoize("cpu", lambda: get_cpu_usage(include_per_core=False))

    def memory(self) -> dict:
        return self._memoize("memory", get_memory_usage)

    def disk(self) -> dict:
        cache_key = f"disk:{self._settings.system_disk_path}"
        return self._memoize(cache_key, lambda: get_disk_usage(self._settings.system_disk_path))

    def processes(self, limit: int, sort_by: str) -> dict:
        limit = max(1, min(limit, self._settings.system_max_process_limit))
        cache_key = f"proc:{sort_by}:{limit}"
        return self._memoize(cache_key, lambda: get_top_processes(limit=limit, sort_by=sort_by))
