from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.services.sessions_db import SessionsDbService

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _service() -> SessionsDbService:
    settings = get_settings()
    return SessionsDbService(settings.state_db_path)


@router.get("")
async def sessions_list(limit: int = Query(default=50, ge=1, le=500), offset: int = 0) -> dict:
    return {"sessions": _service().list_sessions(limit=limit, offset=offset)}


@router.get("/{session_id}")
async def sessions_detail(
    session_id: str,
    limit: int = Query(default=500, ge=1, le=5000),
    offset: int = 0,
) -> dict:
    return {
        "session_id": session_id,
        "messages": _service().get_session_messages(session_id=session_id, limit=limit, offset=offset),
    }
