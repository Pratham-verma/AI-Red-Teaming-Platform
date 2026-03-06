"""Base provider interface."""

from abc import ABC, abstractmethod
from typing import Any


class BaseProvider(ABC):
    """Abstract base for LLM API providers."""

    @abstractmethod
    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str = "default",
    ) -> dict[str, Any]:
        """Send chat request and return response dict with 'content' or 'text' key."""
        pass
