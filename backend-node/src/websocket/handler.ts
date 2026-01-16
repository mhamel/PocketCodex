import WebSocket, { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { wsManager } from './manager.js';
import { ptyManager } from '../pty/manager.js';
import { stripTerminalIdentityResponses } from '../pty/sanitize.js';
import { mapSpecialKey } from '../utils/keymapper.js';
import { StatusMessage, PongMessage } from '../types/messages.types.js';

export function setupWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/terminal' });

  wss.on('connection', (ws: WebSocket) => {
    wsManager.connect(ws);

    // Send history replay
    for (const chunk of ptyManager.historySnapshot()) {
      const cleaned = stripTerminalIdentityResponses(chunk);
      if (cleaned) {
        wsManager.sendJson(ws, { type: 'output', payload: { data: cleaned } });
      }
    }

    // Send current status
    const st = ptyManager.status();
    const statusMsg: StatusMessage = {
      type: 'status',
      payload: {
        status: st.status,
        pid: st.pid,
        message: null,
      },
    };
    wsManager.sendJson(ws, statusMsg);

    // Handle incoming messages
    ws.on('message', (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());
        const msgType = data.type;
        const payload = data.payload || {};

        if (msgType === 'input') {
          const raw = String(payload.data || '');
          const cleaned = stripTerminalIdentityResponses(raw);
          if (cleaned) {
            ptyManager.write(cleaned);
          }
        } else if (msgType === 'resize') {
          const cols = parseInt(payload.cols, 10) || 0;
          const rows = parseInt(payload.rows, 10) || 0;
          if (cols > 0 && rows > 0) {
            ptyManager.resize(cols, rows);
          }
        } else if (msgType === 'special_key') {
          const seq = mapSpecialKey(
            String(payload.key || ''),
            payload.modifiers || []
          );
          if (seq) {
            ptyManager.write(seq);
          }
        } else if (msgType === 'ping') {
          const pongMsg: PongMessage = { type: 'pong', payload: {} };
          wsManager.sendJson(ws, pongMsg);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      wsManager.disconnect(ws);
    });

    ws.on('error', () => {
      wsManager.disconnect(ws);
    });
  });
}
