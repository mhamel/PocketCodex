
# WebCodeAI - Web UI for Codex CLI via ConPTY (Windows)

## Overview

Web application to interact with Codex CLI (OpenAI) through a browser-based terminal. Uses ConPTY (Windows Pseudo Console) to host the Codex process and provide full terminal interaction (including TUI navigation with arrow keys).

## Locked Decisions (MVP)

- **PTY session model**: Single shared PTY session for all connected WebSocket clients (output is broadcast).
- **Keyboard input**: xterm `onData` sends raw terminal data to the backend (includes control sequences).
- **PTY output reading**: Dedicated reader thread + `Queue` feeding the async WebSocket loop.
- **Encoding**: UTF-8.
- **Stop semantics**: Windows-friendly termination (no POSIX signals / no `SIGKILL`).
- **Buffers & History**:
  - **Ring Buffer**: The backend maintains a circular buffer (e.g., last 1000 lines or 500KB) of the current session history. Any new client immediately receives this history upon connection.
  - **Backpressure**: The PTY read Queue is fixed-size. If full, oldest messages are dropped to prevent OOM (Out Of Memory).
- **Security**:
  - **Workspaces Allowlist**: `start` verifies that the requested `cwd` is in a defined list (`data/workspaces.json`).
- **Templating Presets**: Support variables in commands (e.g., `{{current_file}}`).
- **Multi-user**: Not supported (Designed for single-user LAN usage).
- **Persistence**: `backend/data/presets/global.json` preserved.
- **Static SPA serving**: FastAPI serves the built frontend at `/` (register API/WS routes before static mount).
- **IDs**: UUID.
- **Language**: UI and code in English.
- **Network**: Server accessible on the LAN.
- **Presets execute**: Inject preset text into the terminal input stream (as if typed).

---

## Global Architecture

```
+------------------------------------------------------------------+
|                        BROWSER (Client)                           |
|  +------------------------------------------------------------+  |
|  |                      React App                             |  |
|  |  +------------------+  +--------------------+               |  |
|  |  |  Terminal UI     |  |  Control Panel     |               |  |
|  |  |  (xterm.js)      |  |  (Start/Stop)      |               |  |
|  |  +--------+---------+  +---------+----------+               |  |
|  |           |                      |                          |  |
|  |  +--------v----------------------v----------+               |  |
|  |  |          WebSocket Manager               |               |  |
|  |  |   - Connection management                |               |  |
|  |  |   - Message serialization                |               |  |
|  |  |   - Auto-reconnect                       |               |  |
|  |  +-------------------+----------------------+               |  |
|  +----------------------|----------------------------------+   |
+-------------------------|--------------------------------------+
                          |
                          | WebSocket (ws://<host>:8000/ws/terminal)
                          |
+-------------------------|--------------------------------------+
|                         v                                      |
|  +----------------------------------------------------------+  |
|  |              Express.js Backend Server                    |  |
|  |  +----------------------+  +---------------------------+  |  |
|  |  | REST API Endpoints   |  | WebSocket Handler         |  |  |
|  |  | - POST /api/terminal/start  |  - /ws/terminal        |  |  |
|  |  | - POST /api/terminal/stop   |  - Bidirectional msgs  |  |  |
|  |  | - GET  /api/terminal/status |  +-------------+--------+  |  |
|  |  +----------------------+                |                |  |
|  |                                          |                |  |
|  |  +---------------------------------------v-------------+  |  |
|  |  |              PTY Manager                             |  |  |
|  |  |  - Process lifecycle management                       |  |  |
|  |  |  - Input/output buffering                              |  |  |
|  |  |  - Session tracking                                    |  |  |
|  |  +------------------------+-----------------------------+  |  |
|  +---------------------------|--------------------------------+  |
+------------------------------|------------------------------------+
                               |
                               | ConPTY Interface (node-pty)
                               |
+------------------------------v------------------------------------+
|                      Windows ConPTY                                |
|  +--------------------------------------------------------------+  |
|  |                    codex process                              |  |
|  |  - Receives stdin from PTY                                    |  |
|  |  - Sends stdout/stderr to PTY                              |  |
|  |  - Full terminal emulation support                         |  |
|  +--------------------------------------------------------------+  |
+--------------------------------------------------------------------+
```

---

## Tech Stack

### Backend (Node.js/TypeScript)

