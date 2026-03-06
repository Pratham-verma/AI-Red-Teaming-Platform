"""Local Ollama API provider."""

import os
from typing import Any

import httpx

from .base import BaseProvider


class OllamaProvider(BaseProvider):
    """Ollama local API client."""

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str = "default",
    ) -> dict[str, Any]:
        model = model if model != "default" else "llama3.2"
        payload = {"model": model, "messages": messages, "stream": False}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        content = data.get("message", {}).get("content", "") or ""
        return {"content": content, "text": content}
