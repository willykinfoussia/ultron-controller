from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings
from app.services.storage_service import StorageService

router = APIRouter(prefix="/api/storage", tags=["storage"])


@lru_cache
def _service() -> StorageService:
    return StorageService(get_settings())


@router.get("/scan")
async def storage_scan(
    path: str = Query(..., min_length=1, max_length=2048),
    depth: int = Query(default=4, ge=1, le=16),
    limit: int = Query(default=10, ge=1, le=100),
) -> dict:
    try:
        return await _service().scan(path=path, depth=depth, limit=limit)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Storage scan failed: {exc}") from exc


@router.get("/top-folders")
async def storage_top_folders(
    path: str = Query(..., min_length=1, max_length=2048),
    depth: int = Query(default=4, ge=1, le=16),
    limit: int = Query(default=10, ge=1, le=100),
) -> dict:
    try:
        return await _service().top_folders(path=path, depth=depth, limit=limit)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Top folders scan failed: {exc}") from exc


@router.get("/top-files")
async def storage_top_files(
    path: str = Query(..., min_length=1, max_length=2048),
    depth: int = Query(default=4, ge=1, le=16),
    limit: int = Query(default=10, ge=1, le=100),
) -> dict:
    try:
        return await _service().top_files(path=path, depth=depth, limit=limit)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Top files scan failed: {exc}") from exc


@router.get("/analyze")
async def storage_analyze(
    path: str = Query(..., min_length=1, max_length=2048),
    depth: int = Query(default=4, ge=1, le=16),
    limit: int = Query(default=20, ge=1, le=100),
    old_days: int = Query(default=180, ge=1, le=3650),
    min_size: int = Query(default=1024 * 1024, ge=0, le=1024 * 1024 * 1024),
) -> dict:
    try:
        return await _service().analyze(
            path=path, depth=depth, limit=limit, old_days=old_days, min_size=min_size
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Storage analyze failed: {exc}") from exc
