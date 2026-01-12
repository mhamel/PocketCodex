from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..models.messages import PongMessage, StatusMessage, StatusPayload
from ..pty.manager import pty_manager
from ..pty.sanitize import strip_terminal_identity_responses
from ..utils.keymapper import map_special_key
from .manager import ws_manager

router = APIRouter()


@router.websocket("/ws/terminal")
async def terminal_ws(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)

    try:
        for chunk in pty_manager.history_snapshot():
            cleaned = strip_terminal_identity_responses(chunk)
            if cleaned:
                await ws_manager.send_json(websocket, {"type": "output", "payload": {"data": cleaned}})

        st = pty_manager.status()
        await ws_manager.send_json(
            websocket,
            StatusMessage(
                type="status",
                payload=StatusPayload(status=st["status"], pid=st.get("pid"), message=None),
            ).model_dump(),
        )

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            payload = data.get("payload") or {}

            if msg_type == "input":
                raw = str(payload.get("data", ""))
                cleaned = strip_terminal_identity_responses(raw)
                if cleaned:
                    pty_manager.write(cleaned)
                continue

            if msg_type == "resize":
                cols = int(payload.get("cols", 0) or 0)
                rows = int(payload.get("rows", 0) or 0)
                if cols > 0 and rows > 0:
                    pty_manager.resize(cols, rows)
                continue

            if msg_type == "special_key":
                seq = map_special_key(str(payload.get("key", "")), list(payload.get("modifiers", []) or []))
                if seq:
                    pty_manager.write(seq)
                continue

            if msg_type == "ping":
                await ws_manager.send_json(websocket, PongMessage(type="pong", payload={}).model_dump())
                continue

    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(websocket)
