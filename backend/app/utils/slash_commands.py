from __future__ import annotations

import json
from typing import Any, Dict, List

from ..config import SLASH_COMMANDS_FILE


def load_slash_commands() -> List[Dict[str, Any]]:
    if not SLASH_COMMANDS_FILE.exists():
        return []

    try:
        data = json.loads(SLASH_COMMANDS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []

    raw = data.get("commands", [])
    if not isinstance(raw, list):
        return []

    out: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        out.append(item)
    return out

