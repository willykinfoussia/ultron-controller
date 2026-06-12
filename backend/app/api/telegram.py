from __future__ import annotations

from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from starlette.datastructures import UploadFile

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


@router.get("/messages/{message_id}/media")
async def telegram_message_media(request: Request, message_id: int) -> Response:
    content, filename, mime_type = await _service(request).download_message_media(message_id)
    safe_name = quote(filename)
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{safe_name}',
    }
    return Response(content=content, media_type=mime_type, headers=headers)


@router.post("/send")
async def telegram_send(request: Request) -> dict[str, Any]:
    service = _service(request)
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        text_val = form.get("text")
        text = str(text_val).strip() if text_val is not None else None
        upload_raw = form.get("file")
        upload: UploadFile | None = None
        if isinstance(upload_raw, UploadFile) and upload_raw.filename:
            upload = upload_raw
        return await service.send_to_bot(text=text, upload=upload)

    try:
        body = TelegramSendRequest.model_validate(await request.json())
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
    return await service.send_to_bot(text=body.text, upload=None)
