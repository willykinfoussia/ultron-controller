from __future__ import annotations

from pathlib import Path

EXTENSION_CATEGORIES: dict[str, str] = {
    # Video
    ".mp4": "video",
    ".mkv": "video",
    ".avi": "video",
    ".mov": "video",
    ".wmv": "video",
    ".flv": "video",
    ".webm": "video",
    ".m4v": "video",
    ".mpeg": "video",
    ".mpg": "video",
    # Audio
    ".mp3": "audio",
    ".wav": "audio",
    ".flac": "audio",
    ".aac": "audio",
    ".ogg": "audio",
    ".wma": "audio",
    ".m4a": "audio",
    # Image
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
    ".gif": "image",
    ".bmp": "image",
    ".webp": "image",
    ".svg": "image",
    ".ico": "image",
    ".tiff": "image",
    ".tif": "image",
    ".heic": "image",
    ".raw": "image",
    # Archive
    ".zip": "archive",
    ".rar": "archive",
    ".7z": "archive",
    ".tar": "archive",
    ".gz": "archive",
    ".bz2": "archive",
    ".xz": "archive",
    ".tgz": "archive",
    ".tbz2": "archive",
    # Installer / disk images
    ".exe": "installer",
    ".msi": "installer",
    ".dmg": "installer",
    ".iso": "installer",
    ".deb": "installer",
    ".rpm": "installer",
    ".pkg": "installer",
    ".appimage": "installer",
    # Documents
    ".pdf": "document",
    ".doc": "document",
    ".docx": "document",
    ".xls": "document",
    ".xlsx": "document",
    ".ppt": "document",
    ".pptx": "document",
    ".odt": "document",
    ".ods": "document",
    ".txt": "document",
    ".rtf": "document",
    ".csv": "document",
    # Code
    ".py": "code",
    ".js": "code",
    ".ts": "code",
    ".tsx": "code",
    ".jsx": "code",
    ".java": "code",
    ".c": "code",
    ".cpp": "code",
    ".h": "code",
    ".hpp": "code",
    ".cs": "code",
    ".go": "code",
    ".rs": "code",
    ".rb": "code",
    ".php": "code",
    ".swift": "code",
    ".kt": "code",
    ".scala": "code",
    ".sh": "code",
    ".bash": "code",
    ".ps1": "code",
    ".html": "code",
    ".css": "code",
    ".scss": "code",
    ".json": "code",
    ".yaml": "code",
    ".yml": "code",
    ".xml": "code",
    ".sql": "code",
    # Database
    ".db": "database",
    ".sqlite": "database",
    ".sqlite3": "database",
    ".mdb": "database",
    ".accdb": "database",
    # Cache / logs
    ".log": "cache_log",
    ".tmp": "cache_log",
    ".temp": "cache_log",
    ".bak": "cache_log",
    ".old": "cache_log",
    ".dmp": "cache_log",
    ".crash": "cache_log",
    ".cache": "cache_log",
}

JUNK_DIR_NAMES: frozenset[str] = frozenset(
    {
        "node_modules",
        "__pycache__",
        ".cache",
        ".gradle",
        ".m2",
        "target",
        "build",
        "dist",
        ".next",
        "venv",
        ".venv",
        ".pytest_cache",
        ".mypy_cache",
        "temp",
        "tmp",
        ".npm",
        ".yarn",
        ".pip",
        ".nuget",
        ".tox",
        ".eggs",
        "coverage",
        ".nyc_output",
        ".parcel-cache",
        ".turbo",
        ".vite",
        "bower_components",
        ".sass-cache",
        "$recycle.bin",
        "recycle.bin",
    }
)

JUNK_FILE_SUFFIXES: tuple[str, ...] = (
    ".log",
    ".tmp",
    ".temp",
    ".bak",
    ".old",
    ".dmp",
    ".crash",
    ".swp",
    ".swo",
    "~",
)

CATEGORY_LABELS: dict[str, str] = {
    "video": "Video",
    "audio": "Audio",
    "image": "Image",
    "archive": "Archive",
    "installer": "Installer",
    "document": "Document",
    "code": "Code",
    "database": "Database",
    "cache_log": "Cache / Logs",
    "other": "Other",
}


def categorize(path: str) -> str:
    suffix = Path(path).suffix.lower()
    return EXTENSION_CATEGORIES.get(suffix, "other")


def junk_kind(path: str) -> str | None:
    file_path = Path(path)
    name_lower = file_path.name.lower()

    for suffix in JUNK_FILE_SUFFIXES:
        if name_lower.endswith(suffix):
            return f"temp_file{suffix}"

    for part in file_path.parts:
        if part.lower() in JUNK_DIR_NAMES:
            return f"cache_dir:{part.lower()}"

    return None


def is_junk(path: str) -> bool:
    return junk_kind(path) is not None
