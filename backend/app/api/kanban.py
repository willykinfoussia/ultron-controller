from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings
from app.services.kanban_reader import KanbanReader
from app.services.kanban_writer import KanbanWriter

router = APIRouter(prefix="/api/kanban", tags=["kanban"])


def _reader() -> KanbanReader:
    return KanbanReader(get_settings().kanban_db)


def _writer() -> KanbanWriter:
    return KanbanWriter(get_settings().kanban_db)


# Allowed statuses for creation
CREATE_STATUSES = {"triage", "todo", "ready", "blocked"}


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


# 6. List cards by status column (for Kanban board) --------------------------


@router.get("/cards")
async def kanban_list_cards(
    status: str = Query(..., description="Status column to filter by"),
    assignee: str | None = Query(None, description="Optional assignee filter"),
    priority: int | None = Query(None, description="Optional priority filter"),
    sort: str = Query("created_at", description="Sort field"),
    sort_dir: str = Query("asc", description="Sort direction: asc or desc"),
    limit: int = Query(50, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> dict:
    """Return cards filtered by status column for the Kanban board."""
    return _reader().get_board_detail(
        board_id="default",
        status_filter=status,
        assignee_filter=assignee,
        priority_filter=priority,
        sort=sort,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )


# 7. Move card -- change a card's status (drag-and-drop) -------------------


@router.patch("/cards/{card_id}")
async def kanban_move_card(
    card_id: str,
    status: str = Query(..., description="New status to move the card to"),
) -> dict:
    """Move a card to a new status column (drag-and-drop)."""
    return _writer().move_card(card_id, status)


# 8. Get single task detail (with runs + comments) --------------------------


@router.get("/tasks/{task_id}")
async def kanban_task_detail(task_id: str) -> dict:
    """Return full task detail including runs and comments."""
    return _reader().get_task_detail(task_id)


# 9. Add comment to task ------------------------------------------------------


@router.post("/tasks/{task_id}/comments")
async def kanban_add_comment(
    task_id: str,
    body: str = Query(..., description="Comment body"),
    author: str = Query("dashboard", description="Comment author"),
) -> dict:
    """Add a comment to a task."""
    return _writer().add_comment(task_id, body, author)


# 10. Create task -------------------------------------------------------------


@router.post("/tasks")
async def kanban_create_task(
    title: str = Query(..., description="Task title"),
    body: str = Query("", description="Task body/description"),
    assignee: str = Query("", description="Assignee profile name"),
    priority: int = Query(0, ge=0, le=3, description="Priority 0-3"),
    status: str = Query("triage", description="Initial status"),
    created_by: str = Query("dashboard", description="Creator identifier"),
    parent_ids: str = Query("", description="Comma-separated parent task IDs"),
) -> dict:
    """Create a new Kanban task."""
    if status not in CREATE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid initial status '{status}'. Must be one of: {sorted(CREATE_STATUSES)}",
        )
    parsed_parents = [p.strip() for p in parent_ids.split(",") if p.strip()] if parent_ids else None
    return _writer().create_task(title, body, assignee, priority, status, created_by, parsed_parents)


# 11. Update task (partial) --------------------------------------------------


@router.patch("/tasks/{task_id}")
async def kanban_update_task(
    task_id: str,
    title: str | None = Query(None, description="New title"),
    body: str | None = Query(None, description="New body"),
    assignee: str | None = Query(None, description="New assignee"),
    priority: int | None = Query(None, ge=0, le=3, description="New priority"),
) -> dict:
    """Partially update a task."""
    return _writer().update_task(task_id, title=title, body=body, assignee=assignee, priority=priority)


# 12. Delete task -------------------------------------------------------------


@router.delete("/tasks/{task_id}")
async def kanban_delete_task(task_id: str) -> dict:
    """Delete a task and all its associated data."""
    return _writer().delete_task(task_id)


# 13. Link tasks (parent/child) ----------------------------------------------


@router.post("/tasks/{parent_id}/link/{child_id}")
async def kanban_link_tasks(parent_id: str, child_id: str) -> dict:
    """Create a parent/child dependency link between two tasks."""
    return _writer().link_tasks(parent_id, child_id)


# 14. Unlink tasks ------------------------------------------------------------


@router.delete("/tasks/{parent_id}/link/{child_id}")
async def kanban_unlink_tasks(parent_id: str, child_id: str) -> dict:
    """Remove a parent/child link."""
    return _writer().unlink_tasks(parent_id, child_id)


# 15. Block task --------------------------------------------------------------


@router.post("/tasks/{task_id}/block")
async def kanban_block_task(
    task_id: str,
    reason: str = Query(..., description="Reason for blocking"),
) -> dict:
    """Block a task with a reason."""
    return _writer().block_task(task_id, reason)


# 16. Unblock task ------------------------------------------------------------


@router.post("/tasks/{task_id}/unblock")
async def kanban_unblock_task(
    task_id: str,
    status: str = Query("ready", description="Status to set after unblocking"),
) -> dict:
    """Unblock a task, moving it to the specified status."""
    return _writer().unblock_task(task_id, status)


# 17. Reclaim task ------------------------------------------------------------


@router.post("/tasks/{task_id}/reclaim")
async def kanban_reclaim_task(task_id: str) -> dict:
    """Force-release claim lock and reset task to ready."""
    return _writer().reclaim_task(task_id)


# 18. Assign task -------------------------------------------------------------


@router.post("/tasks/{task_id}/assign")
async def kanban_assign_task(
    task_id: str,
    assignee: str = Query(..., description="Profile/agent to assign"),
) -> dict:
    """Assign a task to a profile/agent."""
    return _writer().assign_task(task_id, assignee)


# 19. Search tasks ------------------------------------------------------------


@router.get("/search")
async def kanban_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict:
    """Search tasks by title or body content."""
    return _reader().search_tasks(q, limit, offset)
