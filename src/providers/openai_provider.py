"""OpenAI API provider."""

import os
from typing import Any

from openai import AsyncOpenAI

from .base import BaseProvider


class OpenAIProvider(BaseProvider):
    """OpenAI API client."""

    def __init__(self, api_key: str | None = None):
        self.client = AsyncOpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str = "default",
    ) -> dict[str, Any]:
        model = model if model != "default" else "gpt-4o-mini"
        resp = await self.client.chat.completions.create(
            model=model,
            messages=[{"role": m["role"], "content": m["content"]} for m in messages],
        )
        content = resp.choices[0].message.content or ""
        return {"content": content, "text": content}
