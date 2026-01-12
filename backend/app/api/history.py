from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..models.history import ChatHistoryCreateSnapshot, ChatHistoryListResponse, ChatHistoryRenameRequest, HistoryScope
from ..services.history_service import history_service

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
async def list_history(project_path: Optional[str] = None) -> ChatHistoryListResponse:
    try:
        items = history_service.list_items(project_path)
        return ChatHistoryListResponse(global_=items["global"], project=items["project"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{item_id}")
async def get_history_item(
    item_id: str,
    scope: HistoryScope = Query(HistoryScope.ALL),
    project_path: Optional[str] = None,
) -> dict:
    try:
        item = history_service.get_item(item_id, scope=scope, project_path=project_path)
        return {"item": item.model_dump(mode="json", by_alias=True, exclude_none=True)}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/snapshot")
async def create_history_snapshot(req: ChatHistoryCreateSnapshot) -> dict:
    try:
        item = history_service.create_snapshot(scope=req.scope, title=req.title, project_path=req.project_path)
        return {"success": True, "item": item.model_dump(mode="json", by_alias=True, exclude_none=True)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save history: {e}") from e


@router.put("/{item_id}")
async def rename_history_item(
    item_id: str,
    req: ChatHistoryRenameRequest,
    scope: HistoryScope = Query(...),
    project_path: Optional[str] = None,
) -> dict:
    try:
        if scope == HistoryScope.ALL:
            raise ValueError("scope must be global or project")
        item = history_service.rename_item(item_id, req.title, scope=scope, project_path=project_path)
        return {"success": True, "item": item.model_dump(mode="json", by_alias=True, exclude_none=True)}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename history: {e}") from e


@router.delete("/{item_id}")
async def delete_history_item(
    item_id: str,
    scope: HistoryScope = Query(...),
    project_path: Optional[str] = None,
) -> dict:
    try:
        if scope == HistoryScope.ALL:
            raise ValueError("scope must be global or project")
        history_service.delete_item(item_id, scope=scope, project_path=project_path)
        return {"success": True}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete history: {e}") from e


@router.delete("")
async def clear_history(
    scope: HistoryScope = Query(HistoryScope.ALL),
    project_path: Optional[str] = None,
) -> dict:
    try:
        history_service.clear(scope=scope, project_path=project_path)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear history: {e}") from e
