import WebSocket from 'ws';
import { ptyManager } from '../pty/manager.js';
import { OutputMessage } from '../types/messages.types.js';

class ConnectionManager {
  private connections: Set<WebSocket> = new Set();
  private outputListener: ((chunk: string) => void) | null = null;

  constructor() {
    this.outputListener = (chunk: string) => {
      const msg: OutputMessage = {
        type: 'output',
        payload: { data: chunk },
      };
      this.broadcast(msg);
    };
    ptyManager.onOutput(this.outputListener);
  }

  connect(ws: WebSocket): void {
    this.connections.add(ws);
  }

  disconnect(ws: WebSocket): void {
    this.connections.delete(ws);
  }

  sendJson(ws: WebSocket, message: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(message: unknown): void {
    const dead: WebSocket[] = [];
    const msgStr = JSON.stringify(message);

    for (const ws of this.connections) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msgStr);
        } else {
          dead.push(ws);
        }
      } catch {
        dead.push(ws);
      }
    }

    for (const ws of dead) {
      this.connections.delete(ws);
    }
  }

  shutdown(): void {
    if (this.outputListener) {
      ptyManager.removeOutputListener(this.outputListener);
    }
    for (const ws of this.connections) {
      try {
        ws.close();
      } catch {
        // Ignore
      }
    }
    this.connections.clear();
  }
}

export const wsManager = new ConnectionManager();
