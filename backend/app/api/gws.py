"""GWS (Google Workspace) router – upload files to Drive and manage the Hermes folder."""

from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gws", tags=["gws"])

GWS_FOLDER_ID_FILE = Path("/home/opc/ultron-controller/.gws_hermes_folder_id")
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

ALLOWED_EXTENSIONS: set[str] = {
    "xlsx", "xls", "docx", "doc", "pptx", "ppt",
    "txt", "csv", "pdf", "png", "jpg", "jpeg", "gif", "zip",
}

ALLOWED_MIME_TYPES: set[str] = {
    # Excel
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    # Word
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    # PowerPoint
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    # Text / CSV
    "text/plain",
    "text/csv",
    "application/csv",
    # PDF
    "application/pdf",
    # Images
    "image/png",
    "image/jpeg",
    "image/gif",
    # Archive
    "application/zip",
    "application/x-zip-compressed",
}


class UploadResult(BaseModel):
    file_name: str
    drive_link: str
    drive_id: str
    mime_type: str


class HermesFolderInfo(BaseModel):
    folder_id: str
    folder_link: str


def _read_hermes_folder_id() -> str:
    """Read the Hermes Google Drive folder ID from the config file."""
    try:
        text = GWS_FOLDER_ID_FILE.read_text().strip()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail="Hermes GWS folder ID file not found",
        ) from exc
    if not text:
        raise HTTPException(
            status_code=500,
            detail="Hermes GWS folder ID file is empty",
        )
    return text


async def _run_gws(*args: str) -> str:
    """Run a gws CLI command and return stdout. Raises HTTPException on failure."""
    import asyncio

    cmd = ["gws", *args]
    logger.debug("Running gws command: %s", " ".join(cmd))
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        err = stderr.decode(errors="replace").strip()
        logger.error("gws command failed (rc=%d): %s", proc.returncode, err)
        raise HTTPException(
            status_code=502,
            detail=f"gws command failed: {err}",
        )
    return stdout.decode(errors="replace")


@router.post("/upload", response_model=UploadResult)
async def upload_file(file: UploadFile = File(...)) -> UploadResult:
    """Upload a file to the Hermes Google Drive folder and make it shareable."""
    folder_id = _read_hermes_folder_id()

    # Extension validation
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lstrip(".").lower()
    if not ext or ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"File type '.{ext}' is not allowed. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # MIME type validation (if content_type is provided by the client)
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"MIME type '{file.content_type}' is not allowed.",
        )

    # Read file content with size check
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    # Write to a temp file so gws can upload it
    tmp_path: str | None = None
    try:
        suffix = Path(file.filename or "upload").suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # Upload to Google Drive
        upload_stdout = await _run_gws(
            "drive", "files", "create",
            "--parents", folder_id,
            "--upload", tmp_path,
            "--format", "json",
        )

        try:
            upload_data = json.loads(upload_stdout)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"gws upload returned invalid JSON: {upload_stdout[:500]}",
            ) from exc

        # gws may return the file info directly or in a list
        if isinstance(upload_data, list):
            if not upload_data:
                raise HTTPException(status_code=502, detail="gws upload returned empty list")
            upload_data = upload_data[0]

        drive_id = upload_data.get("id") or upload_data.get("fileId")
        if not drive_id:
            raise HTTPException(
                status_code=502,
                detail=f"gws upload response missing file ID: {upload_stdout[:500]}",
            )

        # Make the file shareable (reader for anyone)
        await _run_gws(
            "drive", "permissions", "create",
            "--params", json.dumps({"fileId": drive_id}),
            "--json", json.dumps({"role": "reader", "type": "anyone"}),
        )

        drive_link = upload_data.get("webViewLink") or f"https://drive.google.com/file/d/{drive_id}/view"
        mime_type = upload_data.get("mimeType", file.content_type or "application/octet-stream")

        return UploadResult(
            file_name=file.filename or "unnamed",
            drive_link=drive_link,
            drive_id=drive_id,
            mime_type=mime_type,
        )
    finally:
        # Clean up temp file
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@router.get("/hermes-folder", response_model=HermesFolderInfo)
async def hermes_folder() -> HermesFolderInfo:
    """Return the Hermes Google Drive folder ID and link."""
    folder_id = _read_hermes_folder_id()
    folder_link = f"https://drive.google.com/drive/folders/{folder_id}"
    return HermesFolderInfo(folder_id=folder_id, folder_link=folder_link)
