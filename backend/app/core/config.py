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
    system_disk_path: str = "/"
    system_cache_ttl_sec: float = 1.5
    system_default_process_limit: int = 20
    system_max_process_limit: int = 100

    storage_scan_timeout_sec: float = 8.0
    storage_max_depth: int = 4
    storage_max_entries: int = 200000
    storage_default_limit: int = 10
    storage_max_limit: int = 50
    storage_cache_ttl_sec: float = 45.0
    storage_follow_symlinks: bool = False
    storage_exclude_system_paths: bool = True
    storage_max_path_length: int = 2048

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
