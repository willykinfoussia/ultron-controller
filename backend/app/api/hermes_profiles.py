from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.core.schemas import ContentWrite
from app.services.hermes_profiles import HermesProfilesService

router = APIRouter(prefix="/api/hermes/profiles", tags=["hermes-profiles"])


def _service() -> HermesProfilesService:
    return HermesProfilesService(get_settings())


@router.get("", summary="List agent profiles", description="List agent profiles with optional search and pagination.")
async def list_profiles(
    search: str | None = Query(None, description="Filter profiles by name (case-insensitive substring match)"),
    sort: str = Query("name", description="Sort field: name or memories_count", enum=["name", "memories_count"]),
    sort_dir: str = Query("asc", description="Sort direction: asc or desc", enum=["asc", "desc"]),
    limit: int = Query(50, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> dict:
    return _service().list_profiles(
        search=search, sort=sort, sort_dir=sort_dir, limit=limit, offset=offset
    )


@router.get("/{name}/soul")
async def read_soul(name: str) -> dict:
    return _service().read_soul(name)


@router.post("/{name}/soul")
async def write_soul(name: str, body: ContentWrite) -> dict:
    return _service().write_soul(name=name, content=body.content, mode=body.mode)


@router.get("/{name}/memories", summary="List profile memory files", description="List memory files for a profile with optional search, pagination, and sorting.")
async def list_memories(
    name: str,
    search: str | None = Query(None, description="Filter by filename (case-insensitive substring match)"),
    sort: str = Query("mtime", description="Sort field: name, size, or mtime", enum=["name", "size", "mtime"]),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc", enum=["asc", "desc"]),
    limit: int = Query(50, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> dict:
    return _service().list_memories(
        name, search=search, sort=sort, sort_dir=sort_dir, limit=limit, offset=offset
    )


@router.get("/{name}/memories/{filename}")
async def read_memory(name: str, filename: str) -> dict:
    return _service().read_memory(name, filename)


@router.post("/{name}/memories/{filename}")
async def write_memory(name: str, filename: str, body: ContentWrite) -> dict:
    return _service().write_memory(
        name=name, filename=filename, content=body.content, mode=body.mode
    )


@router.delete("/{name}/memories/{filename}")
async def delete_memory(name: str, filename: str) -> dict:
    return _service().delete_memory(name, filename)