| Library | Version | Role |
|---------|---------|------|
| express | ^4.21.0 | Web framework with middleware support |
| ws | ^8.18.0 | WebSocket server implementation |
| node-pty | ^1.0.0 | PTY interface (Microsoft's library, used by VS Code) |
| typescript | ^5.6.0 | TypeScript compiler |
| dotenv | ^16.4.0 | Environment configuration management |

### Frontend (React/TypeScript)

| Library | Version | Role |
|---------|---------|------|
| react | ^18.3.0 | UI framework |
| typescript | ^5.6.0 | Static typing |
| @xterm/xterm | ^5.5.0 | Web terminal emulator |
| @xterm/addon-fit | ^0.10.0 | Auto-fit terminal to container |
| @xterm/addon-weblinks | ^0.11.0 | Clickable links in terminal |
| vite | ^6.0.0 | Build tool and dev server |

---

## Run on Windows

### Backend (FastAPI)

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\backend\requirements.txt
```

Start the backend on port 8000 (recommended for dev):

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Run on an alternate port (useful to validate changes without touching the main server):

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Notes:

- **Working directory**: run `uvicorn` from `backend/`.
- **Codex command** is controlled by `backend/.env` via `CODEX_COMMAND`.
- For local testing (no Codex installed), you can set `CODEX_COMMAND=cmd.exe`.

### Frontend (Vite dev server)

Run the backend first (default proxy targets `http://localhost:8000`). Then:

```powershell
cd .\frontend
npm install
npm run dev
```

### Frontend build (served by FastAPI)

This produces static files in `backend/static/` (see `frontend/vite.config.ts`).

```powershell
cd .\frontend
npm run build
```

Then start the backend and open:

- `http://127.0.0.1:8000/`

### End-to-end terminal + presets test script

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test_terminal_ws_preset.ps1
```

Against an alternate backend port:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test_terminal_ws_preset.ps1 -BaseUrl http://127.0.0.1:8001 -WsUrl ws://127.0.0.1:8001/ws/terminal
```

---

## Full File Structure

```
webcodeai/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI entry point
│   │   ├── config.py                  # Configuration (env vars, constants)
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── terminal.py            # REST endpoints (start/stop/status)
│   │   │   └── presets.py             # Preset CRUD REST endpoints
│   │   │
│   │   ├── websocket/
│   │   │   ├── __init__.py
│   │   │   ├── handler.py             # WebSocket endpoint /ws/terminal
│   │   │   └── manager.py             # Active connections manager
│   │   │
│   │   ├── pty/
│   │   │   ├── __init__.py
│   │   │   ├── manager.py             # PTY sessions manager (singleton)
│   │   │   ├── session.py             # Individual PTY session
│   │   │   └── reader.py              # PTY output reader
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── messages.py            # Pydantic WebSocket message models
│   │   │   └── preset.py              # Preset models
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── preset_service.py      # Preset CRUD service
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── keymapper.py           # Special-key mapping to escape sequences (optional fallback)
│   │
│   ├── static/                        # Built frontend (served by FastAPI)
│   │   └── (files generated by npm build)
│   │
│   ├── data/
│   │   └── presets/
│   │       └── global.json            # Default global presets
│   │   └── workspaces.json            # [NEW] Allowed workspaces list
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                   # React entry point
│   │   ├── App.tsx                    # Root component
│   │   ├── App.css
│   │   │
│   │   ├── components/
│   │   │   ├── Terminal/
│   │   │   │   ├── Terminal.tsx       # Wrapper xterm.js
│   │   │   │   └── Terminal.css
│   │   │   │
│   │   │   ├── ControlPanel/
│   │   │   │   ├── ControlPanel.tsx   # Start/Stop buttons + status
│   │   │   │   └── ControlPanel.css
│   │   │   │
│   │   │   ├── PresetSelector/
│   │   │   │   ├── PresetSelector.tsx # Preset selection dropdown
│   │   │   │   └── PresetSelector.css
│   │   │   │
│   │   │   └── PresetManager/
│   │   │       ├── PresetManager.tsx  # Preset manager modal
│   │   │       ├── PresetForm.tsx     # Create/edit form
│   │   │       ├── PresetList.tsx     # Presets list
│   │   │       └── PresetManager.css
│   │   │
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts        # WebSocket connection hook
│   │   │   ├── useTerminal.ts         # xterm instance hook
│   │   │   └── usePresets.ts          # Presets hook
│   │   │
│   │   ├── services/
│   │   │   └── api.ts                 # REST API client
│   │   │
│   │   ├── types/
│   │   │   ├── messages.ts            # TypeScript types for messages
│   │   │   └── preset.ts              # TypeScript types for presets
│   │   │
│   ├── public/
│   │   └── index.html
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── wdoc.md                            # This document
```

---

## Detailed Module Description

### Backend

#### `app/main.py` - FastAPI entry point
```python
# Responsibilities:
# - Initialize the FastAPI application
# - Configure CORS (dev)
# - Register API and WebSocket routes
# - Serve frontend static files
# - Manage lifecycle (startup/shutdown)
```

#### `app/config.py` - Configuration
```python
# Contains:
# - CODEX_COMMAND: str = "codex"  # Command to execute
# - TERMINAL_COLS: int = 80       # Default width
# - TERMINAL_ROWS: int = 24       # Default height
# - WS_HEARTBEAT_INTERVAL: int = 30  # Seconds
```

#### `app/api/terminal.py` - REST API
```python
# Endpoints:
# POST /api/terminal/start  - Start the codex process
# POST /api/terminal/stop   - Stop the process
# GET  /api/terminal/status - Return current status
```

#### `app/websocket/handler.py` - WebSocket Handler
```python
# Responsibilities:
# - Accept WebSocket connections on /ws/terminal
# - Route incoming messages (input, resize, optional special_key)
# - Stream PTY output to clients (broadcast)
# - Handle disconnects cleanly
```

#### `app/websocket/manager.py` - Connection Manager
```python
# Responsibilities:
# - Track active WebSocket connections
# - Broadcast messages to all connections (shared session)
# - Cleanup dead connections
```

#### `app/pty/session.py` - Session PTY
```python
# PTYSession class:
# - __init__(command, cols, rows)
# - start() -> bool           # Spawn process with pywinpty
# - write(data: str)          # Write to stdin
# - read() -> str             # Blocking read (used by the reader thread)
# - resize(cols, rows)        # Resize terminal
# - stop()                    # Stop process
# - is_alive() -> bool        # Check if process is alive
```

#### `app/pty/manager.py` - PTY Manager
```python
# Singleton managing:
# - Session creation/destruction
# - Access to the current session
# - Resource cleanup
```

#### `app/pty/reader.py` - Output Reader Thread
```python
# Responsibilities:
# - Dedicated thread reading from the PTY (blocking reads)
# - UTF-8 decode output
# - Manage Ring Buffer (session history)
# - Manage Backpressure (Fixed-size Queue with drop-old strategy)
# - Push chunks into a thread-safe Queue
```

#### `app/models/messages.py` - Message Models
```python
# Pydantic models for:
# - InputMessage (raw terminal data)
# - SpecialKeyMessage (optional fallback)
# - ResizeMessage (terminal dimensions)
# - OutputMessage (terminal output)
# - StatusMessage (process status)
# - ErrorMessage (errors)
```

#### `app/utils/keymapper.py` - Key Mapper
```python
# Functions:
# - map_special_key(key: str, modifiers: list) -> str
# - Returns the corresponding escape sequence (optional fallback)
```

### Frontend

#### `src/components/Terminal/Terminal.tsx`
```typescript
// Responsibilities:
// - Initialize xterm.js with addons
// - Connect to the WebSocket
// - Send user input via WS (xterm `onData`)
// - Render output received via WS
// - Handle resize with addon-fit
```

#### `src/components/ControlPanel/ControlPanel.tsx`
```typescript
// Responsibilities:
// - Start button (calls POST /api/terminal/start)
// - Stop button (calls POST /api/terminal/stop)
// - Status indicator (running/stopped/error)
```

#### `src/hooks/useWebSocket.ts`
```typescript
// Custom hook:
// - Establish WebSocket connection
// - Handle automatic reconnect
// - Expose send() and onMessage callback
// - Track connection state
```

#### `src/hooks/useTerminal.ts`
```typescript
// Custom hook:
// - Create/destroy xterm.js instance
// - Configure addons
// - Bind events (onData, optional onKey)
```

#### `src/types/messages.ts`
```typescript
// Types matching backend models:
// - WebSocketMessage (type union)
// - InputPayload, OutputPayload, etc.
```

---
## WebSocket Protocol

### Connection URL
```
ws://<host>:8000/ws/terminal
```

Recommended client-side URL construction:

`ws://${window.location.host}/ws/terminal`

### Base Message Format
```json
{
  "type": "message_type",
  "payload": { ... },
  "timestamp": "2025-01-11T12:00:00.000Z"  // Optional
}
```

### Client → Server Messages

#### Input (Raw Terminal Data)
Sent on every xterm `onData` event. This includes normal text, Enter, arrow keys, and control shortcuts.
```json
{
  "type": "input",
  "payload": {
    "data": "help\r"
  }
}
```

#### Special Key (Optional Fallback)
Optional message type if you decide to intercept browser-level shortcuts and re-inject them.
```json
{
  "type": "special_key",
  "payload": {
    "key": "ArrowUp",
    "modifiers": []
  }
}
```

Possible values for `key`:
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- `Enter`, `Escape`, `Tab`, `Backspace`, `Delete`
- `Home`, `End`, `PageUp`, `PageDown`
- `F1` to `F12`

Possible values for `modifiers`:
- `["ctrl"]`, `["alt"]`, `["shift"]`
- Or combinations: `["ctrl", "shift"]`

#### Resize
Sent when the terminal viewport is resized.
```json
{
  "type": "resize",
  "payload": {
    "cols": 120,
    "rows": 40
  }
}
```

#### Ping (Keep-alive)
```json
{
  "type": "ping",
  "payload": {}
}
```

### Server → Client Messages

#### Output (Terminal Data)
Contains Codex output (may include ANSI sequences).
```json
{
  "type": "output",
  "payload": {
    "data": "\u001b[32mSuccess!\u001b[0m\r\n"
  }
}
```

#### Status
Sent when the process state changes.
```json
{
  "type": "status",
  "payload": {
    "status": "running",
    "message": "Process started successfully",
    "pid": 12345
  }
}
```

Possible values for `status`:
- `running` - Process is running
- `stopped` - Process is stopped
- `error` - Error occurred

#### Error
```json
{
  "type": "error",
  "payload": {
    "code": "PTY_ERROR",
    "message": "Failed to spawn process"
  }
}
```

#### Pong
```json
{
  "type": "pong",
  "payload": {}
}
```

---

## Optional Reference: Special Keys → Escape Sequences

In the MVP, xterm `onData` is expected to emit the correct sequences directly. This table is only a reference (or for the optional `special_key` fallback path).

| Key | Escape Sequence | Description |
|--------|-----------------|-------------|
| ArrowUp | `\x1b[A` | Up arrow |
| ArrowDown | `\x1b[B` | Down arrow |
| ArrowRight | `\x1b[C` | Right arrow |
| ArrowLeft | `\x1b[D` | Left arrow |
| Enter | `\r` | Enter |
| Escape | `\x1b` | Escape |
| Tab | `\t` | Tab |
| Backspace | `\x7f` | Backspace |
| Delete | `\x1b[3~` | Delete |
| Home | `\x1b[H` | Home |
| End | `\x1b[F` | End |
| PageUp | `\x1b[5~` | Page Up |
| PageDown | `\x1b[6~` | Page Down |
| F1 | `\x1bOP` | F1 |
| F2 | `\x1bOQ` | F2 |
| F3 | `\x1bOR` | F3 |
| F4 | `\x1bOS` | F4 |
| F5 | `\x1b[15~` | F5 |
| F6 | `\x1b[17~` | F6 |
| F7 | `\x1b[18~` | F7 |
| F8 | `\x1b[19~` | F8 |
| F9 | `\x1b[20~` | F9 |
| F10 | `\x1b[21~` | F10 |
| F11 | `\x1b[23~` | F11 |
| F12 | `\x1b[24~` | F12 |

### With Modifiers

| Combination | Escape Sequence |
|-------------|-----------------|
| Ctrl+C | `\x03` |
| Ctrl+D | `\x04` |
| Ctrl+Z | `\x1a` |
| Ctrl+L | `\x0c` |
| Ctrl+Up | `\x1b[1;5A` |
| Ctrl+Down | `\x1b[1;5B` |
| Ctrl+Right | `\x1b[1;5C` |
| Ctrl+Left | `\x1b[1;5D` |
| Shift+Tab | `\x1b[Z` |

---

## REST API Endpoints

### POST /api/terminal/start

Starts a new terminal session with codex.

**Request:**
```json
{
  "command": "codex",        // Optional, default: config
  "args": [],                // Optional
  "cwd": "C:\\Users\\...",   // Optional
  "cols": 80,                // Optional, default: 80
  "rows": 24                 // Optional, default: 24
}
```

**Response 200:**
```json
{
  "success": true,
  "session_id": "uuid-string",
  "status": "running",
  "pid": 12345
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "Session already running"
}
```

### POST /api/terminal/stop

Stops the active terminal session.

**Request:**
```json
{
  "force": false  // Optional. When true, uses a hard termination strategy on Windows.
}
```

**Response 200:**
```json
{
  "success": true,
  "status": "stopped"
}
```

### GET /api/terminal/status

Returns the current session state.

**Response 200:**
```json
{
  "status": "running",
  "pid": 12345,
  "uptime_seconds": 3600,
  "dimensions": {
    "cols": 80,
    "rows": 24
  }
}
```

---

## Detailed Implementation Steps

### Phase 1: Project Setup (Backend)

**Step 1.1: Create folder structure**
```
mkdir -p backend/app/{api,websocket,pty,models,utils}
mkdir -p backend/static
```

**Step 1.2: Create requirements.txt**
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
pywinpty>=2.0.0
pydantic>=2.0.0
python-dotenv>=1.0.0
```

**Step 1.3: Create __init__.py files**

### Phase 2: Core PTY (Backend)

**Step 2.1: Implement `app/pty/session.py`**

Main class wrapping pywinpty:
- `start()` to spawn the process
- `write(data)` to send input
- `read()` (blocking) to read output
- `resize(cols, rows)` to resize the terminal
- `stop()` to stop the process
- `is_alive` property to check running state

**Step 2.2: Implement `app/pty/reader.py`**

Reader thread design:
- Dedicated thread reading from the PTY (blocking reads)
- Pushes decoded UTF-8 chunks into a thread-safe `Queue`
- Async WebSocket layer drains the queue and broadcasts output

**Step 2.3: Implement `app/pty/manager.py`**

Singleton manager:
- `create_session()`
- `get_session()`
- `destroy_session()`
- Cleanup on app shutdown

**Step 2.4: Implement `app/utils/keymapper.py`**

Optional mapping function (fallback only):
```python
def map_key(key: str, modifiers: list[str]) -> str:
    # Returns an escape sequence
```

### Phase 3: API & WebSocket (Backend)

**Step 3.1: Implement `app/models/messages.py`**

Pydantic models for all message types.

**Step 3.2: Implement `app/websocket/manager.py`**

ConnectionManager class:
- `connect(websocket)` - Add connection
- `disconnect(websocket)` - Remove connection
- `send_message(websocket, message)` - Send
- `broadcast(message)` - Broadcast to all

**Step 3.3: Implement `app/websocket/handler.py`**

WebSocket endpoint:
- Accept connection
- Receive loop
- Route messages to PTY
- Parallel task(s) to stream output

**Step 3.4: Implement `app/api/terminal.py`**

REST routes:
- start, stop, status

**Step 3.5: Implement `app/config.py`**

Configuration variables.

**Step 3.6: Implement `app/main.py`**

Final assembly:
- Create FastAPI app
- Add CORS middleware (dev)
- Include routers
- Mount static files (SPA)
- Lifecycle events

### Phase 4: Project Setup (Frontend)

**Step 4.1: Initialize project**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 4.2: Install dependencies**
```bash
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-weblinks
```

**Step 4.3: Configure vite.config.ts**

Build output to `../backend/static`

### Phase 5: Components (Frontend)

**Step 5.1: Create `src/types/messages.ts`**

TypeScript types mirroring Pydantic models.

**Step 5.2: Create `src/services/api.ts`**

Fetch client for the REST API.

**Step 5.3: Create `src/hooks/useWebSocket.ts`**

Hook managing:
- Connect/disconnect
- Auto-reconnect
- Send/receive

**Step 5.4: Create `src/hooks/useTerminal.ts`**

Hook managing xterm.js instance.

**Step 5.5: Create `src/components/Terminal/Terminal.tsx`**

Main terminal component.

**Step 5.6: Create `src/components/ControlPanel/ControlPanel.tsx`**

Control panel.

**Step 5.7: Assemble `src/App.tsx`**

Main layout.

### Phase 6: Integration & Tests

**Step 6.1: Build frontend**
```bash
cd frontend && npm run build
```

**Step 6.2: Start server**
```bash
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Step 6.3: Manual tests**
- Open http://<host>:8000
- Test Start/Stop
- Test typing input
- Test arrow key navigation
- Test terminal resize

---

## Integrated Deployment

The frontend is built and served directly by FastAPI (single server on port 8000).

### Vite Configuration (frontend/vite.config.ts)
```typescript
export default defineConfig({
  build: {
    outDir: '../backend/static',
    emptyOutDir: true
  }
})
```

### FastAPI Configuration (backend/app/main.py)
```python
from fastapi.staticfiles import StaticFiles

# At the end, after registering API/WS routes
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

---

## Detailed Data Flows

### Flow: Start Session

```
1. User clicks "Start"
2. Frontend POST /api/terminal/start
3. Backend creates PTYSession
4. PTYSession.start() spawn "codex" via pywinpty
5. Backend starts the output reader thread
6. Backend returns {success: true, pid: ...}
7. Frontend connects WebSocket
8. Backend sends status "running"
9. Frontend enables terminal input
```

### Flow: Send Command

```
1. User types "help" + Enter in xterm.js
2. xterm.js onData("help\r")
3. useWebSocket.send({type: "input", payload: {data: "help\r"}})
4. WebSocket sends to server
5. handler.py receives message
6. PTYSession.write("help\r")
7. pywinpty writes to the process stdin
8. codex processes the command
```

### Flow: Receive Output

```
1. codex writes to stdout
2. ConPTY captures the output
3. reader thread reads via pywinpty.read()
4. reader thread pushes into the queue
5. handler.py drains the queue
6. handler.py broadcasts {type: "output", payload: {data: "..."}}
7. WebSocket sends to clients
8. useWebSocket.onMessage callback
9. Terminal.tsx writes into xterm.js
10. xterm.js renders with ANSI support
```

### Flow: Menu Navigation (Arrow Keys)

```
1. User presses ↓ (ArrowDown)
2. xterm.js emits the correct escape sequence via `onData`
3. Frontend sends `{type: "input", payload: {data: "..."}}`
4. WebSocket sends to server
5. handler.py receives the message
6. PTYSession.write(data)
7. codex receives the escape sequence
8. codex updates its TUI selection and renders new output
```

---

## Error Handling

### Backend

- **ProcessError**: If codex cannot start
- **ConnectionError**: If the WebSocket disconnects
- **TimeoutError**: If PTY reads time out

All errors are sent to clients via the `error` message.

### Frontend

- **WebSocket reconnect**: Exponential backoff (1s, 2s, 4s, max 30s)
- **API error**: Display in ControlPanel
- **Terminal error**: Log + user message

---

## Feature: Presets (Common Commands)

### Description

Dropdown allowing quick sending of pre-defined instructions to Codex. Presets are organized into two levels:

1. **Global Presets** - Available for all projects
2. **Project Presets** - Specific to the current project

### Storage (JSON Files)

```
webcodeai/
├── backend/
│   └── data/
│       └── presets/
│           └── global.json         # Global presets
│
└── [project_folder]/
    └── .webcodeai/
        └── presets.json            # Project presets
```

### Preset JSON Format

```json
{
  "version": "1.0",
  "presets": [
    {
      "id": "uuid-string",
      "name": "Fix bugs",
      "description": "Ask Codex to fix bugs",
      "command": "Analyze the code and fix all bugs you find. Explain each change.",
      "category": "debug",
      "shortcut": "Ctrl+1",
      "createdAt": "2025-01-11T12:00:00Z",
      "updatedAt": "2025-01-11T12:00:00Z"
    },
    {
      "id": "uuid-string-2",
      "name": "Add tests",
      "description": "Generate unit tests",
      "command": "Generate unit tests for the current codebase using pytest.",
      "category": "testing",
      "shortcut": null,
      "createdAt": "2025-01-11T12:00:00Z",
      "updatedAt": "2025-01-11T12:00:00Z"
    }
  ]
}
```

### Suggested Categories

| Category | Description |
|----------|-------------|
| `general` | General commands |
| `debug` | Debugging and bug fixing |
| `testing` | Testing and validation |
| `refactor` | Refactoring |
| `docs` | Documentation |
| `review` | Code review |
| `custom` | Custom |

### Additional Frontend Components

#### `src/components/PresetSelector/PresetSelector.tsx`
```typescript
// Responsibilities:
// - Dropdown with groups (Global / Project)
// - Search/filter presets
// - Category display with icons
// - "Send" button to execute the preset (inject into terminal)
// - Tooltip with full description
```

#### `src/components/PresetManager/PresetManager.tsx`
```typescript
// Responsibilities:
// - Preset management modal/panel
// - Presets list (global + project)
// - Create/edit form
// - Delete/duplicate buttons
// - Drag & drop to reorder
```

#### `src/components/PresetManager/PresetForm.tsx`
```typescript
// Form fields:
// - name (required)
// - description (optional)
// - command (required, multiline textarea)
// - category (dropdown)
// - shortcut (optional)
// - scope (global or project)
```

### Presets API Endpoints

#### GET /api/presets
Returns all presets (global + project).

**Query params:**
- `project_path` (optional): Path of the project to load its presets

**Response 200:**
```json
{
  "global": [
    { "id": "...", "name": "...", "command": "...", ... }
  ],
  "project": [
    { "id": "...", "name": "...", "command": "...", ... }
  ]
}
```

#### POST /api/presets
Creates a new preset.

**Request:**
```json
{
  "name": "My preset",
  "description": "Description",
  "command": "The command to inject",
  "category": "general",
  "scope": "global",
  "project_path": null
}
```

**Response 201:**
```json
{
  "success": true,
  "preset": { "id": "new-uuid", ... }
}
```

#### PUT /api/presets/{id}
Updates an existing preset.

**Request:**
```json
{
  "name": "New name",
  "command": "New command",
  "scope": "global"
}
```

#### DELETE /api/presets/{id}
Deletes a preset.

**Query params:**
- `scope`: "global" or "project"
- `project_path`: Required if scope=project

**Response 200:**
```json
{
  "success": true
}
```

#### POST /api/presets/{id}/execute
Executes the preset by injecting its command into the terminal input stream.

**Response 200:**
```json
{
  "success": true,
  "command_sent": "The injected command..."
}
```

### Additional Backend Models

#### `app/models/preset.py`
```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum
from typing import List

class PresetVariable(BaseModel):
    name: str
    description: str
    default: Optional[str] = None

class PresetCategory(str, Enum):
    GENERAL = "general"
    DEBUG = "debug"
    TESTING = "testing"
    REFACTOR = "refactor"
    DOCS = "docs"
    REVIEW = "review"
    CUSTOM = "custom"

class PresetScope(str, Enum):
    GLOBAL = "global"
    PROJECT = "project"

class Preset(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    command: str
    variables: List[PresetVariable] = []  # [NEW]
    category: PresetCategory = PresetCategory.GENERAL
    shortcut: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class PresetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    command: str
    category: PresetCategory = PresetCategory.GENERAL
    shortcut: Optional[str] = None
    scope: PresetScope
    project_path: Optional[str] = None

class PresetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    command: Optional[str] = None
    category: Optional[PresetCategory] = None
    shortcut: Optional[str] = None
```

### Backend Service

#### `app/services/preset_service.py`
```python
# Responsibilities:
# - Load/save JSON files
# - CRUD operations on presets
# - Data validation
# - Path handling (global vs project)
```

### Updated File Structure

```
webcodeai/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── terminal.py
│   │   │   └── presets.py          # NEW: Preset routes
│   │   ├── models/
│   │   │   ├── messages.py
│   │   │   └── preset.py           # NEW: Preset models
│   │   └── services/
│   │       └── preset_service.py   # NEW: Preset business logic
│   │
│   └── data/
│       └── presets/
│           └── global.json         # NEW: Global presets
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Terminal/
│   │   │   ├── ControlPanel/
│   │   │   ├── PresetSelector/     # NEW
│   │   │   │   ├── PresetSelector.tsx
│   │   │   │   └── PresetSelector.css
│   │   │   └── PresetManager/      # NEW
│   │   │       ├── PresetManager.tsx
│   │   │       ├── PresetForm.tsx
│   │   │       ├── PresetList.tsx
│   │   │       └── PresetManager.css
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useTerminal.ts
│   │   │   └── usePresets.ts       # NEW
│   │   └── types/
│   │       ├── messages.ts
│   │       └── preset.ts           # NEW
```

### User Interface (English)

```
+------------------------------------------------------------------+
|  [Presets: v] [Select a preset...]                 [Manage]      |
+------------------------------------------------------------------+
|  Dropdown open:                                                   |
|  ┌────────────────────────────────────────────────────────────┐  |
|  │ 🔍 Search...                                                │  |
|  ├────────────────────────────────────────────────────────────┤  |
|  │ ── GLOBAL ──                                                │  |
|  │ 🐛 Fix bugs                                      Ctrl+1     │  |
|  │ 🧪 Add tests                                     Ctrl+2     │  |
|  │ 📝 Generate documentation                                  │  |
|  ├────────────────────────────────────────────────────────────┤  |
|  │ ── PROJECT: MyApp ──                                        │  |
|  │ 🔧 Build and deploy                                        │  |
|  │ 🔍 Analyze dependencies                                    │  |
|  └────────────────────────────────────────────────────────────┘  |
+------------------------------------------------------------------+
|                                                                    |
|                         [TERMINAL XTERM.JS]                        |
|                                                                    |
+------------------------------------------------------------------+
|  [▶️ Start]  [⏹️ Stop]  Status: 🟢 Running                         |
+------------------------------------------------------------------+
```

### Presets Implementation Steps

**Additional Phase: Presets**

1. Create `app/models/preset.py` - Pydantic models
2. Create `app/services/preset_service.py` - CRUD service
3. Create `app/api/presets.py` - API routes
4. Create `data/presets/global.json` - Initial file with examples
5. Create `src/types/preset.ts` - TypeScript types
6. Create `src/hooks/usePresets.ts` - React hook
7. Create `PresetSelector.tsx` - Dropdown component
8. Create `PresetManager.tsx` - Management UI
9. Create `PresetForm.tsx` - Create/edit form
10. Integrate into `App.tsx` - Final layout

### Default Presets Examples

```json
{
  "version": "1.0",
  "presets": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Fix bugs",
      "description": "Analyze and fix bugs in the code",
      "command": "Analyze the code and fix all bugs you find. Explain each change.",
      "category": "debug",
      "shortcut": "Ctrl+1"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Add tests",
      "description": "Generate unit tests",
      "command": "Generate comprehensive unit tests for the current codebase. Use pytest and aim for good coverage.",
      "category": "testing",
      "shortcut": "Ctrl+2"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Refactor",
      "description": "Improve code quality",
      "command": "Refactor the code to improve readability and maintainability. Apply best practices.",
      "category": "refactor",
      "shortcut": "Ctrl+3"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "Document",
      "description": "Add documentation",
      "command": "Add relevant docstrings and documentation. Generate or update a README if needed.",
      "category": "docs",
      "shortcut": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "name": "Code review",
      "description": "Perform a code review",
      "command": "Perform a thorough code review. Identify security, performance, and style issues. Suggest improvements.",
      "category": "review",
      "shortcut": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "name": "Explain code",
      "description": "Explain how the code works",
      "command": "Explain in detail how this code works. Describe the architecture, patterns used, and data flow.",
      "category": "general",
      "shortcut": null
    }
  ]
}
```

---

## Security (Not Implemented in MVP)

This MVP intentionally ships without authentication/authorization and with minimal hardening. It is intended to be used on a trusted LAN.

- Shared PTY session: single active session, output broadcast to all connected clients.
- Future hardening can add authentication, origin checks, rate limiting, and safe `project_path` handling.

---

## System Requirements

- **Windows 10 version 1809** (Build 17763) or newer
- **Python 3.10+**
- **Node.js 18+**
- **codex CLI** installed and accessible in PATH

---

## Development Commands

### Backend
```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run in dev mode
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
# Install dependencies
cd frontend
npm install

