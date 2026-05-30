from __future__ import annotations


def bytes_to_human(value: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    size = float(max(value, 0))
    idx = 0
    while size >= 1024.0 and idx < len(units) - 1:
        size /= 1024.0
        idx += 1
    return f"{size:.2f} {units[idx]}"
