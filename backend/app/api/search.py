from fastapi import APIRouter

from app.core.config import get_settings
from app.core.schemas import SearchQuery, SessionSearchQuery
from app.services.openviking_client import OpenVikingClient
from app.services.sessions_db import SessionsDbService

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("/openviking")
async def search_openviking(body: SearchQuery) -> dict:
    settings = get_settings()
    client = OpenVikingClient(settings)
    return await client.search(
        query=body.query,
        target_uri=body.target_uri,
        limit=body.limit,
        score_threshold=body.score_threshold,
    )


@router.post("/sessions")
async def search_sessions(body: SessionSearchQuery) -> dict:
    settings = get_settings()
    service = SessionsDbService(settings.state_db_path)
    items = service.search_messages(query=body.query, limit=body.limit)
    return {"items": items}
