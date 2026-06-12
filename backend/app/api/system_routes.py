from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List, Dict, Any

from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings
from app.core.version import get_app_version
from app.core.schemas import SystemProcessesQuery
from app.services.system_service import SystemService
from app.services.info_service import InfoService

router = APIRouter(prefix="/api/system", tags=["system"])


@lru_cache
def _service() -> SystemService:
    return SystemService(get_settings())


@lru_cache
def _info_service() -> InfoService:
    return InfoService()


@router.get("/cpu")
async def system_cpu() -> dict:
    try:
        return _service().cpu()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"CPU metric failed: {exc}") from exc


@router.get("/memory")
async def system_memory() -> dict:
    try:
        return _service().memory()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Memory metric failed: {exc}") from exc


@router.get("/disk")
async def system_disk() -> dict:
    try:
        return _service().disk()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Disk metric failed: {exc}") from exc


@router.get("/processes")
async def system_processes(
    limit: int = Query(default=20, ge=1, le=100),
    sort: str = Query(default="cpu", pattern="^(cpu|memory)$"),
) -> dict:
    try:
        params = SystemProcessesQuery(limit=limit, sort=sort)
        return _service().processes(limit=params.limit, sort_by=params.sort)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Process metric failed: {exc}") from exc


@router.get("/info")
async def system_info() -> dict:
    """Return Hermes system information: toolsets, skills, version, etc."""
    info_svc = _info_service()
    return {
        "toolsets_enabled": info_svc.get_available_toolsets(),
        "toolsets_available": info_svc.get_all_toolsets_with_status(),
        "skills_user": info_svc.get_user_skills(),
        "skills_builtin": info_svc.get_builtin_skills(),
        "hermes_version": "unknown",  # TODO: get from Hermes manifest
        "ultron_controller_version": get_app_version(),
    }