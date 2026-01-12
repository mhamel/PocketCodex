from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.history import router as history_router
from .api.presets import router as presets_router
from .api.terminal import router as terminal_router
from .api.workspaces import router as workspaces_router
from .config import STATIC_DIR
from .pty.manager import pty_manager
from .websocket.handler import router as ws_router
from .websocket.manager import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    try:
        pty_manager.shutdown()
    finally:
        await ws_manager.shutdown()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)

app.include_router(terminal_router)
app.include_router(workspaces_router)
app.include_router(presets_router)
app.include_router(history_router)
app.include_router(ws_router)

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
