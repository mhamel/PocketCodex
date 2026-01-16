import { Router, Request, Response } from 'express';
import { ptyManager } from '../pty/manager.js';
import { wsManager } from '../websocket/manager.js';
import { isAllowedPath } from '../utils/workspaces.js';
import { CODEX_COMMAND, CODEX_ARGS, TERMINAL_COLS, TERMINAL_ROWS } from '../config.js';
import { StatusMessage } from '../types/messages.types.js';

const router = Router();

interface StartRequest {
  command?: string;
  args?: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
}

interface StopRequest {
  force?: boolean;
}

router.post('/start', (req: Request, res: Response) => {
  const body = req.body as StartRequest;

  if (body.cwd && !isAllowedPath(body.cwd)) {
    return res.status(400).json({ detail: 'cwd is not in the allowed workspaces' });
  }

  const command = body.command || CODEX_COMMAND;
  const cols = body.cols || TERMINAL_COLS;
  const rows = body.rows || TERMINAL_ROWS;

  try {
    const info = ptyManager.start({
      command,
      args: body.args || CODEX_ARGS,
      cwd: body.cwd,
      cols,
      rows,
    });

    const statusMsg: StatusMessage = {
      type: 'status',
      payload: { status: 'running', pid: info.pid, message: 'Process started' },
    };
    wsManager.broadcast(statusMsg);

    return res.json({
      success: true,
      session_id: info.session_id,
      status: 'running',
      pid: info.pid,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'Session already running') {
      return res.status(400).json({ detail: msg });
    }
    return res.status(500).json({ detail: `Terminal backend error: ${msg}` });
  }
});

router.post('/restart', (req: Request, res: Response) => {
  const body = req.body as StartRequest;

  if (body.cwd && !isAllowedPath(body.cwd)) {
    return res.status(400).json({ detail: 'cwd is not in the allowed workspaces' });
  }

  const command = body.command || CODEX_COMMAND;
  const cols = body.cols || TERMINAL_COLS;
  const rows = body.rows || TERMINAL_ROWS;

  if (ptyManager.isRunning()) {
    ptyManager.stop(true);
    const stopMsg: StatusMessage = {
      type: 'status',
      payload: { status: 'stopped', pid: null, message: 'Process stopped' },
    };
    wsManager.broadcast(stopMsg);
  }

  try {
    const info = ptyManager.start({
      command,
      args: body.args || CODEX_ARGS,
      cwd: body.cwd,
      cols,
      rows,
    });

    const statusMsg: StatusMessage = {
      type: 'status',
      payload: { status: 'running', pid: info.pid, message: 'Process started' },
    };
    wsManager.broadcast(statusMsg);

    return res.json({
      success: true,
      session_id: info.session_id,
      status: 'running',
      pid: info.pid,
    });
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(500).json({ detail: `Terminal backend error: ${msg}` });
  }
});

router.post('/stop', (req: Request, res: Response) => {
  const body = req.body as StopRequest;
  ptyManager.stop(body.force || false);

  const statusMsg: StatusMessage = {
    type: 'status',
    payload: { status: 'stopped', pid: null, message: 'Process stopped' },
  };
  wsManager.broadcast(statusMsg);

  return res.json({ success: true, status: 'stopped' });
});

router.get('/status', (_req: Request, res: Response) => {
  return res.json(ptyManager.status());
});

export default router;
