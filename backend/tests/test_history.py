from pathlib import Path
from urllib.parse import quote
from unittest.mock import patch

import pytest


@pytest.fixture
def mock_history_file(tmp_path: Path) -> Path:
    p = tmp_path / "history.json"
    p.write_text('{"version": "1.0", "items": []}', encoding="utf-8")
    return p


def test_list_history_empty(client, mock_history_file: Path):
    with patch("app.services.history_service.HISTORY_FILE", mock_history_file):
        res = client.get("/api/history")
        assert res.status_code == 200
        data = res.json()
        assert "global" in data
        assert "project" in data
        assert data["global"] == []
        assert data["project"] == []


def test_create_snapshot_requires_terminal_history(client, mock_history_file: Path):
    with patch("app.services.history_service.HISTORY_FILE", mock_history_file):
        with patch("app.services.history_service.pty_manager.history_snapshot", return_value=[]):
            res = client.post("/api/history/snapshot", json={"scope": "global", "title": "x"})
            assert res.status_code == 400


def test_create_snapshot_global_and_rename_delete(client, mock_history_file: Path):
    with patch("app.services.history_service.HISTORY_FILE", mock_history_file):
        with patch("app.services.history_service.pty_manager.history_snapshot", return_value=["hello\n"]):
            res = client.post("/api/history/snapshot", json={"scope": "global", "title": "My session"})
            assert res.status_code == 200
            item = res.json()["item"]
            assert item["title"] == "My session"
            assert item.get("project_path") is None
            item_id = item["id"]

        res_list = client.get("/api/history")
        assert res_list.status_code == 200
        assert len(res_list.json()["global"]) == 1

        res_rename = client.put(f"/api/history/{quote(item_id)}?scope=global", json={"title": "Renamed"})
        assert res_rename.status_code == 200
        assert res_rename.json()["item"]["title"] == "Renamed"

        res_del = client.delete(f"/api/history/{quote(item_id)}?scope=global")
        assert res_del.status_code == 200

        res_list2 = client.get("/api/history")
        assert res_list2.status_code == 200
        assert res_list2.json()["global"] == []


def test_project_scope_persists_in_project_file(client, mock_history_file: Path, tmp_path: Path):
    project = tmp_path / "demo"
    project.mkdir(parents=True, exist_ok=True)

    with patch("app.services.history_service.HISTORY_FILE", mock_history_file):
        with patch("app.services.history_service.is_allowed_path", return_value=True):
            with patch("app.services.history_service.pty_manager.history_snapshot", return_value=["proj\n"]):
                res = client.post(
                    "/api/history/snapshot",
                    json={"scope": "project", "title": "P", "project_path": str(project)},
                )
                assert res.status_code == 200

            res_list = client.get(f"/api/history?project_path={quote(str(project))}")
            assert res_list.status_code == 200
            data = res_list.json()
            assert len(data["project"]) == 1
            assert data["project"][0]["project_path"].lower() == str(project).lower()


def test_clear_all_clears_global_and_project(client, mock_history_file: Path, tmp_path: Path):
    project = tmp_path / "demo"
    project.mkdir(parents=True, exist_ok=True)

    with patch("app.services.history_service.HISTORY_FILE", mock_history_file):
        with patch("app.services.history_service.is_allowed_path", return_value=True):
            with patch("app.services.history_service.pty_manager.history_snapshot", return_value=["hello\n"]):
                res_g = client.post("/api/history/snapshot", json={"scope": "global", "title": "G"})
                assert res_g.status_code == 200

            with patch("app.services.history_service.pty_manager.history_snapshot", return_value=["proj\n"]):
                res_p = client.post(
                    "/api/history/snapshot",
                    json={"scope": "project", "title": "P", "project_path": str(project)},
                )
                assert res_p.status_code == 200

            res_clear = client.delete(f"/api/history?scope=all&project_path={quote(str(project))}")
            assert res_clear.status_code == 200

            res_list = client.get(f"/api/history?project_path={quote(str(project))}")
            assert res_list.status_code == 200
            data = res_list.json()
            assert data["global"] == []
            assert data["project"] == []
