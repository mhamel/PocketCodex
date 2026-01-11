from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..config import GLOBAL_PRESETS_FILE
from ..models.preset import Preset, PresetCreate, PresetScope, PresetUpdate
from ..utils.workspaces import is_allowed_path


_VAR_RE = re.compile(r"{{\s*([a-zA-Z0-9_]+)\s*}}")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {"version": "1.0", "presets": []}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _project_file(project_path: str) -> Path:
    return Path(project_path) / ".webcodeai" / "presets.json"


def _validate_project_path(project_path: Optional[str]) -> Optional[Path]:
    if project_path is None:
        return None
    p = Path(project_path)
    if not is_allowed_path(p):
        raise ValueError("project_path is not in the allowed workspaces")
    return p


def _load_presets_file(path: Path) -> Tuple[Dict[str, Any], List[Preset]]:
    raw = _read_json(path)
    presets: List[Preset] = []

    for item in raw.get("presets", []):
        try:
            presets.append(Preset.model_validate(item))
        except Exception:
            continue

    return raw, presets


def _dump_presets_file(raw: Dict[str, Any], presets: List[Preset]) -> Dict[str, Any]:
    raw["version"] = raw.get("version") or "1.0"
    raw["presets"] = [p.model_dump(mode="json", by_alias=True, exclude_none=True) for p in presets]
    return raw


def render_preset_command(template: str, variables: Dict[str, str]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        return str(variables.get(key, ""))

    return _VAR_RE.sub(repl, template)


class PresetService:
    def list_presets(self, project_path: Optional[str]) -> Dict[str, List[Dict[str, Any]]]:
        _, global_presets = _load_presets_file(GLOBAL_PRESETS_FILE)

        project_presets: List[Preset] = []
        if project_path:
            _validate_project_path(project_path)
            _, project_presets = _load_presets_file(_project_file(project_path))

        return {
            "global": [p.model_dump(by_alias=True, exclude_none=True) for p in global_presets],
            "project": [p.model_dump(by_alias=True, exclude_none=True) for p in project_presets],
        }

    def create_preset(self, data: PresetCreate) -> Dict[str, Any]:
        now = _utcnow()
        preset = Preset(
            id=str(uuid.uuid4()),
            name=data.name,
            description=data.description,
            command=data.command,
            category=data.category,
            shortcut=data.shortcut,
            created_at=now,
            updated_at=now,
        )

        if data.scope == PresetScope.GLOBAL:
            path = GLOBAL_PRESETS_FILE
        else:
            if not data.project_path:
                raise ValueError("project_path is required for project scope")
            _validate_project_path(data.project_path)
            path = _project_file(data.project_path)

        raw, presets = _load_presets_file(path)
        presets.append(preset)
        _write_json(path, _dump_presets_file(raw, presets))
        return preset.model_dump(by_alias=True, exclude_none=True)

    def update_preset(
        self,
        preset_id: str,
        scope: PresetScope,
        update: PresetUpdate,
        project_path: Optional[str],
    ) -> Dict[str, Any]:
        if scope == PresetScope.GLOBAL:
            path = GLOBAL_PRESETS_FILE
        else:
            if not project_path:
                raise ValueError("project_path is required for project scope")
            _validate_project_path(project_path)
            path = _project_file(project_path)

        raw, presets = _load_presets_file(path)

        found = None
        for p in presets:
            if p.id == preset_id:
                found = p
                break

        if not found:
            raise KeyError("Preset not found")

        if update.name is not None:
            found.name = update.name
        if update.description is not None:
            found.description = update.description
        if update.command is not None:
            found.command = update.command
        if update.category is not None:
            found.category = update.category
        if update.shortcut is not None:
            found.shortcut = update.shortcut

        found.updated_at = _utcnow()

        _write_json(path, _dump_presets_file(raw, presets))
        return found.model_dump(by_alias=True, exclude_none=True)

    def delete_preset(self, preset_id: str, scope: PresetScope, project_path: Optional[str]) -> None:
        if scope == PresetScope.GLOBAL:
            path = GLOBAL_PRESETS_FILE
        else:
            if not project_path:
                raise ValueError("project_path is required for project scope")
            _validate_project_path(project_path)
            path = _project_file(project_path)

        raw, presets = _load_presets_file(path)
        new_presets = [p for p in presets if p.id != preset_id]
        _write_json(path, _dump_presets_file(raw, new_presets))

    def get_preset(self, preset_id: str, scope: PresetScope, project_path: Optional[str]) -> Preset:
        if scope == PresetScope.GLOBAL:
            path = GLOBAL_PRESETS_FILE
        else:
            if not project_path:
                raise ValueError("project_path is required for project scope")
            _validate_project_path(project_path)
            path = _project_file(project_path)

        _, presets = _load_presets_file(path)
        for p in presets:
            if p.id == preset_id:
                return p
        raise KeyError("Preset not found")

    def execute_preset(
        self,
        preset_id: str,
        scope: PresetScope,
        project_path: Optional[str],
        variables: Optional[Dict[str, str]] = None,
    ) -> str:
        preset = self.get_preset(preset_id, scope, project_path)
        vars2 = dict(variables or {})
        if project_path:
            vars2.setdefault("project_path", project_path)

        cmd = render_preset_command(preset.command, vars2)
        return cmd


preset_service = PresetService()
