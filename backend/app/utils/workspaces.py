from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List

from ..config import WORKSPACES_FILE


def _norm_path(p: Path) -> str:
    return os.path.normcase(os.path.abspath(str(p)))


def load_allowed_workspaces() -> List[Path]:
    if not WORKSPACES_FILE.exists():
        return []

    data = json.loads(WORKSPACES_FILE.read_text(encoding="utf-8"))
    raw = data.get("workspaces", [])
    workspaces: List[Path] = []

    for item in raw:
        try:
            workspaces.append(Path(item))
        except Exception:
            continue

    return workspaces


def is_allowed_path(path: Path) -> bool:
    allowed = load_allowed_workspaces()
    if not allowed:
        return False

    target = _norm_path(path)

    for base in allowed:
        base_norm = _norm_path(base)
        if target == base_norm:
            return True
        if target.startswith(base_norm.rstrip("\\/") + os.sep):
            return True

    return False
