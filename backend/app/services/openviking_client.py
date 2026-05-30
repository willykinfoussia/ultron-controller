from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import Settings


class OpenVikingClient:
    def __init__(self, settings: Settings) -> None:
        self._endpoint = settings.openviking_endpoint.rstrip("/")
        self._api_key = settings.openviking_api_key

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
        timeout: int = 30,
    ) -> dict[str, Any]:
        url = f"{self._endpoint}{path}"
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(
                    method,
                    url,
                    params=params,
                    json=json_body,
                    headers=self._headers(),
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=exc.response.text,
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"OpenViking unavailable: {exc}") from exc

    async def health(self) -> dict[str, Any]:
        return await self._request("GET", "/health")

    async def ls(self, uri: str, recursive: bool = False) -> dict[str, Any]:
        return await self._request(
            "GET",
            "/api/v1/fs/ls",
            params={"uri": uri, "recursive": str(recursive).lower()},
        )

    async def tree(self, uri: str, level_limit: int = 3) -> dict[str, Any]:
        return await self._request(
            "GET",
            "/api/v1/fs/tree",
            params={"uri": uri, "level_limit": level_limit},
        )

    async def stat(self, uri: str) -> dict[str, Any]:
        return await self._request("GET", "/api/v1/fs/stat", params={"uri": uri})

    async def read(self, uri: str, raw: bool = False) -> dict[str, Any]:
        payload = await self._request(
            "GET",
            "/api/v1/content/read",
            params={"uri": uri, "raw": str(raw).lower()},
        )
        return {
            "status": payload.get("status", "ok"),
            "result": _extract_result(payload),
            "raw": payload,
        }

    async def abstract(self, uri: str) -> dict[str, Any]:
        return await self._request("GET", "/api/v1/content/abstract", params={"uri": uri})

    async def overview(self, uri: str) -> dict[str, Any]:
        return await self._request("GET", "/api/v1/content/overview", params={"uri": uri})

    async def write(self, uri: str, content: str, mode: str = "replace") -> dict[str, Any]:
        normalized_mode = "create" if mode == "replace" else mode
        return await self._request(
            "POST",
            "/api/v1/content/write",
            json_body={"uri": uri, "content": content, "mode": normalized_mode},
            timeout=60,
        )

    async def delete(self, uri: str, recursive: bool = False) -> dict[str, Any]:
        return await self._request(
            "DELETE",
            "/api/v1/fs",
            params={"uri": uri, "recursive": str(recursive).lower()},
        )

    async def mkdir(self, uri: str, description: str | None = None) -> dict[str, Any]:
        return await self._request(
            "POST",
            "/api/v1/fs/mkdir",
            json_body={"uri": uri, "description": description},
        )

    async def search(
        self,
        query: str,
        target_uri: str,
        limit: int,
        score_threshold: float | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "query": query,
            "target_uri": target_uri,
            "limit": limit,
        }
        if score_threshold is not None:
            payload["score_threshold"] = score_threshold
        raw = await self._request("POST", "/api/v1/search/find", json_body=payload)
        result = raw.get("result", {})
        if isinstance(result, dict):
            items = result.get("memories", result.get("items", []))
        elif isinstance(result, list):
            items = result
        else:
            items = []
        return {"status": raw.get("status", "ok"), "items": items}

    async def sessions(self) -> dict[str, Any]:
        return await self._request("GET", "/api/v1/sessions")


def _extract_result(payload: dict[str, Any]) -> Any:
    if "result" in payload:
        return payload["result"]
    if "content" in payload:
        return payload["content"]
    if "data" in payload:
        return payload["data"]
    return payload
