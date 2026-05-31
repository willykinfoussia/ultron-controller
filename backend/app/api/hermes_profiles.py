from fastapi import APIRouter

from app.core.config import get_settings
from app.core.schemas import ContentWrite
from app.services.hermes_profiles import HermesProfilesService

router = APIRouter(prefix="/api/hermes/profiles", tags=["hermes-profiles"])


def _service() -> HermesProfilesService:
    return HermesProfilesService(get_settings())


@router.get("")
async def list_profiles() -> dict:
    return _service().list_profiles()


@router.get("/{name}/soul")
async def read_soul(name: str) -> dict:
    return _service().read_soul(name)


@router.post("/{name}/soul")
async def write_soul(name: str, body: ContentWrite) -> dict:
    return _service().write_soul(name=name, content=body.content, mode=body.mode)


@router.get("/{name}/memories")
async def list_memories(name: str) -> dict:
    return _service().list_memories(name)


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
