from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openviking_endpoint: str = "http://127.0.0.1:1933"
    openviking_api_key: str = ""
    hermes_home: Path = Path.home() / ".hermes"
    memories_dir_name: str = "memories"
    state_db_name: str = "state.db"
    pinned_files: list[str] = ["SOUL.md"]
    cors_allow_origins: list[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
        env_prefix="ULTRON_",
    )

    @property
    def memories_dir(self) -> Path:
        return self.hermes_home / self.memories_dir_name

    @property
    def state_db_path(self) -> Path:
        return self.hermes_home / self.state_db_name

    @property
    def frontend_dist(self) -> Path:
        return Path(__file__).resolve().parents[3] / "frontend" / "dist"


@lru_cache
def get_settings() -> Settings:
    return Settings()
