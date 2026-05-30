from __future__ import annotations

from pathlib import Path

import psutil


def get_disk_usage(path: str) -> dict:
    normalized_path = str(Path(path))
    usage = psutil.disk_usage(normalized_path)
    return {
        "path": normalized_path,
        "total": int(usage.total),
        "used": int(usage.used),
        "free": int(usage.free),
        "percent": float(usage.percent),
    }