# Dev mode (Vite). Use --host to access from the LAN
npm run dev -- --host

# Build production
npm run build
```

### Production
```bash
# Build frontend
cd frontend && npm run build

# Start backend (also serves frontend)
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Verification Tests

### Terminal
- [ ] Backend starts without errors
- [ ] Frontend builds without error
- [ ] Web UI is reachable on http://<host>:8000 (LAN)
- [ ] Start button starts Codex
- [ ] Terminal displays Codex output
- [ ] Typed input is sent to Codex (xterm `onData`)
- [ ] Enter executes commands
- [ ] Arrow keys navigate Codex menus
- [ ] Stop button stops Codex
- [ ] Terminal resize resizes the PTY
- [ ] Auto-reconnect works when WebSocket disconnects

### Presets
- [ ] Dropdown shows global presets
- [ ] Dropdown shows project presets (if configured)
- [ ] Selecting a preset injects it into the terminal
- [ ] "Manage" button opens the preset manager
- [ ] Creating a new preset works
- [ ] Editing an existing preset works
- [ ] Deleting a preset works
- [ ] Global presets are stored in data/presets/global.json
- [ ] Project presets are stored in .webcodeai/presets.json
- [ ] Keyboard shortcuts work (if configured)

---

## Design System

The following design rules must be respected to maintain a "Premium" and consistent UI.

