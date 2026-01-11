from __future__ import annotations

import asyncio
import queue
from typing import Any, Dict, Optional, Set

from fastapi import WebSocket

from ..models.messages import OutputMessage, OutputPayload
from ..pty.manager import pty_manager


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._broadcaster_task: Optional[asyncio.Task[None]] = None
        self._broadcaster_stop: Optional[asyncio.Event] = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

        await self._ensure_broadcaster()

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def send_json(self, websocket: WebSocket, message: Dict[str, Any]) -> None:
        await websocket.send_json(message)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._connections)

        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.discard(ws)

    async def _ensure_broadcaster(self) -> None:
        if self._broadcaster_task and not self._broadcaster_task.done():
            return

        self._broadcaster_stop = asyncio.Event()
        self._broadcaster_task = asyncio.create_task(self._broadcaster_loop(self._broadcaster_stop))

    async def _broadcaster_loop(self, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                chunk = await asyncio.to_thread(pty_manager.output_queue.get, True, 0.2)
            except queue.Empty:
                continue
            except Exception:
                await asyncio.sleep(0.05)
                continue

            msg = OutputMessage(type="output", payload=OutputPayload(data=chunk)).model_dump()
            await self.broadcast(msg)

    async def shutdown(self) -> None:
        if self._broadcaster_stop:
            self._broadcaster_stop.set()
        if self._broadcaster_task:
            self._broadcaster_task.cancel()
            try:
                await self._broadcaster_task
            except Exception:
                pass


ws_manager = ConnectionManager()
