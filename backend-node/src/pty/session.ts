import * as pty from 'node-pty';
import { spawn } from 'child_process';

export interface PTYDimensions {
  cols: number;
  rows: number;
}

export class PTYSession {
  private command: string;
  private args: string[];
  private cwd: string | undefined;
  public dimensions: PTYDimensions;

  private proc: pty.IPty | null = null;
  public pid: number | null = null;

  private onDataCallback: ((data: string) => void) | null = null;
  private onExitCallback: ((code: number | undefined, signal: number | undefined) => void) | null = null;

  constructor(options: {
    command: string;
    args?: string[];
    cwd?: string;
    cols?: number;
    rows?: number;
  }) {
    this.command = options.command;
    this.args = options.args || [];
    this.cwd = options.cwd;
    this.dimensions = {
      cols: options.cols || 80,
      rows: options.rows || 24,
    };
  }

  onData(callback: (data: string) => void): void {
    this.onDataCallback = callback;
  }

  onExit(callback: (code: number | undefined, signal: number | undefined) => void): void {
    this.onExitCallback = callback;
  }

  start(): void {
    this.proc = pty.spawn(this.command, this.args, {
      name: 'xterm-256color',
      cols: this.dimensions.cols,
      rows: this.dimensions.rows,
      cwd: this.cwd || process.cwd(),
      env: process.env as { [key: string]: string },
    });

    this.pid = this.proc.pid;

    this.proc.onData((data) => {
      if (this.onDataCallback) {
        this.onDataCallback(data);
      }
    });

    this.proc.onExit(({ exitCode, signal }) => {
      if (this.onExitCallback) {
        this.onExitCallback(exitCode, signal);
      }
      this.proc = null;
      this.pid = null;
    });
  }

  isAlive(): boolean {
    return this.proc !== null;
  }

  write(data: string): void {
    if (!this.proc) return;
    this.proc.write(data);
  }

  resize(cols: number, rows: number): void {
    this.dimensions = { cols, rows };
    if (this.proc) {
      this.proc.resize(cols, rows);
    }
  }

  stop(force: boolean = false): void {
    if (!this.proc) return;

    const currentPid = this.pid;
    const currentProc = this.proc;

    try {
      currentProc.write('\x03');

      setTimeout(() => {
        try {
          currentProc.kill();
        } catch {
          // Ignore
        }

        if (force && process.platform === 'win32' && currentPid) {
          setTimeout(() => {
            spawn('taskkill', ['/PID', String(currentPid), '/T', '/F'], {
              stdio: 'ignore',
            });
          }, 100);
        }
      }, 150);
    } catch {
      // Ignore errors during stop
    }

    this.proc = null;
    this.pid = null;
  }
}
