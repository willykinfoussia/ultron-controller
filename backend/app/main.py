from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import logging

logger = logging.getLogger(__name__)

from app.api.health import router as health_router
from app.api.hermes import router as hermes_router
from app.api.hermes_api import router as hermes_api_router
from app.api.hermes_profiles import router as hermes_profiles_router
from app.api.openviking import router as openviking_router
from app.api.search import router as search_router
from app.api.sessions import router as sessions_router
from app.api.storage_routes import router as storage_router
from app.api.system_routes import router as system_router
from app.api.kanban import router as kanban_router
from app.core.config import Settings, get_settings
from app.core.version import get_app_version
from app.services.hermes_api_client import HermesApiClient

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    shared_httpx = httpx.AsyncClient(
        base_url=settings.hermes_api_base_url.rstrip("/"),
        timeout=settings.hermes_api_timeout_sec,
        headers={"Authorization": f"Bearer {settings.hermes_api_key}"},
    )
    app.state.hermes_api_client = HermesApiClient(
        settings, shared_client=shared_httpx
    )
    yield
    await shared_httpx.aclose()


settings = get_settings()
app = FastAPI(title="Ultron Controller", version=get_app_version(), lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all: never leak an unhandled exception as HTML."""
    if isinstance(exc, HTTPException):
        raise exc
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "detail": "An unexpected error occurred. Check server logs.",
        },
    )


app.include_router(health_router)
app.include_router(openviking_router)
app.include_router(hermes_router)
app.include_router(hermes_api_router)
app.include_router(hermes_profiles_router)
app.include_router(sessions_router)
app.include_router(search_router)
app.include_router(system_router)
app.include_router(kanban_router)
app.include_router(storage_router)

@app.get("/api/version", include_in_schema=False)
async def version() -> dict:
    return {"version": get_app_version()}

frontend_dist = settings.frontend_dist
if frontend_dist.exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:  # noqa: ARG001
        index_path = frontend_dist / "index.html"
        return FileResponse(index_path)
else:

    @app.get("/")
    async def root() -> JSONResponse:
        return JSONResponse(
            status_code=200,
            content={
                "name": "Ultron Controller API",
                "message": "Frontend build not found. Build frontend to serve SPA.",
            },
        )
