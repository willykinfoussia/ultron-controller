from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.services.hermes_api_client import HermesApiClient, extract_client_headers

router = APIRouter(prefix="/api/hermes_api", tags=["hermes-api"])

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _client() -> HermesApiClient:
    return HermesApiClient(get_settings())


def _extra(request: Request) -> dict[str, str]:
    return extract_client_headers(request.headers)


# ── Health ────────────────────────────────────────────────────────────────────


@router.get("/health")
async def hermes_health() -> Any:
    return await _client().get("/health")


@router.get("/health/detailed")
async def hermes_health_detailed() -> Any:
    return await _client().get("/health/detailed")


# ── Discovery / capabilities ──────────────────────────────────────────────────


@router.get("/v1/models")
async def hermes_models() -> Any:
    return await _client().get("/v1/models")


@router.get("/v1/capabilities")
async def hermes_capabilities() -> Any:
    return await _client().get("/v1/capabilities")


@router.get("/v1/skills")
async def hermes_skills() -> Any:
    return await _client().get("/v1/skills")


@router.get("/v1/toolsets")
async def hermes_toolsets() -> Any:
    return await _client().get("/v1/toolsets")


# ── Chat Completions (OpenAI-compatible) ──────────────────────────────────────


@router.post("/v1/chat/completions")
async def chat_completions(request: Request) -> Any:
    body: dict = await request.json()
    extra = _extra(request)
    if body.get("stream", False):
        return StreamingResponse(
            _client().stream_post("/v1/chat/completions", body=body, extra=extra),
            media_type="text/event-stream",
            headers=_SSE_HEADERS,
        )
    return await _client().post("/v1/chat/completions", body=body, extra=extra)


# ── Responses API ─────────────────────────────────────────────────────────────


@router.post("/v1/responses")
async def create_response(request: Request) -> Any:
    body: dict = await request.json()
    extra = _extra(request)
    if body.get("stream", False):
        return StreamingResponse(
            _client().stream_post("/v1/responses", body=body, extra=extra),
            media_type="text/event-stream",
            headers=_SSE_HEADERS,
        )
    return await _client().post("/v1/responses", body=body, extra=extra)


@router.get("/v1/responses/{response_id}")
async def get_response(response_id: str) -> Any:
    return await _client().get(f"/v1/responses/{response_id}")


@router.delete("/v1/responses/{response_id}")
async def delete_response(response_id: str) -> Any:
    return await _client().delete(f"/v1/responses/{response_id}")


# ── Runs API ──────────────────────────────────────────────────────────────────


@router.post("/v1/runs")
async def create_run(request: Request) -> Any:
    body: dict = await request.json()
    return await _client().post("/v1/runs", body=body, extra=_extra(request))


@router.get("/v1/runs/{run_id}")
async def get_run(run_id: str) -> Any:
    return await _client().get(f"/v1/runs/{run_id}")


@router.get("/v1/runs/{run_id}/events")
async def run_events(run_id: str, request: Request) -> StreamingResponse:
    return StreamingResponse(
        _client().stream_get(f"/v1/runs/{run_id}/events", extra=_extra(request)),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/v1/runs/{run_id}/stop")
async def stop_run(run_id: str) -> Any:
    return await _client().post(f"/v1/runs/{run_id}/stop")


# ── Jobs API ──────────────────────────────────────────────────────────────────


@router.get("/jobs")
async def list_jobs(limit: int = 100, offset: int = 0) -> Any:
    return await _client().get("/api/jobs", params={"limit": limit, "offset": offset})


@router.post("/jobs")
async def create_job(request: Request) -> Any:
    body: dict = await request.json()
    return await _client().post("/api/jobs", body=body)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str) -> Any:
    return await _client().get(f"/api/jobs/{job_id}")


@router.patch("/jobs/{job_id}")
async def update_job(job_id: str, request: Request) -> Any:
    body: dict = await request.json()
    return await _client().patch(f"/api/jobs/{job_id}", body=body)


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str) -> Any:
    return await _client().delete(f"/api/jobs/{job_id}")


@router.post("/jobs/{job_id}/pause")
async def pause_job(job_id: str) -> Any:
    return await _client().post(f"/api/jobs/{job_id}/pause")


@router.post("/jobs/{job_id}/resume")
async def resume_job(job_id: str) -> Any:
    return await _client().post(f"/api/jobs/{job_id}/resume")


@router.post("/jobs/{job_id}/run")
async def trigger_job(job_id: str) -> Any:
    return await _client().post(f"/api/jobs/{job_id}/run")


# ── Sessions API (Hermes live sessions, NOT local SQLite) ─────────────────────


@router.get("/sessions")
async def list_hermes_sessions(
    limit: int = 50,
    offset: int = 0,
    source: str | None = None,
    include_children: bool = False,
) -> Any:
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if source:
        params["source"] = source
    if include_children:
        params["include_children"] = "true"
    return await _client().get("/api/sessions", params=params)


@router.post("/sessions")
async def create_hermes_session(request: Request) -> Any:
    body: dict = await request.json()
    return await _client().post("/api/sessions", body=body)


@router.get("/sessions/{session_id}")
async def get_hermes_session(session_id: str) -> Any:
    return await _client().get(f"/api/sessions/{session_id}")


@router.patch("/sessions/{session_id}")
async def update_hermes_session(session_id: str, request: Request) -> Any:
    body: dict = await request.json()
    return await _client().patch(f"/api/sessions/{session_id}", body=body)


@router.delete("/sessions/{session_id}")
async def delete_hermes_session(session_id: str) -> Any:
    return await _client().delete(f"/api/sessions/{session_id}")


@router.get("/sessions/{session_id}/messages")
async def get_hermes_session_messages(
    session_id: str, limit: int = 500, offset: int = 0
) -> Any:
    return await _client().get(
        f"/api/sessions/{session_id}/messages",
        params={"limit": limit, "offset": offset},
    )


@router.post("/sessions/{session_id}/fork")
async def fork_hermes_session(session_id: str, request: Request) -> Any:
    body: dict = await request.json()
    return await _client().post(f"/api/sessions/{session_id}/fork", body=body)


@router.post("/sessions/{session_id}/chat")
async def session_chat(session_id: str, request: Request) -> Any:
    body: dict = await request.json()
    return await _client().post(
        f"/api/sessions/{session_id}/chat", body=body, extra=_extra(request)
    )


@router.post("/sessions/{session_id}/chat/stream")
async def session_chat_stream(session_id: str, request: Request) -> StreamingResponse:
    body: dict = await request.json()
    return StreamingResponse(
        _client().stream_post(
            f"/api/sessions/{session_id}/chat/stream",
            body=body,
            extra=_extra(request),
        ),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
