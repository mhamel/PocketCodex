from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"

CODEX_COMMAND = os.getenv("CODEX_COMMAND", "codex")
TERMINAL_COLS = int(os.getenv("TERMINAL_COLS", "80"))
TERMINAL_ROWS = int(os.getenv("TERMINAL_ROWS", "24"))

OUTPUT_QUEUE_MAXSIZE = int(os.getenv("OUTPUT_QUEUE_MAXSIZE", "200"))

HISTORY_MAX_BYTES = int(os.getenv("HISTORY_MAX_BYTES", "500000"))
HISTORY_MAX_CHUNKS = int(os.getenv("HISTORY_MAX_CHUNKS", "2000"))

WORKSPACES_FILE = BASE_DIR / os.getenv("WORKSPACES_FILE", "data/workspaces.json")
GLOBAL_PRESETS_FILE = BASE_DIR / os.getenv("GLOBAL_PRESETS_FILE", "data/presets/global.json")
HISTORY_FILE = BASE_DIR / os.getenv("HISTORY_FILE", "data/history.json")
