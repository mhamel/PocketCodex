from __future__ import annotations

from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..models.preset import PresetCreate, PresetScope, PresetUpdate
from ..pty.manager import pty_manager
from ..services.preset_service import preset_service

router = APIRouter(prefix="/api/presets", tags=["presets"])


class ExecuteRequest(BaseModel):
    variables: Dict[str, str] = Field(default_factory=dict)


@router.get("")
async def list_presets(project_path: Optional[str] = None) -> dict:
    try:
        return preset_service.list_presets(project_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("")
async def create_preset(req: PresetCreate) -> dict:
    try:
        preset = preset_service.create_preset(req)
        return {"success": True, "preset": preset}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create preset: {e}") from e


@router.put("/{preset_id}")
async def update_preset(
    preset_id: str,
    req: PresetUpdate,
    scope: PresetScope = Query(...),
    project_path: Optional[str] = None,
) -> dict:
    try:
        preset = preset_service.update_preset(preset_id, scope=scope, update=req, project_path=project_path)
        return {"success": True, "preset": preset}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update preset: {e}") from e


@router.delete("/{preset_id}")
async def delete_preset(
    preset_id: str,
    scope: PresetScope = Query(...),
    project_path: Optional[str] = None,
) -> dict:
    try:
        preset_service.delete_preset(preset_id, scope=scope, project_path=project_path)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete preset: {e}") from e


@router.post("/{preset_id}/execute")
async def execute_preset(
    preset_id: str,
    body: ExecuteRequest,
    scope: PresetScope = Query(...),
    project_path: Optional[str] = None,
) -> dict:
    try:
        command = preset_service.execute_preset(
            preset_id,
            scope=scope,
            project_path=project_path,
            variables=body.variables,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute preset: {e}") from e

    if not pty_manager.is_running():
        raise HTTPException(status_code=400, detail="Terminal session is not running")

    text = command
    if not text.endswith("\r") and not text.endswith("\n"):
        text += "\r"
    pty_manager.write(text)

    return {"success": True, "command_sent": command}
