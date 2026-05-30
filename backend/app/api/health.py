from fastapi import APIRouter

from app.core.config import get_settings
from app.services.openviking_client import OpenVikingClient

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    client = OpenVikingClient(settings)
    try:
        openviking = await client.health()
    except Exception as exc:  # noqa: BLE001
        openviking = {"error": str(exc)}
    return {
        "status": "ok",
        "openviking": openviking,
        "hermes_home": str(settings.hermes_home),
        "memories_dir": str(settings.memories_dir),
        "state_db": str(settings.state_db_path),
    }