### Color Palette (Dark Mode)

| Token | Hex Value | Usage |
|-------|------------|-------|
| `--bg-app` | `#0f172a` | Main Background (Slate 900) |
| `--bg-panel` | `#1e293b` | Panels/Modals Background (Slate 800) |
| `--bg-term` | `#000000` | Terminal Background (Strict Black) |
| `--text-primary` | `#f8fafc` | Primary Text (Slate 50) |
| `--text-secondary` | `#94a3b8` | Secondary Text (Slate 400) |
| `--accent-primary` | `#3b82f6` | Primary Actions (Blue 500) |
| `--accent-hover` | `#2563eb` | Hover Actions (Blue 600) |
| `--accent-danger` | `#ef4444` | Errors/Destructive (Red 500) |
| `--accent-success` | `#22c55e` | Success/Running (Green 500) |
| `--border-subtle` | `#334155` | Subtle Borders (Slate 700) |

### Typography

- **Font Family**: `Inter`, system-ui, sans-serif
- **Monospace**: `JetBrains Mono`, `Fira Code`, monospace
- **Sizes**:
  - `text-xs`: 0.75rem
  - `text-sm`: 0.875rem
  - `text-base`: 1rem
  - `text-lg`: 1.125rem
  - `text-xl`: 1.25rem

### UI Components

#### Glassmorphism
Use opacity on floating panel backgrounds with `backdrop-filter: blur(8px)`.
Example: `background: rgba(30, 41, 59, 0.8);`

#### Animations
- **Transitions**: `transition-all duration-200 ease-in-out`
- **Hover**: Slight elevation or brightening
- **Active**: Slight scale down (`transform: scale(0.98)`)

#### Spacing
Use a 4px grid (Tailwind style).
- `p-2` (8px), `p-4` (16px), `gap-4` (16px)

---
