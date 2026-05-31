from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.core.schemas import ContentWrite
from app.services.hermes_files import HermesFilesService

router = APIRouter(prefix="/api/hermes", tags=["hermes"])

_SORT_FIELDS = {"name", "size", "mtime"}
_SORT_DIRS = {"asc", "desc"}


def _service() -> HermesFilesService:
    return HermesFilesService(get_settings())


@router.get("/files", summary="List memory files", description="List memory files with optional search, pagination, and sorting.")
async def list_memory_files(
    search: str | None = Query(None, description="Filter by filename (case-insensitive substring match)"),
    sort: str = Query("mtime", description="Sort field: name, size, or mtime", enum=["name", "size", "mtime"]),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc", enum=["asc", "desc"]),
    limit: int = Query(50, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> dict:
    return _service().list_memory_files(
        search=search, sort=sort, sort_dir=sort_dir, limit=limit, offset=offset
    )


@router.get("/pinned", summary="List pinned files", description="List pinned files with optional search, pagination, and sorting.")
async def list_pinned_files(
    search: str | None = Query(None, description="Filter by filename (case-insensitive substring match)"),
    sort: str = Query("name", description="Sort field: name, size, or mtime", enum=["name", "size", "mtime"]),
    sort_dir: str = Query("asc", description="Sort direction: asc or desc", enum=["asc", "desc"]),
    limit: int = Query(50, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> dict:
    return _service().list_pinned_files(
        search=search, sort=sort, sort_dir=sort_dir, limit=limit, offset=offset
    )


@router.get("/file/{name}", summary="Read a memory file")
async def read_memory_file(name: str) -> dict:
    return _service().read_memory_file(name)


@router.head("/file/{name}", summary="Get memory file metadata")
async def head_memory_file(name: str) -> dict:
    return _service().read_memory_file(name)


@router.post("/file/{name}", summary="Write or append to a memory file")
async def write_memory_file(name: str, body: ContentWrite) -> dict:
    return _service().write_memory_file(name=name, content=body.content, mode=body.mode)


@router.delete("/file/{name}", summary="Delete a memory file")
async def delete_memory_file(name: str) -> dict:
    return _service().delete_memory_file(name)


@router.get("/pinned/{name}", summary="Read a pinned file")
async def read_pinned_file(name: str) -> dict:
    return _service().read_pinned_file(name)


@router.post("/pinned/{name}", summary="Write or append to a pinned file")
async def write_pinned_file(name: str, body: ContentWrite) -> dict:
    return _service().write_pinned_file(name=name, content=body.content, mode=body.mode)


@router.get("/search", summary="Search across all memory types", description="Unified search across global memories, pinned files, and profile memories.")
async def search_all_files(
    q: str = Query(..., min_length=1, max_length=200, description="Search query (matched against filename, case-insensitive)"),
    limit: int = Query(20, ge=1, le=50, description="Max results per category. Total results may be up to 3x this value."),
) -> dict:
    return _service().search_all_files(query=q, limit=limit)
