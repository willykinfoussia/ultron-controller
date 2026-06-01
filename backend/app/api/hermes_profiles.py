from __future__ import annotations

import logging
from typing import Any, NoReturn

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.schemas import ContentWrite
from app.services.hermes_profiles import HermesProfilesService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hermes/profiles", tags=["hermes-profiles"])


# ── Pydantic response models ─────────────────────────────────────────────────


class ProfileEntry(BaseModel):
    name: str
    has_soul: bool
    memories_count: int
    role: str | None = None


class ProfileListResponse(BaseModel):
    profiles: list[ProfileEntry]
    total: int
    limit: int
    offset: int


class SoulResponse(BaseModel):
    name: str
    content: str
    path: str
    exists: bool


class MemoryFileEntry(BaseModel):
    name: str
    size: int
    mtime: float
    kind: str


class MemoryListResponse(BaseModel):
    dir: str
    files: list[MemoryFileEntry]
    total: int
    limit: int
    offset: int


class MemoryReadResponse(BaseModel):
    name: str
    content: str
    path: str


class WriteResponse(BaseModel):
    status: str
    path: str


class DeleteResponse(BaseModel):
    status: str
    path: str


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None


# ── helpers ──────────────────────────────────────────────────────────────────


def _service() -> HermesProfilesService:
    return HermesProfilesService(get_settings())


def _handle_os_error(exc: OSError, context: str) -> NoReturn:
    """Log and re-raise OSError as an HTTPException with a consistent JSON body."""
    logger.exception("Filesystem error in %s", context)
    if isinstance(exc, PermissionError):
        raise HTTPException(
            status_code=403,
            detail={"error": "permission_denied", "detail": exc.strerror or str(exc)},
        ) from exc
    raise HTTPException(
        status_code=500,
        detail={"error": "internal_server_error", "detail": exc.strerror or str(exc)},
    ) from exc


# ── endpoints ─────────────────────────────────────────────────────────────────


@router.get(
    "",
    summary="List agent profiles",
    description="List agent profiles with optional search and pagination.",
    response_model=ProfileListResponse,
    responses={500: {"model": ErrorResponse}},
)
async def list_profiles(
    search: str | None = Query(None, description="Filter profiles by name (case-insensitive substring match)"),
    sort: str = Query("name", description="Sort field: name or memories_count", enum=["name", "memories_count"]),
    sort_dir: str = Query("asc", description="Sort direction: asc or desc", enum=["asc", "desc"]),
    limit: int = Query(50, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> dict[str, Any]:
    try:
        return _service().list_profiles(
            search=search, sort=sort, sort_dir=sort_dir, limit=limit, offset=offset
        )
    except OSError as exc:
        _handle_os_error(exc, "list_profiles")


@router.get(
    "/{name}/soul",
    response_model=SoulResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def read_soul(name: str) -> dict[str, Any]:
    try:
        return _service().read_soul(name)
    except OSError as exc:
        _handle_os_error(exc, "read_soul")


@router.post(
    "/{name}/soul",
    response_model=WriteResponse,
    responses={403: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def write_soul(name: str, body: ContentWrite) -> dict[str, Any]:
    try:
        return _service().write_soul(name=name, content=body.content, mode=body.mode)
    except OSError as exc:
        _handle_os_error(exc, "write_soul")


@router.get(
    "/{name}/memories",
    summary="List profile memory files",
    description="List memory files for a profile with optional search, pagination, and sorting.",
    response_model=MemoryListResponse,
    responses={403: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def list_memories(
    name: str,
    search: str | None = Query(None, description="Filter by filename (case-insensitive substring match)"),
    sort: str = Query("mtime", description="Sort field: name, size, or mtime", enum=["name", "size", "mtime"]),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc", enum=["asc", "desc"]),
    limit: int = Query(50, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> dict[str, Any]:
    try:
        return _service().list_memories(
            name, search=search, sort=sort, sort_dir=sort_dir, limit=limit, offset=offset
        )
    except OSError as exc:
        _handle_os_error(exc, "list_memories")


@router.get(
    "/{name}/memories/{filename}",
    response_model=MemoryReadResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def read_memory(name: str, filename: str) -> dict[str, Any]:
    try:
        return _service().read_memory(name, filename)
    except OSError as exc:
        _handle_os_error(exc, "read_memory")


@router.post(
    "/{name}/memories/{filename}",
    response_model=WriteResponse,
    responses={403: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def write_memory(name: str, filename: str, body: ContentWrite) -> dict[str, Any]:
    try:
        return _service().write_memory(
            name=name, filename=filename, content=body.content, mode=body.mode
        )
    except OSError as exc:
        _handle_os_error(exc, "write_memory")


@router.delete(
    "/{name}/memories/{filename}",
    response_model=DeleteResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def delete_memory(name: str, filename: str) -> dict[str, Any]:
    try:
        return _service().delete_memory(name, filename)
    except OSError as exc:
        _handle_os_error(exc, "delete_memory")
