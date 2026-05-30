from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException

SYSTEM_PATH_EXCLUDES_UNIX = ("/proc", "/sys", "/dev")
SYSTEM_PATH_EXCLUDES_WINDOWS = ("C:\\Windows\\System32\\config",)


def validate_scan_path(path: str, max_length: int) -> Path:
    if not path:
        raise HTTPException(status_code=400, detail="path is required")
    if len(path) > max_length:
        raise HTTPException(status_code=400, detail="path exceeds maximum allowed length")

    candidate = Path(path).expanduser().resolve()
    if not candidate.exists():
        raise HTTPException(status_code=404, detail="path not found")
    if not candidate.is_dir():
        raise HTTPException(status_code=400, detail="path must be a directory")
    return candidate


def is_excluded_system_path(path: Path) -> bool:
    resolved = path.resolve()
    value = str(resolved)
    if os.name == "nt":
        lower = value.lower()
        return any(lower.startswith(blocked.lower()) for blocked in SYSTEM_PATH_EXCLUDES_WINDOWS)
    return any(value == blocked or value.startswith(f"{blocked}/") for blocked in SYSTEM_PATH_EXCLUDES_UNIX)
