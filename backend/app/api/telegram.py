from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


class TelegramSendRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4096)


def _service(request: Request):
    return request.app.state.telegram_client


@router.get("/status")
async def telegram_status(request: Request) -> dict[str, Any]:
    return await _service(request).get_status()


@router.get("/messages")
async def telegram_messages(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    service = _service(request)
    messages = await service.get_bot_messages(limit=limit)
    return {"messages": messages, "count": len(messages)}


@router.post("/send")
async def telegram_send(request: Request, body: TelegramSendRequest) -> dict[str, Any]:
    return await _service(request).send_to_bot(body.text)
