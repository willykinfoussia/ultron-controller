from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.core.schemas import DirCreate, OvContentWrite, SearchQuery
from app.services.openviking_client import OpenVikingClient

router = APIRouter(prefix="/api/ov", tags=["openviking"])


def _client() -> OpenVikingClient:
    return OpenVikingClient(get_settings())


@router.get("/ls")
async def ov_ls(uri: str, recursive: bool = False) -> dict:
    return await _client().ls(uri=uri, recursive=recursive)


@router.get("/tree")
async def ov_tree(uri: str, level_limit: int = Query(default=3, ge=1, le=8)) -> dict:
    return await _client().tree(uri=uri, level_limit=level_limit)


@router.get("/stat")
async def ov_stat(uri: str) -> dict:
    return await _client().stat(uri=uri)


@router.get("/read")
async def ov_read(uri: str, raw: bool = False) -> dict:
    return await _client().read(uri=uri, raw=raw)


@router.get("/abstract")
async def ov_abstract(uri: str) -> dict:
    return await _client().abstract(uri=uri)


@router.get("/overview")
async def ov_overview(uri: str) -> dict:
    return await _client().overview(uri=uri)


@router.post("/write")
async def ov_write(body: OvContentWrite) -> dict:
    return await _client().write(uri=body.uri, content=body.content, mode=body.mode)


@router.delete("/delete")
async def ov_delete(uri: str, recursive: bool = False) -> dict:
    return await _client().delete(uri=uri, recursive=recursive)


@router.post("/mkdir")
async def ov_mkdir(body: DirCreate) -> dict:
    return await _client().mkdir(uri=body.uri, description=body.description)


@router.post("/search")
async def ov_search(body: SearchQuery) -> dict:
    return await _client().search(
        query=body.query,
        target_uri=body.target_uri,
        limit=body.limit,
        score_threshold=body.score_threshold,
    )
