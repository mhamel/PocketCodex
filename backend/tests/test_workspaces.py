from pathlib import Path
from app.utils.workspaces import is_allowed_path, load_allowed_workspaces
import json
import pytest
from unittest.mock import patch, MagicMock

def test_load_allowed_workspaces(tmp_path):
    # Mock the config.WORKSPACES_FILE to point to a temp file
    p = tmp_path / "workspaces.json"
    data = {"workspaces": [str(tmp_path / "foo"), str(tmp_path / "bar")]}
    p.write_text(json.dumps(data), encoding="utf-8")
    
    with patch("app.utils.workspaces.WORKSPACES_FILE", p):
        allowed = load_allowed_workspaces()
        assert len(allowed) == 2
        assert Path(str(tmp_path / "foo")) in allowed

def test_is_allowed_path(tmp_path):
    # Setup allowed workspaces
    p = tmp_path / "workspaces.json"
    data = {"workspaces": [str(tmp_path / "safe")]}
    p.write_text(json.dumps(data), encoding="utf-8")

    safe_dir = tmp_path / "safe"
    safe_dir.mkdir()
    
    unsafe_dir = tmp_path / "unsafe"
    unsafe_dir.mkdir()

    with patch("app.utils.workspaces.WORKSPACES_FILE", p):
        # Exact match
        assert is_allowed_path(safe_dir) is True
        
        # Subdirectory match
        sub = safe_dir / "child"
        assert is_allowed_path(sub) is True
        
        # Outside match
        assert is_allowed_path(unsafe_dir) is False
        
        # Parent match (should be false)
        assert is_allowed_path(tmp_path) is False
