from __future__ import annotations

import psutil


def get_cpu_usage(include_per_core: bool = False) -> dict:
    usage_percent = psutil.cpu_percent(interval=0.0)
    payload: dict[str, object] = {"usage_percent": usage_percent}
    if include_per_core:
        payload["per_core"] = psutil.cpu_percent(interval=0.0, percpu=True)
    return payload
