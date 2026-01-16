import { v4 as uuidv4 } from 'uuid';
import { PTYSession } from './session.js';
import { stripTerminalIdentityResponses } from './sanitize.js';
import { HISTORY_MAX_BYTES, HISTORY_MAX_CHUNKS } from '../config.js';

interface PTYStartResult {
  session_id: string;
  pid: number | null;
  cols: number;
  rows: number;
}

interface PTYStatus {
  status: 'running' | 'stopped';
  pid: number | null;
  uptime_seconds: number;
  dimensions: { cols: number | null; rows: number | null };
  session_id: string | null;
  cwd: string | null;
}

type OutputListener = (chunk: string) => void;

class PTYManager {
  private session: PTYSession | null = null;
  private sessionId: string | null = null;
  private startedAt: number | null = null;
  private cwd: string | null = null;

  private outputListeners: OutputListener[] = [];

  private history: string[] = [];
  private historyBytes: number = 0;

  onOutput(listener: OutputListener): void {
    this.outputListeners.push(listener);
  }

  removeOutputListener(listener: OutputListener): void {
    const index = this.outputListeners.indexOf(listener);
    if (index > -1) {
      this.outputListeners.splice(index, 1);
    }
  }

  historySnapshot(): string[] {
    return [...this.history];
  }

  isRunning(): boolean {
    return this.session !== null && this.session.isAlive();
  }

  start(options: {
    command: string;
    args?: string[];
    cwd?: string;
    cols?: number;
    rows?: number;
  }): PTYStartResult {
    if (this.isRunning()) {
      throw new Error('Session already running');
    }

    this.history = [];
    this.historyBytes = 0;

    const cols = options.cols || 80;
    const rows = options.rows || 24;

    this.session = new PTYSession({
      command: options.command,
      args: options.args,
      cwd: options.cwd,
      cols,
      rows,
    });

    this.session.onData((chunk) => {
      const cleaned = stripTerminalIdentityResponses(chunk);
      if (!cleaned) return;

      this.pushHistory(cleaned);
      this.notifyOutputListeners(cleaned);
    });

    this.session.onExit(() => {
      this.notifyOutputListeners('\r\n[Process exited]\r\n');
    });

    this.session.start();

    this.sessionId = uuidv4();
    this.startedAt = Date.now();
    this.cwd = options.cwd || null;

    return {
      session_id: this.sessionId,
      pid: this.session.pid,
      cols,
      rows,
    };
  }

  private pushHistory(chunk: string): void {
    const bytes = Buffer.byteLength(chunk, 'utf-8');
    this.history.push(chunk);
    this.historyBytes += bytes;

    while (
      this.history.length > 0 &&
      (this.historyBytes > HISTORY_MAX_BYTES || this.history.length > HISTORY_MAX_CHUNKS)
    ) {
      const removed = this.history.shift()!;
      this.historyBytes -= Buffer.byteLength(removed, 'utf-8');
    }
  }

  private notifyOutputListeners(chunk: string): void {
    for (const listener of this.outputListeners) {
      try {
        listener(chunk);
      } catch {
        // Ignore listener errors
      }
    }
  }

  stop(force: boolean = false): void {
    if (!this.session) return;

    this.session.stop(force);
    this.session = null;
    this.sessionId = null;
    this.startedAt = null;
  }

  write(data: string): void {
    if (!this.session || !this.session.isAlive()) return;
    this.session.write(data);
  }

  resize(cols: number, rows: number): void {
    if (!this.session) return;
    this.session.resize(cols, rows);
  }

  status(): PTYStatus {
    const running = this.session !== null && this.session.isAlive();
    const pid = running && this.session ? this.session.pid : null;
    const dims = this.session
      ? { cols: this.session.dimensions.cols, rows: this.session.dimensions.rows }
      : { cols: null, rows: null };
    const uptime = running && this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;

    return {
      status: running ? 'running' : 'stopped',
      pid,
      uptime_seconds: uptime,
      dimensions: dims,
      session_id: this.sessionId,
      cwd: this.cwd,
    };
  }

  shutdown(): void {
    this.stop(true);
  }
}

export const ptyManager = new PTYManager();
