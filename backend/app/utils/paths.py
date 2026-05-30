from pathlib import Path

from fastapi import HTTPException


ALLOWED_MEMORY_EXTENSIONS = {".md", ".txt", ".json", ".yaml", ".yml"}


def safe_join(base_dir: Path, user_path: str) -> Path:
    candidate = (base_dir / user_path).resolve()
    base_resolved = base_dir.resolve()
    try:
        candidate.relative_to(base_resolved)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Path traversal detected") from exc
    return candidate


def validate_memory_file(path: Path) -> None:
    if path.suffix.lower() not in ALLOWED_MEMORY_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extension not allowed: {path.suffix}",
        )


def validate_pinned_name(file_name: str, allowed_names: set[str]) -> None:
    if file_name not in allowed_names:
        raise HTTPException(status_code=400, detail=f"Unsupported pinned file: {file_name}")
