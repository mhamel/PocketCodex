from pathlib import Path
from urllib.parse import quote
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


def test_api_list_workspaces(client, tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    (root / "child").mkdir()
    (root / "file.txt").write_text("x", encoding="utf-8")

    with patch("app.api.workspaces.load_allowed_workspaces", return_value=[root]):
        response = client.get("/api/workspaces")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 1
        item = data["items"][0]
        assert item["path"] == str(root)
        assert item["name"] == root.name
        assert item["has_children"] is True


def test_api_list_children_success_and_filters(client, tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    (root / "a").mkdir()
    (root / "b").mkdir()
    (root / "file.txt").write_text("x", encoding="utf-8")

    def _allowed(p: Path) -> bool:
        pn = str(p).lower()
        return pn == str(root).lower() or pn == str(root / "a").lower()

    with patch("app.api.workspaces.is_allowed_path", side_effect=_allowed):
        response = client.get(f"/api/workspaces/children?path={quote(str(root))}")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        paths = {i["path"] for i in data["items"]}
        assert str(root / "a") in paths
        assert str(root / "b") not in paths
        assert all(i["name"] for i in data["items"])


def test_api_list_children_rejects_not_allowed(client, tmp_path):
    root = tmp_path / "root"
    root.mkdir()

    with patch("app.api.workspaces.is_allowed_path", return_value=False):
        response = client.get(f"/api/workspaces/children?path={quote(str(root))}")
        assert response.status_code == 400
        assert response.json()["detail"] == "path is not in the allowed workspaces"


def test_api_list_children_rejects_missing_or_not_dir(client, tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    missing = root / "missing"
    file_path = root / "file.txt"
    file_path.write_text("x", encoding="utf-8")

    with patch("app.api.workspaces.is_allowed_path", return_value=True):
        res_missing = client.get(f"/api/workspaces/children?path={quote(str(missing))}")
        assert res_missing.status_code == 400
        assert res_missing.json()["detail"] == "path does not exist or is not a directory"

        res_file = client.get(f"/api/workspaces/children?path={quote(str(file_path))}")
        assert res_file.status_code == 400
        assert res_file.json()["detail"] == "path does not exist or is not a directory"


def test_api_list_children_scandir_failure_returns_500(client, tmp_path):
    root = tmp_path / "root"
    root.mkdir()

    with patch("app.api.workspaces.is_allowed_path", return_value=True):
        with patch("app.api.workspaces.os.scandir", side_effect=OSError("boom")):
            response = client.get(f"/api/workspaces/children?path={quote(str(root))}")
            assert response.status_code == 500
            assert "Failed to list children" in response.json()["detail"]
