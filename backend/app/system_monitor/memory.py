from __future__ import annotations

import psutil


def get_memory_usage() -> dict:
    virtual = psutil.virtual_memory()
    return {
        "total": int(virtual.total),
        "used": int(virtual.used),
        "free": int(virtual.available),
        "percent": float(virtual.percent),
    }
