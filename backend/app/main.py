from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api.auth import router as auth_router
from .api.history import router as history_router
from .api.presets import router as presets_router
from .api.slash_commands import router as slash_commands_router
from .api.terminal import router as terminal_router
from .api.workspaces import router as workspaces_router
from .config import STATIC_DIR, VITE_DEV_PORT
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


app = FastAPI(lifespan=lifespan, title="PocketCodex")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(terminal_router)
app.include_router(workspaces_router)
app.include_router(presets_router)
app.include_router(slash_commands_router)
app.include_router(history_router)
app.include_router(ws_router)


if VITE_DEV_PORT:

    @app.get("/")
    @app.get("/{path:path}")
    async def dev_vite_redirect(request: Request, path: str = ""):
        host = request.url.hostname or "127.0.0.1"
        scheme = request.url.scheme
        suffix = f"/{path}" if path else "/"
        return RedirectResponse(url=f"{scheme}://{host}:{VITE_DEV_PORT}{suffix}", status_code=307)

else:
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
