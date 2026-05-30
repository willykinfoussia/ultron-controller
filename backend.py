"""
Ultron Controller — Backend API
Manage Hermes Agent memory: OpenViking + Hermes files + Session transcripts
"""
import json
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────────────────────
OPENVIKING_ENDPOINT = os.environ.get("OPENVIKING_ENDPOINT", "http://127.0.0.1:1933")
OPENVIKING_API_KEY = os.environ.get("OPENVIKING_API_KEY", "")
HERMES_HOME = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
HERMES_MEMORY_DIR = HERMES_HOME / "memory"

# ── HTTP helpers ────────────────────────────────────────────────────────────
def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if OPENVIKING_API_KEY:
        h["Authorization"] = f"Bearer {OPENVIKING_API_KEY}"
    return h

async def ov_get(path: str, params: dict | None = None) -> dict:
    url = f"{OPENVIKING_ENDPOINT}{path}"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(url, params=params, headers=_headers())
        r.raise_for_status()
        return r.json()

async def ov_post(path: str, body: dict) -> dict:
    url = f"{OPENVIKING_ENDPOINT}{path}"
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(url, json=body, headers=_headers())
        r.raise_for_status()
        return r.json()

async def ov_delete(path: str, params: dict | None = None) -> dict:
    url = f"{OPENVIKING_ENDPOINT}{path}"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.delete(url, headers=_headers())
        r.raise_for_status()
        return r.json()

# ── Models ──────────────────────────────────────────────────────────────────
class ContentWrite(BaseModel):
    uri: str
    content: str
    mode: str = "replace"  # replace | append

class DirCreate(BaseModel):
    uri: str
    description: str | None = None

class SearchQuery(BaseModel):
    query: str
    target_uri: str = ""
    limit: int = 20
    score_threshold: float | None = None

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Ultron Controller", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Health ──────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    try:
        h = await ov_get("/health")
    except Exception as e:
        h = {"error": str(e)}
    return {"status": "ok", "openviking": h}

# ════════════════════════════════════════════════════════════════════════════
# OpenViking — Filesystem
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/ov/ls")
async def ov_ls(uri: str, recursive: bool = False):
    return await ov_get("/api/v1/fs/ls", {"uri": uri, "recursive": str(recursive).lower()})

@app.get("/api/ov/tree")
async def ov_tree(uri: str, level_limit: int = 3):
    return await ov_get("/api/v1/fs/tree", {"uri": uri, "level_limit": level_limit})

@app.get("/api/ov/stat")
async def ov_stat(uri: str):
    return await ov_get("/api/v1/fs/stat", {"uri": uri})

# ── Content CRUD ───────────────────────────────────────────────────────────

@app.get("/api/ov/read")
async def ov_read(uri: str, raw: bool = False):
    return await ov_get("/api/v1/content/read", {"uri": uri, "raw": str(raw).lower()})

@app.get("/api/ov/abstract")
async def ov_abstract(uri: str):
    return await ov_get("/api/v1/content/abstract", {"uri": uri})

@app.get("/api/ov/overview")
async def ov_overview(uri: str):
    return await ov_get("/api/v1/content/overview", {"uri": uri})

@app.post("/api/ov/write")
async def ov_write(body: ContentWrite):
    return await ov_post("/api/v1/content/write", body.model_dump())

@app.delete("/api/ov/delete")
async def ov_delete(uri: str, recursive: bool = False):
    return await ov_delete("/api/v1/fs", {"uri": uri, "recursive": str(recursive).lower()})

@app.post("/api/ov/mkdir")
async def ov_mkdir(body: DirCreate):
    return await ov_post("/api/v1/fs/mkdir", body.model_dump())

# ── Search ─────────────────────────────────────────────────────────────────

@app.post("/api/ov/search")
async def ov_search(body: SearchQuery):
    return await ov_post("/api/v1/search/find", {
        "query": body.query,
        "target_uri": body.target_uri,
        "limit": body.limit,
        "score_threshold": body.score_threshold,
    })

# ── Sessions ───────────────────────────────────────────────────────────────

@app.get("/api/ov/sessions")
async def ov_sessions():
    return await ov_get("/api/v1/sessions")

@app.get("/api/ov/sessions/{session_id}")
async def ov_session_messages(session_id: str):
    return await ov_get(f"/api/v1/sessions/{session_id}/messages")

# ════════════════════════════════════════════════════════════════════════════
# Hermes Memory files  (~/.hermes/memory/)
# ════════════════════════════════════════════════════════════════════════════

SAFE_EXT = {".md", ".txt", ".json", ".yaml", ".yml"}

def _safe_file(name: str) -> Path:
    safe = os.path.basename(name)
    p = HERMES_MEMORY_DIR / safe
    if p.suffix not in SAFE_EXT:
        raise HTTPException(400, f"Extension not allowed: {p.suffix}")
    return p

@app.get("/api/hermes/files")
async def hermes_list():
    files = []
    if HERMES_MEMORY_DIR.exists():
        for f in sorted(HERMES_MEMORY_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if f.is_file() and f.suffix in SAFE_EXT:
                files.append({"name": f.name, "size": f.stat().st_size, "mtime": f.stat().st_mtime})
    return {"files": files, "dir": str(HERMES_MEMORY_DIR)}

@app.get("/api/hermes/file/{name}")
async def hermes_read(name: str):
    p = _safe_file(name)
    if not p.exists():
        raise HTTPException(404, "Not found")
    return {"name": p.name, "content": p.read_text(encoding="utf-8")}

@app.post("/api/hermes/file/{name}")
async def hermes_write(name: str, body: ContentWrite):
    # body.uri is repurposed as content for hermes files
    p = _safe_file(name)
    HERMES_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    if body.mode == "append" and p.exists():
        p.write_text(p.read_text(encoding="utf-8") + body.content, encoding="utf-8")
    else:
        p.write_text(body.content, encoding="utf-8")
    return {"status": "ok", "path": str(p)}

@app.delete("/api/hermes/file/{name}")
async def hermes_delete(name: str):
    p = _safe_file(name)
    if not p.exists():
        raise HTTPException(404, "Not found")
    p.unlink()
    return {"status": "deleted"}

# ════════════════════════════════════════════════════════════════════════════
# Session Transcripts (SQLite session DB)
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/transcripts")
async def transcripts_list(limit: int = 50, offset: int = 0):
    """List sessions from the Hermes session DB via session_search."""
    import importlib.util, sys
    db_path = HERMES_HOME / "hermes-agent" / "hermes_state.py"
    if not db_path.exists():
        return {"sessions": [], "error": "hermes_state.py not found at " + str(db_path)}
    spec = importlib.util.spec_from_file_location("hermes_state", str(db_path))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["hermes_state"] = mod
    spec.loader.exec_module(mod)
    db = mod.SessionDB()
    sessions = db.get_recent_sessions(limit=limit, offset=offset)
    return {"sessions": json.loads(json.dumps(sessions, default=str))}

@app.get("/api/transcripts/{session_id}")
async def transcript_detail(session_id: str, limit: int = 200):
    import importlib.util, sys
    db_path = HERMES_HOME / "hermes-agent" / "hermes_state.py"
    if not db_path.exists():
        return {"error": "hermes_state.py not found"}
    spec = importlib.util.spec_from_file_location("hermes_state2", str(db_path))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["hermes_state2"] = mod
    spec.loader.exec_module(mod)
    db = mod.SessionDB()
    msgs = db.get_session_messages(session_id=session_id, limit=limit)
    return {"session_id": session_id, "messages": json.loads(json.dumps(msgs, default=str))}
