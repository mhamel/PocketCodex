from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..config import HISTORY_FILE
from ..models.history import ChatHistoryItem, HistoryScope
from ..pty.manager import pty_manager
from ..utils.workspaces import is_allowed_path


MAX_ITEMS = 50
MAX_TRANSCRIPT_CHARS = 250_000

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {"version": "1.0", "items": []}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _project_file(project_path: str) -> Path:
    return Path(project_path) / ".webcodeai" / "history.json"


def _validate_project_path(project_path: Optional[str]) -> Optional[Path]:
    if project_path is None:
        return None
    p = Path(project_path)
    if not is_allowed_path(p):
        raise ValueError("project_path is not in the allowed workspaces")
    return p


def _load_file(path: Path) -> Tuple[Dict[str, Any], List[ChatHistoryItem]]:
    raw = _read_json(path)
    out: List[ChatHistoryItem] = []

    for item in raw.get("items", []):
        try:
            out.append(ChatHistoryItem.model_validate(item))
        except Exception:
            continue

    return raw, out


def _dump_file(raw: Dict[str, Any], items: List[ChatHistoryItem]) -> Dict[str, Any]:
    raw["version"] = raw.get("version") or "1.0"
    raw["items"] = [i.model_dump(mode="json", by_alias=True, exclude_none=True) for i in items]
    return raw


def _apply_retention(items: List[ChatHistoryItem]) -> List[ChatHistoryItem]:
    if len(items) <= MAX_ITEMS:
        return items
    return items[:MAX_ITEMS]


class ChatHistoryService:
    def __init__(self) -> None:
        self._lock = threading.RLock()

    def list_items(self, project_path: Optional[str]) -> Dict[str, List[ChatHistoryItem]]:
        raw_global, global_items = _load_file(HISTORY_FILE)
        global_items.sort(key=lambda x: x.updated_at, reverse=True)

        project_items: List[ChatHistoryItem] = []
        if project_path and project_path.strip():
            _validate_project_path(project_path)
            _raw_project, project_items = _load_file(_project_file(project_path))
            project_items.sort(key=lambda x: x.updated_at, reverse=True)

        return {"global": global_items, "project": project_items}

    def _path_for_scope(self, scope: HistoryScope, project_path: Optional[str]) -> Path:
        if scope == HistoryScope.GLOBAL:
            return HISTORY_FILE
        if scope == HistoryScope.PROJECT:
            if not project_path or not project_path.strip():
                raise ValueError("project_path is required for project scope")
            _validate_project_path(project_path)
            return _project_file(project_path)
        raise ValueError("Invalid scope")

    def get_item(self, item_id: str, scope: HistoryScope, project_path: Optional[str]) -> ChatHistoryItem:
        if scope == HistoryScope.ALL:
            sources: List[Path] = [HISTORY_FILE]
            if project_path and project_path.strip():
                _validate_project_path(project_path)
                sources.insert(0, _project_file(project_path))
        else:
            sources = [self._path_for_scope(scope, project_path)]

        for path in sources:
            _, items = _load_file(path)
            for it in items:
                if it.id == item_id:
                    return it
        raise KeyError("History item not found")

    def create_snapshot(self, scope: HistoryScope, title: Optional[str], project_path: Optional[str]) -> ChatHistoryItem:
        chunks = pty_manager.history_snapshot()
        transcript = "".join(chunks)
        if not transcript.strip():
            transcript = ""

        if len(transcript) > MAX_TRANSCRIPT_CHARS:
            transcript = transcript[-MAX_TRANSCRIPT_CHARS:]

        now = _utcnow()
        it = ChatHistoryItem(
            id=str(uuid.uuid4()),
            title=(title or "Session").strip() or "Session",
            project_path=project_path.strip() if project_path and project_path.strip() else None,
            created_at=now,
            updated_at=now,
            transcript=transcript,
        )

        with self._lock:
            if scope == HistoryScope.GLOBAL:
                it.project_path = None
                path = HISTORY_FILE
            elif scope == HistoryScope.PROJECT:
                if not it.project_path:
                    raise ValueError("project_path is required for project scope")
                _validate_project_path(it.project_path)
                path = _project_file(it.project_path)
            else:
                raise ValueError("Invalid scope")

            raw, items = _load_file(path)
            items.insert(0, it)
            items = _apply_retention(items)
            _write_json(path, _dump_file(raw, items))

        return it

    def rename_item(self, item_id: str, title: str, scope: HistoryScope, project_path: Optional[str]) -> ChatHistoryItem:
        trimmed = title.strip()
        if not trimmed:
            raise ValueError("title is required")

        with self._lock:
            path = self._path_for_scope(scope, project_path)
            raw, items = _load_file(path)
            for it in items:
                if it.id == item_id:
                    it.title = trimmed
                    it.updated_at = _utcnow()
                    _write_json(path, _dump_file(raw, items))
                    return it
            raise KeyError("History item not found")

    def delete_item(self, item_id: str, scope: HistoryScope, project_path: Optional[str]) -> None:
        with self._lock:
            path = self._path_for_scope(scope, project_path)
            raw, items = _load_file(path)
            new_items = [x for x in items if x.id != item_id]
            if len(new_items) == len(items):
                raise KeyError("History item not found")
            _write_json(path, _dump_file(raw, new_items))

    def clear(self, scope: HistoryScope, project_path: Optional[str]) -> None:
        with self._lock:
            if scope == HistoryScope.GLOBAL:
                raw_global, _items = _load_file(HISTORY_FILE)
                _write_json(HISTORY_FILE, _dump_file(raw_global, []))
                return
            if scope == HistoryScope.PROJECT:
                path = self._path_for_scope(scope, project_path)
                raw_project, _items2 = _load_file(path)
                _write_json(path, _dump_file(raw_project, []))
                return
            if scope == HistoryScope.ALL:
                raw_global, _items = _load_file(HISTORY_FILE)
                _write_json(HISTORY_FILE, _dump_file(raw_global, []))
                if project_path and project_path.strip():
                    _validate_project_path(project_path)
                    path = _project_file(project_path)
                    raw_project, _items2 = _load_file(path)
                    _write_json(path, _dump_file(raw_project, []))
                return
            raise ValueError("Invalid scope")


history_service = ChatHistoryService()
