from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.services.kanban_reader import KanbanReader

router = APIRouter(prefix="/api/kanban", tags=["kanban"])


def _reader() -> KanbanReader:
    return KanbanReader(get_settings().kanban_db)


# 1. Global summary -----------------------------------------------------------


@router.get("/summary")
async def kanban_summary() -> dict:
    """Return global kanban metrics."""
    return _reader().get_summary()


# 2. Boards list --------------------------------------------------------------


@router.get("/boards")
async def kanban_boards() -> dict:
    """Return the list of boards with per-status stats."""
    boards = _reader().get_boards()
    return {"boards": boards}


# 3. Board detail -------------------------------------------------------------


@router.get("/boards/{board_id}")
async def kanban_board_detail(
    board_id: str,
    status: str | None = Query(None, description="Filter by task status"),
    assignee: str | None = Query(None, description="Filter by assignee"),
    priority: int | None = Query(None, description="Filter by priority"),
    sort: str = Query("created_at", description="Sort field"),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc"),
    limit: int = Query(50, ge=1, le=100, description="Page size (max 100)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> dict:
    """Return detail for a single board with optional filters."""
    return _reader().get_board_detail(
        board_id=board_id,
        status_filter=status,
        assignee_filter=assignee,
        priority_filter=priority,
        sort=sort,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )


# 4. Agents metrics -----------------------------------------------------------


@router.get("/agents")
async def kanban_agents() -> dict:
    """Return per-agent completion metrics."""
    agents = _reader().get_agents()
    return {"agents": agents}


# 5. Activity feed ------------------------------------------------------------


@router.get("/activity")
async def kanban_activity(
    limit: int = Query(20, ge=1, le=100, description="Page size (max 100)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    type: str | None = Query(None, description="Filter by event type (e.g. created, claimed, completed)"),
    since: int | None = Query(None, description="Only events at or after this Unix timestamp"),
) -> dict:
    """Return the activity feed with pagination."""
    return _reader().get_activity(
        limit=limit,
        offset=offset,
        event_type=type,
        since=since,
    )
