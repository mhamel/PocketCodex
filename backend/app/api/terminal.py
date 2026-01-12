from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import CODEX_COMMAND, TERMINAL_COLS, TERMINAL_ROWS
from ..models.messages import StatusMessage, StatusPayload
from ..pty.manager import pty_manager
from ..utils.workspaces import is_allowed_path
from ..websocket.manager import ws_manager

router = APIRouter(prefix="/api/terminal", tags=["terminal"])


class StartRequest(BaseModel):
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    cwd: Optional[str] = None
    cols: Optional[int] = None
    rows: Optional[int] = None


class StopRequest(BaseModel):
    force: bool = False


@router.post("/restart")
async def restart_terminal(req: StartRequest) -> dict:
    if req.cwd is not None:
        from pathlib import Path

        if not is_allowed_path(Path(req.cwd)):
            raise HTTPException(status_code=400, detail="cwd is not in the allowed workspaces")

    command = req.command or CODEX_COMMAND
    cols = req.cols or TERMINAL_COLS
    rows = req.rows or TERMINAL_ROWS

    if pty_manager.is_running():
        pty_manager.stop(force=True)
        await ws_manager.broadcast(
            StatusMessage(
                type="status",
                payload=StatusPayload(status="stopped", pid=None, message="Process stopped"),
            ).model_dump()
        )

    try:
        info = pty_manager.start(command=command, args=req.args, cwd=req.cwd, cols=cols, rows=rows)
    except RuntimeError as e:
        msg = str(e)
        if msg == "Session already running":
            raise HTTPException(status_code=400, detail=msg) from e
        raise HTTPException(status_code=500, detail=f"Terminal backend error: {msg}") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {e}") from e

    await ws_manager.broadcast(
        StatusMessage(
            type="status",
            payload=StatusPayload(status="running", pid=info.get("pid"), message="Process started"),
        ).model_dump()
    )

    return {"success": True, "session_id": info["session_id"], "status": "running", "pid": info.get("pid")}


@router.post("/start")
async def start_terminal(req: StartRequest) -> dict:
    if req.cwd is not None:
        from pathlib import Path

        if not is_allowed_path(Path(req.cwd)):
            raise HTTPException(status_code=400, detail="cwd is not in the allowed workspaces")

    command = req.command or CODEX_COMMAND
    cols = req.cols or TERMINAL_COLS
    rows = req.rows or TERMINAL_ROWS

    try:
        info = pty_manager.start(command=command, args=req.args, cwd=req.cwd, cols=cols, rows=rows)
    except RuntimeError as e:
        msg = str(e)
        if msg == "Session already running":
            raise HTTPException(status_code=400, detail=msg) from e
        raise HTTPException(status_code=500, detail=f"Terminal backend error: {msg}") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {e}") from e

    await ws_manager.broadcast(
        StatusMessage(
            type="status",
            payload=StatusPayload(status="running", pid=info.get("pid"), message="Process started"),
        ).model_dump()
    )

    return {"success": True, "session_id": info["session_id"], "status": "running", "pid": info.get("pid")}


@router.post("/stop")
async def stop_terminal(req: StopRequest) -> dict:
    pty_manager.stop(force=req.force)

    await ws_manager.broadcast(
        StatusMessage(
            type="status",
            payload=StatusPayload(status="stopped", pid=None, message="Process stopped"),
        ).model_dump()
    )

    return {"success": True, "status": "stopped"}


@router.get("/status")
async def terminal_status() -> dict:
    return pty_manager.status()
