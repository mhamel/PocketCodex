from __future__ import annotations

import os
import subprocess
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from winpty import PtyProcess


@dataclass
class PTYDimensions:
    cols: int
    rows: int


class PTYSession:
    def __init__(
        self,
        command: str,
        args: Optional[List[str]] = None,
        cwd: Optional[str] = None,
        cols: int = 80,
        rows: int = 24,
    ) -> None:
        self.command = command
        self.args = args or []
        self.cwd = cwd
        self.dimensions = PTYDimensions(cols=cols, rows=rows)

        self.proc: Optional["PtyProcess"] = None
        self.pid: Optional[int] = None

    def start(self) -> None:
        try:
            from winpty import PtyProcess
        except Exception as e:
            raise RuntimeError(
                "winpty module is not available. Install pywinpty (pip install pywinpty) "
                "and ensure your Python version is supported."
            ) from e

        argv = [self.command] + self.args
        env = os.environ.copy()
        self.proc = PtyProcess.spawn(
            argv,
            cwd=self.cwd,
            env=env,
            dimensions=(self.dimensions.rows, self.dimensions.cols),
        )
        self.pid = self.proc.pid

    def is_alive(self) -> bool:
        return bool(self.proc and self.proc.isalive())

    def write(self, data: str) -> None:
        if not self.proc:
            return
        self.proc.write(data)

    def read(self, size: int = 4096) -> str:
        if not self.proc:
            return ""
        return self.proc.read(size)

    def resize(self, cols: int, rows: int) -> None:
        if not self.proc:
            self.dimensions = PTYDimensions(cols=cols, rows=rows)
            return
        self.dimensions = PTYDimensions(cols=cols, rows=rows)
        self.proc.setwinsize(rows, cols)

    def stop(self, force: bool = False) -> None:
        if not self.proc:
            return

        try:
            if self.proc.isalive():
                try:
                    self.proc.write("\x03")
                except Exception:
                    pass
                time.sleep(0.15)

            if self.proc.isalive():
                try:
                    self.proc.terminate(force=force)
                except Exception:
                    pass

            if force and self.proc.isalive() and self.pid:
                subprocess.run(
                    ["taskkill", "/PID", str(self.pid), "/T", "/F"],
                    capture_output=True,
                    text=True,
                )
        finally:
            self.proc = None
            self.pid = None
