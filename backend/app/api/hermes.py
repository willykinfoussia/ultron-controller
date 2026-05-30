from fastapi import APIRouter

from app.core.config import get_settings
from app.core.schemas import ContentWrite
from app.services.hermes_files import HermesFilesService

router = APIRouter(prefix="/api/hermes", tags=["hermes"])


def _service() -> HermesFilesService:
    return HermesFilesService(get_settings())


@router.get("/files")
async def list_memory_files() -> dict:
    return _service().list_memory_files()


@router.get("/pinned")
async def list_pinned_files() -> dict:
    return _service().list_pinned_files()


@router.get("/file/{name}")
async def read_memory_file(name: str) -> dict:
    return _service().read_memory_file(name)


@router.post("/file/{name}")
async def write_memory_file(name: str, body: ContentWrite) -> dict:
    return _service().write_memory_file(name=name, content=body.content, mode=body.mode)


@router.delete("/file/{name}")
async def delete_memory_file(name: str) -> dict:
    return _service().delete_memory_file(name)


@router.get("/pinned/{name}")
async def read_pinned_file(name: str) -> dict:
    return _service().read_pinned_file(name)


@router.post("/pinned/{name}")
async def write_pinned_file(name: str, body: ContentWrite) -> dict:
    return _service().write_pinned_file(name=name, content=body.content, mode=body.mode)
