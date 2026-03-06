"""Log streaming to file and WebSocket for Lumina-Red."""

import asyncio
import json
from pathlib import Path
from typing import Any

try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False


class LogStreamer:
    """Stream attack logs to JSON file and optional WebSocket."""

    def __init__(
        self,
        output_file: str | Path = "attack_logs.json",
        ws_port: int = 8765,
        enable_ws: bool = True,
    ):
        self.output_file = Path(output_file)
        self.ws_port = ws_port
        self.enable_ws = enable_ws and HAS_WEBSOCKETS
        self._logs: list[dict[str, Any]] = []
        self._ws_clients: set = set()
        self._ws_server = None

    async def start_ws_server(self) -> None:
        """Start WebSocket server for live dashboard."""
        if not self.enable_ws:
            return

        async def handler(websocket):
            self._ws_clients.add(websocket)
            try:
                async for _ in websocket:
                    pass
            finally:
                self._ws_clients.discard(websocket)

        self._ws_server = await websockets.serve(
            handler, "127.0.0.1", self.ws_port, ping_interval=20, ping_timeout=20
        )

    async def stop_ws_server(self) -> None:
        """Stop WebSocket server."""
        if self._ws_server:
            self._ws_server.close()
            await self._ws_server.wait_closed()

    async def emit(self, log_entry: dict[str, Any]) -> None:
        """Emit a single log entry to file and WebSocket."""
        self._logs.append(log_entry)
        line = json.dumps(log_entry) + "\n"

        # Append to file
        with open(self.output_file, "a", encoding="utf-8") as f:
            f.write(line)

        # Broadcast to WebSocket clients
        if self.enable_ws and self._ws_clients:
            dead = set()
            for ws in self._ws_clients:
                try:
                    await ws.send(line)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self._ws_clients.discard(ws)

    def get_all_logs(self) -> list[dict[str, Any]]:
        """Return all accumulated logs."""
        return self._logs.copy()
