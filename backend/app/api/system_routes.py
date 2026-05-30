from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings
from app.core.schemas import SystemProcessesQuery
from app.services.system_service import SystemService

router = APIRouter(prefix="/api/system", tags=["system"])


@lru_cache
def _service() -> SystemService:
    return SystemService(get_settings())


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
