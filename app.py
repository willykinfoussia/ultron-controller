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
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Config
OPENVIKING_ENDPOINT = os.environ.get("OPENVIKING_ENDPOINT", "http://127.0.0.1:1933")
OPENVIKING_API_KEY = os.environ.get("OPENVIKING_API_KEY", "")
HERMES_HOME = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))
HERMES_MEMORY_DIR = HERMES_HOME / "memory"

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

async def ov_delete_req(path: str, params: dict | None = None) -> dict:
    url = f"{OPENVIKING_ENDPOINT}{path}"
    if params:
        sep = "&" if "?" in path else "?"
        url += sep + "&".join(f"{k}={v}" for k, v in params.items())
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.delete(url, headers=_headers())
        r.raise_for_status()
        return r.json()

# Models
class ContentWrite(BaseModel):
    uri: str
    content: str
    mode: str = "replace"

class DirCreate(BaseModel):
    uri: str
    description: str | None = None

class SearchQuery(BaseModel):
    query: str
    target_uri: str = ""
    limit: int = 20
    score_threshold: float | None = None

# App
app = FastAPI(title="Ultron Controller", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/")
async def root():
    return FileResponse(str(Path(__file__).parent / "index.html"))

# Health
@app.get("/api/health")
async def health():
    try:
        h = await ov_get("/health")
    except Exception as e:
        h = {"error": str(e)}
    return {"status": "ok", "openviking": h, "hermes_home": str(HERMES_HOME)}

# ═══ OpenViking — Filesystem ═══

@app.get("/api/ov/ls")
async def ov_ls(uri: str, recursive: bool = False):
    return await ov_get("/api/v1/fs/ls", {"uri": uri, "recursive": str(recursive).lower()})

@app.get("/api/ov/tree")
async def ov_tree(uri: str, level_limit: int = 3):
    return await ov_get("/api/v1/fs/tree", {"uri": uri, "level_limit": level_limit})

@app.get("/api/ov/stat")
async def ov_stat(uri: str):
    return await ov_get("/api/v1/fs/stat", {"uri": uri})

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
    try:
        payload = body.model_dump()
        # If mode is 'replace' and file doesn't exist, try 'create'
        if payload.get("mode") == "replace":
            payload["mode"] = "create"
        result = await ov_post("/api/v1/content/write", payload)
        return result
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/ov/delete")
async def ov_delete(uri: str, recursive: bool = False):
    return await ov_delete_req(path="/api/v1/fs", params={"uri": uri, "recursive": str(recursive).lower()})

@app.post("/api/ov/mkdir")
async def ov_mkdir(body: DirCreate):
    return await ov_post("/api/v1/fs/mkdir", body.model_dump())

@app.post("/api/ov/search")
async def ov_search(body: SearchQuery):
    payload = {"query": body.query, "target_uri": body.target_uri, "limit": body.limit}
    if body.score_threshold is not None:
        payload["score_threshold"] = body.score_threshold
    raw = await ov_post("/api/v1/search/find", payload)
    # Flatten: result is {memories: [...]}, return just the list
    result = raw.get("result", {})
    if isinstance(result, dict):
        items = result.get("memories", result.get("items", []))
    elif isinstance(result, list):
        items = result
    else:
        items = []
    return {"items": items, "status": raw.get("status", "ok")}

# ═══ OpenViking — Sessions ═══

@app.get("/api/ov/sessions")
async def ov_sessions():
    return await ov_get("/api/v1/sessions")

@app.get("/api/ov/sessions/{session_id}")
async def ov_session_messages(session_id: str):
    # Read the session's messages.jsonl and parse it
    uri = f"viking://session/{session_id}/messages.jsonl"
    raw = await ov_get("/api/v1/content/read", {"uri": uri})
    content = raw.get("result", "")
    messages = []
    for line in content.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            # Normalize: extract text content from various formats
            role = msg.get("role", "unknown")
            text = msg.get("content", "")
            if isinstance(text, str):
                text = text.strip()
                # Try to parse as JSON (Hermes stores content as JSON stringified parts)
                if text.startswith("{") or text.startswith("["):
                    try:
                        inner = json.loads(text)
                        if isinstance(inner, dict) and "parts" in inner:
                            parts = inner["parts"]
                            texts = []
                            for p in parts:
                                if isinstance(p, dict):
                                    t = p.get("text", p.get("content", ""))
                                    if t:
                                        texts.append(t)
                            text = "\n".join(texts) if texts else str(inner)[:300]
                        elif isinstance(inner, list):
                            texts = []
                            for block in inner:
                                if isinstance(block, dict) and block.get("type") == "text":
                                    texts.append(block.get("text", ""))
                                elif isinstance(block, str):
                                    texts.append(block)
                            text = "\n".join(texts) if texts else str(inner)[:300]
                        elif isinstance(inner, dict) and "text" in inner:
                            text = inner["text"]
                    except (json.JSONDecodeError, ValueError):
                        pass  # Keep raw text
            elif isinstance(text, list):
                texts = []
                for block in text:
                    if isinstance(block, dict) and block.get("type") == "text":
                        texts.append(block.get("text", ""))
                    elif isinstance(block, str):
                        texts.append(block)
                text = "\n".join(texts) if texts else str(text)[:300]
            if not text:
                # Last resort: check parts field directly on the message
                parts = msg.get("parts", [])
                texts = []
                for p in parts:
                    if isinstance(p, dict):
                        t = p.get("text", p.get("content", ""))
                        if t:
                            texts.append(t)
                text = "\n".join(texts) if texts else json.dumps(msg)[:300]
            messages.append({"role": role, "content": text, "raw": msg})
        except json.JSONDecodeError:
            messages.append({"role": "raw", "content": line[:300]})
    return {"messages": messages, "status": "ok"}

# ═══ Hermes Memory files ═══

SAFE_EXT = {".md", ".txt", ".json", ".yaml", ".yml"}

def _safe_file(name: str) -> Path:
    safe = os.path.basename(name)
    if not safe or safe.startswith("."):
        raise HTTPException(400, "Invalid filename")
    p = HERMES_MEMORY_DIR / safe
    if p.suffix not in SAFE_EXT:
        raise HTTPException(400, f"Extension not allowed: {p.suffix}")
    # Ensure it's inside the memory dir
    try:
        p.resolve().relative_to(HERMES_MEMORY_DIR.resolve())
    except ValueError:
        raise HTTPException(403, "Path traversal detected")
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
