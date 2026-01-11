import pytest
from unittest.mock import patch, MagicMock
from app.models.preset import PresetScope

# Mock global presets file
@pytest.fixture
def mock_presets_file(tmp_path):
    p = tmp_path / "global.json"
    p.write_text('{"version": "1.0", "presets": []}', encoding="utf-8")
    return p

def test_list_presets(client, mock_presets_file):
    with patch("app.services.preset_service.GLOBAL_PRESETS_FILE", mock_presets_file):
        response = client.get("/api/presets?scope=global")
        assert response.status_code == 200
        data = response.json()
        assert "global" in data
        assert isinstance(data["global"], list)

def test_create_and_delete_preset(client, mock_presets_file):
    with patch("app.services.preset_service.GLOBAL_PRESETS_FILE", mock_presets_file):
        # Create
        new_preset = {
            "name": "Test Preset",
            "description": "A test",
            "command": "echo hello",
            "category": "general",
            "scope": "global"
        }
        res_create = client.post("/api/presets", json=new_preset)
        assert res_create.status_code == 200
        created = res_create.json()["preset"]
        assert created["name"] == "Test Preset"
        preset_id = created["id"]

        # Verify it's in the list
        res_list = client.get("/api/presets?scope=global")
        items = res_list.json()["global"]
        assert any(p["id"] == preset_id for p in items)

        # Delete
        res_del = client.delete(f"/api/presets/{preset_id}?scope=global")
        assert res_del.status_code == 200
        
        # Verify gone
        res_list_after = client.get("/api/presets?scope=global")
        items_after = res_list_after.json()["global"]
        assert not any(p["id"] == preset_id for p in items_after)
