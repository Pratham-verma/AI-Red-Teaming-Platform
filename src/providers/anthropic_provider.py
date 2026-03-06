"""Anthropic API provider."""

import os
from typing import Any

from anthropic import AsyncAnthropic

from .base import BaseProvider


class AnthropicProvider(BaseProvider):
    """Anthropic API client."""

    def __init__(self, api_key: str | None = None):
        self.client = AsyncAnthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str = "default",
    ) -> dict[str, Any]:
        model = model if model != "default" else "claude-3-5-haiku-20241022"
        # Anthropic expects system as separate param; we put first system msg there
        system = ""
        chat_msgs = []
        for m in messages:
            if m.get("role") == "system":
                system = m.get("content", "")
            else:
                chat_msgs.append({"role": m["role"], "content": m["content"]})

        resp = await self.client.messages.create(
            model=model,
            max_tokens=1024,
            system=system or "You are a helpful assistant.",
            messages=chat_msgs,
        )
        content = resp.content[0].text if resp.content else ""
        return {"content": content, "text": content}
