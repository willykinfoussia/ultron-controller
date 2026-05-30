from __future__ import annotations

from collections.abc import Iterable

import psutil

ProcessSort = str


def _iter_processes() -> Iterable[psutil.Process]:
    return psutil.process_iter(
        attrs=["pid", "name", "username", "status", "cpu_percent", "memory_percent"],
        ad_value=None,
    )


def get_top_processes(limit: int, sort_by: ProcessSort = "cpu") -> dict:
    processes: list[dict] = []

    for process in _iter_processes():
        try:
            info = process.info
            processes.append(
                {
                    "pid": int(info.get("pid") or 0),
                    "name": info.get("name") or "<unknown>",
                    "username": info.get("username") or "",
                    "status": info.get("status") or "",
                    "cpu_percent": float(info.get("cpu_percent") or 0.0),
                    "memory_percent": float(info.get("memory_percent") or 0.0),
                }
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    key = "memory_percent" if sort_by == "memory" else "cpu_percent"
    processes.sort(key=lambda row: float(row.get(key, 0.0)), reverse=True)

    return {
        "sort_by": sort_by,
        "count": min(limit, len(processes)),
        "items": processes[:limit],
    }
