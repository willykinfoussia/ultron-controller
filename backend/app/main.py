from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.api.hermes import router as hermes_router
from app.api.openviking import router as openviking_router
from app.api.search import router as search_router
from app.api.sessions import router as sessions_router
from app.core.config import get_settings

settings = get_settings()
app = FastAPI(title="Ultron Controller", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(openviking_router)
app.include_router(hermes_router)
app.include_router(sessions_router)
app.include_router(search_router)

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
