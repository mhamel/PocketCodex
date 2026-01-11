from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..utils.workspaces import is_allowed_path, load_allowed_workspaces

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


class WorkspaceNode(BaseModel):
    path: str
    name: str
    has_children: bool


class WorkspaceListResponse(BaseModel):
    items: List[WorkspaceNode]


def _safe_name(p: Path) -> str:
    name = p.name
    if name:
        return name
    return str(p)


def _has_child_dirs(p: Path) -> bool:
    try:
        with os.scandir(p) as it:
            for entry in it:
                try:
                    if entry.is_dir(follow_symlinks=False):
                        return True
                except Exception:
                    continue
    except Exception:
        return False
    return False


@router.get("", response_model=WorkspaceListResponse)
async def list_workspaces() -> WorkspaceListResponse:
    roots = load_allowed_workspaces()
    items: List[WorkspaceNode] = []

    for root in roots:
        try:
            p = Path(root)
        except Exception:
            continue

        if not p.exists() or not p.is_dir():
            continue

        items.append(
            WorkspaceNode(
                path=str(p),
                name=_safe_name(p),
                has_children=_has_child_dirs(p),
            )
        )

    items.sort(key=lambda x: x.name.lower())
    return WorkspaceListResponse(items=items)


@router.get("/children", response_model=WorkspaceListResponse)
async def list_children(path: str = Query(..., min_length=1)) -> WorkspaceListResponse:
    p = Path(path)

    if not is_allowed_path(p):
        raise HTTPException(status_code=400, detail="path is not in the allowed workspaces")

    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=400, detail="path does not exist or is not a directory")

    items: List[WorkspaceNode] = []

    try:
        with os.scandir(p) as it:
            for entry in it:
                try:
                    if not entry.is_dir(follow_symlinks=False):
                        continue

                    child = Path(entry.path)
                    if not is_allowed_path(child):
                        continue

                    items.append(
                        WorkspaceNode(
                            path=str(child),
                            name=child.name,
                            has_children=_has_child_dirs(child),
                        )
                    )
                except Exception:
                    continue
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list children: {e}") from e

    items.sort(key=lambda x: x.name.lower())
    return WorkspaceListResponse(items=items)
