from __future__ import annotations

import json as _json
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import Settings


_HERMES_PASSTHROUGH_HEADERS = (
    "X-Hermes-Session-Id",
    "X-Hermes-Session-Key",
    "Idempotency-Key",
)


class HermesApiClient:
    """Thin async client that proxies requests to the Hermes API Server.

    Accepts a shared httpx.AsyncClient for connection pooling. When a shared
    client is provided, it is NOT owned by this instance (caller is responsible
    for closing it). When no shared client is provided, each call creates its
    own client (backwards-compatible behaviour).
    """

    def __init__(
        self,
        settings: Settings,
        *,
        shared_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base = settings.hermes_api_base_url.rstrip("/")
        self._key = settings.hermes_api_key
        self._timeout = settings.hermes_api_timeout_sec
        self._shared_client = shared_client

    # ── Client acquisition ────────────────────────────────────────────────────

    def _owns_client(self, client: httpx.AsyncClient) -> bool:
        """Return True if *client* was created by us (not the shared pool)."""
        return client is not self._shared_client

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _auth_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h: dict[str, str] = {"Authorization": f"Bearer {self._key}"}
        if extra:
            h.update(extra)
        return h

    def _stream_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        return {**self._auth_headers(extra), "Accept": "text/event-stream"}

    def _url(self, path: str) -> str:
        return f"{self._base}{path}"

    @staticmethod
    def _map_error(exc: httpx.HTTPStatusError) -> HTTPException:
        try:
            detail = exc.response.json().get("detail", exc.response.text)
        except Exception:
            detail = exc.response.text
        return HTTPException(status_code=exc.response.status_code, detail=detail)

    @staticmethod
    def _unavailable(exc: httpx.HTTPError) -> HTTPException:
        return HTTPException(
            status_code=503,
            detail=f"Hermes API Server unavailable — is `hermes gateway` running? ({exc})",
        )

    # ── Non-streaming requests ────────────────────────────────────────────────

    async def get(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        extra: dict[str, str] | None = None,
    ) -> Any:
        if self._shared_client is not None:
            try:
                r = await self._shared_client.get(
                    self._url(path), params=params, headers=self._auth_headers(extra)
                )
                r.raise_for_status()
                return r.json()
            except httpx.HTTPStatusError as exc:
                raise self._map_error(exc) from exc
            except httpx.HTTPError as exc:
                raise self._unavailable(exc) from exc

        # Fallback: create a per-call client (backwards compatible)
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.get(
                    self._url(path), params=params, headers=self._auth_headers(extra)
                )
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as exc:
            raise self._map_error(exc) from exc
        except httpx.HTTPError as exc:
            raise self._unavailable(exc) from exc

    async def post(
        self,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        extra: dict[str, str] | None = None,
    ) -> Any:
        if self._shared_client is not None:
            try:
                r = await self._shared_client.post(
                    self._url(path), json=body, headers=self._auth_headers(extra)
                )
                r.raise_for_status()
                if r.status_code == 204 or not r.content:
                    return {"status": "ok"}
                return r.json()
            except httpx.HTTPStatusError as exc:
                raise self._map_error(exc) from exc
            except httpx.HTTPError as exc:
                raise self._unavailable(exc) from exc

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.post(
                    self._url(path), json=body, headers=self._auth_headers(extra)
                )
            r.raise_for_status()
            if r.status_code == 204 or not r.content:
                return {"status": "ok"}
            return r.json()
        except httpx.HTTPStatusError as exc:
            raise self._map_error(exc) from exc
        except httpx.HTTPError as exc:
            raise self._unavailable(exc) from exc

    async def patch(
        self,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        extra: dict[str, str] | None = None,
    ) -> Any:
        if self._shared_client is not None:
            try:
                r = await self._shared_client.patch(
                    self._url(path), json=body, headers=self._auth_headers(extra)
                )
                r.raise_for_status()
                if r.status_code == 204 or not r.content:
                    return {"status": "ok"}
                return r.json()
            except httpx.HTTPStatusError as exc:
                raise self._map_error(exc) from exc
            except httpx.HTTPError as exc:
                raise self._unavailable(exc) from exc

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.patch(
                    self._url(path), json=body, headers=self._auth_headers(extra)
                )
            r.raise_for_status()
            if r.status_code == 204 or not r.content:
                return {"status": "ok"}
            return r.json()
        except httpx.HTTPStatusError as exc:
            raise self._map_error(exc) from exc
        except httpx.HTTPError as exc:
            raise self._unavailable(exc) from exc

    async def delete(
        self,
        path: str,
        *,
        extra: dict[str, str] | None = None,
    ) -> Any:
        if self._shared_client is not None:
            try:
                r = await self._shared_client.delete(
                    self._url(path), headers=self._auth_headers(extra)
                )
                r.raise_for_status()
                if r.status_code == 204 or not r.content:
                    return {"status": "ok"}
                return r.json()
            except httpx.HTTPStatusError as exc:
                raise self._map_error(exc) from exc
            except httpx.HTTPError as exc:
                raise self._unavailable(exc) from exc

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.delete(self._url(path), headers=self._auth_headers(extra))
            r.raise_for_status()
            if r.status_code == 204 or not r.content:
                return {"status": "ok"}
            return r.json()
        except httpx.HTTPStatusError as exc:
            raise self._map_error(exc) from exc
        except httpx.HTTPError as exc:
            raise self._unavailable(exc) from exc

    # ── Streaming requests ────────────────────────────────────────────────────

    async def stream_get(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        extra: dict[str, str] | None = None,
    ) -> AsyncGenerator[bytes, None]:
        url = self._url(path)
        headers = self._stream_headers(extra)
        try:
            if self._shared_client is not None:
                async with self._shared_client.stream(
                    "GET", url, params=params, headers=headers
                ) as resp:
                    if resp.status_code >= 400:
                        body = await resp.aread()
                        yield _sse_error(body.decode())
                        return
                    async for chunk in resp.aiter_bytes():
                        yield chunk
            else:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    async with client.stream(
                        "GET", url, params=params, headers=headers
                    ) as resp:
                        if resp.status_code >= 400:
                            body = await resp.aread()
                            yield _sse_error(body.decode())
                            return
                        async for chunk in resp.aiter_bytes():
                            yield chunk
        except httpx.HTTPError as exc:
            yield _sse_error(str(exc))

    async def stream_post(
        self,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        extra: dict[str, str] | None = None,
    ) -> AsyncGenerator[bytes, None]:
        url = self._url(path)
        headers = self._stream_headers(extra)
        try:
            if self._shared_client is not None:
                async with self._shared_client.stream(
                    "POST", url, json=body, headers=headers
                ) as resp:
                    if resp.status_code >= 400:
                        err_body = await resp.aread()
                        yield _sse_error(err_body.decode())
                        return
                    async for chunk in resp.aiter_bytes():
                        yield chunk
            else:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    async with client.stream(
                        "POST", url, json=body, headers=headers
                    ) as resp:
                        if resp.status_code >= 400:
                            err_body = await resp.aread()
                            yield _sse_error(err_body.decode())
                            return
                        async for chunk in resp.aiter_bytes():
                            yield chunk
        except httpx.HTTPError as exc:
            yield _sse_error(str(exc))


def extract_client_headers(headers: Any) -> dict[str, str]:
    """Extract Hermes pass-through headers from an incoming FastAPI request."""
    result: dict[str, str] = {}
    for hdr in _HERMES_PASSTHROUGH_HEADERS:
        val = headers.get(hdr)
        if val:
            result[hdr] = val
    return result


def _sse_error(message: str) -> bytes:
    payload = _json.dumps({"error": message})
    return f"event: error\ndata: {payload}\n\n".encode()
