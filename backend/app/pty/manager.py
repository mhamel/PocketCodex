from __future__ import annotations

import threading
import time
import uuid
from collections import deque
from queue import Queue
from typing import Any, Deque, Dict, List, Optional

from ..config import OUTPUT_QUEUE_MAXSIZE
from .reader import PTYOutputReader
from .session import PTYSession


class PTYManager:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._session: Optional[PTYSession] = None
        self._session_id: Optional[str] = None
        self._started_at: Optional[float] = None

        self._output_queue: Queue[str] = Queue(maxsize=OUTPUT_QUEUE_MAXSIZE)
        self._history: Deque[str] = deque()
        self._history_bytes: List[int] = [0]

        self._reader: Optional[PTYOutputReader] = None

    @property
    def output_queue(self) -> Queue[str]:
        return self._output_queue

    def history_snapshot(self) -> List[str]:
        with self._lock:
            return list(self._history)

    def is_running(self) -> bool:
        with self._lock:
            return bool(self._session and self._session.is_alive())

    def start(
        self,
        command: str,
        args: Optional[List[str]] = None,
        cwd: Optional[str] = None,
        cols: int = 80,
        rows: int = 24,
    ) -> Dict[str, Any]:
        with self._lock:
            if self.is_running():
                raise RuntimeError("Session already running")

            self._history.clear()
            self._history_bytes[0] = 0
            while not self._output_queue.empty():
                try:
                    self._output_queue.get_nowait()
                except Exception:
                    break

            self._session = PTYSession(command=command, args=args, cwd=cwd, cols=cols, rows=rows)
            try:
                self._session.start()
            except Exception:
                self._session = None
                self._session_id = None
                self._started_at = None
                self._reader = None
                raise

            self._session_id = str(uuid.uuid4())
            self._started_at = time.time()

            self._reader = PTYOutputReader(
                session=self._session,
                output_queue=self._output_queue,
                history=self._history,
                history_bytes_ref=self._history_bytes,
            )
            self._reader.start()

            return {
                "session_id": self._session_id,
                "pid": self._session.pid,
                "cols": cols,
                "rows": rows,
            }

    def stop(self, force: bool = False) -> None:
        with self._lock:
            if not self._session:
                return

            if self._reader:
                try:
                    self._reader.stop()
                except Exception:
                    pass

            try:
                self._session.stop(force=force)
            finally:
                self._session = None
                self._session_id = None
                self._started_at = None

    def write(self, data: str) -> None:
        with self._lock:
            if not self._session or not self._session.is_alive():
                return
            self._session.write(data)

    def resize(self, cols: int, rows: int) -> None:
        with self._lock:
            if not self._session:
                return
            self._session.resize(cols, rows)

    def status(self) -> Dict[str, Any]:
        with self._lock:
            running = bool(self._session and self._session.is_alive())
            pid = self._session.pid if running and self._session else None
            dims = (
                {"cols": self._session.dimensions.cols, "rows": self._session.dimensions.rows}
                if self._session
                else {"cols": None, "rows": None}
            )
            uptime = int(time.time() - self._started_at) if running and self._started_at else 0

            return {
                "status": "running" if running else "stopped",
                "pid": pid,
                "uptime_seconds": uptime,
                "dimensions": dims,
                "session_id": self._session_id,
            }

    def shutdown(self) -> None:
        self.stop(force=True)


pty_manager = PTYManager()
