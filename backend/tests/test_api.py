import pytest
from unittest.mock import patch, MagicMock

def test_get_status(client):
    # Mock the pty_manager.status()
    with patch("app.pty.manager.pty_manager.status") as mock_status:
        mock_status.return_value = {"status": "running", "pid": 123}
        response = client.get("/api/terminal/status")
        assert response.status_code == 200
        assert response.json() == {"status": "running", "pid": 123}

def test_start_terminal(client):
    with patch("app.pty.manager.pty_manager.start") as mock_start:
        mock_start.return_value = {"session_id": "abc", "pid": 999}
        # We also need to mock ws_manager.broadcast because the endpoint calls it
        with patch("app.websocket.manager.ws_manager.broadcast", new_callable=MagicMock) as mock_broadcast:
            async def async_mock(*args, **kwargs):
                return None
            mock_broadcast.side_effect = async_mock
            
            payload = {"command": "echo", "args": ["test"]}
            response = client.post("/api/terminal/start", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["session_id"] == "abc"
            assert data["pid"] == 999

def test_stop_terminal(client):
    with patch("app.pty.manager.pty_manager.stop") as mock_stop:
        with patch("app.websocket.manager.ws_manager.broadcast", new_callable=MagicMock) as mock_broadcast:
            async def async_mock(*args, **kwargs):
                return None
            mock_broadcast.side_effect = async_mock
            
            response = client.post("/api/terminal/stop", json={"force": False})
            assert response.status_code == 200
            assert response.json()["status"] == "stopped"
            mock_stop.assert_called_once_with(force=False)


def test_restart_terminal_when_stopped(client):
    with patch("app.api.terminal.is_allowed_path", return_value=True):
        with patch("app.pty.manager.pty_manager.is_running", return_value=False):
            with patch("app.pty.manager.pty_manager.stop") as mock_stop:
                with patch("app.pty.manager.pty_manager.start") as mock_start:
                    mock_start.return_value = {"session_id": "abc", "pid": 999}
                    with patch("app.websocket.manager.ws_manager.broadcast", new_callable=MagicMock) as mock_broadcast:
                        async def async_mock(*args, **kwargs):
                            return None
                        mock_broadcast.side_effect = async_mock

                        response = client.post("/api/terminal/restart", json={"cwd": "C:/demo"})
                        assert response.status_code == 200
                        data = response.json()
                        assert data["session_id"] == "abc"
                        assert data["pid"] == 999
                        mock_stop.assert_not_called()
                        mock_start.assert_called_once()


def test_restart_terminal_when_running(client):
    with patch("app.api.terminal.is_allowed_path", return_value=True):
        with patch("app.pty.manager.pty_manager.is_running", return_value=True):
            with patch("app.pty.manager.pty_manager.stop") as mock_stop:
                with patch("app.pty.manager.pty_manager.start") as mock_start:
                    mock_start.return_value = {"session_id": "abc", "pid": 999}
                    with patch("app.websocket.manager.ws_manager.broadcast", new_callable=MagicMock) as mock_broadcast:
                        async def async_mock(*args, **kwargs):
                            return None
                        mock_broadcast.side_effect = async_mock

                        response = client.post("/api/terminal/restart", json={"cwd": "C:/demo"})
                        assert response.status_code == 200
                        mock_stop.assert_called_once_with(force=True)
                        mock_start.assert_called_once()
                        assert mock_broadcast.call_count == 2


def test_restart_terminal_rejects_invalid_cwd(client):
    with patch("app.api.terminal.is_allowed_path", return_value=False):
        response = client.post("/api/terminal/restart", json={"cwd": "C:/not-allowed"})
        assert response.status_code == 400
        assert response.json()["detail"] == "cwd is not in the allowed workspaces"
