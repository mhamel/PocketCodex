from __future__ import annotations

import threading
from collections import deque
from queue import Queue
from typing import Deque, Optional

from ..config import HISTORY_MAX_BYTES, HISTORY_MAX_CHUNKS
from .sanitize import strip_terminal_identity_responses
from .session import PTYSession


class PTYOutputReader(threading.Thread):
    def __init__(
        self,
        session: PTYSession,
        output_queue: Queue[str],
        history: Deque[str],
        history_bytes_ref: list[int],
    ) -> None:
        super().__init__(daemon=True)
        self._stop_event = threading.Event()
        self._session = session
        self._output_queue = output_queue
        self._history = history
        self._history_bytes_ref = history_bytes_ref

    def stop(self) -> None:
        self._stop_event.set()

    def _push_history(self, chunk: str) -> None:
        b = len(chunk.encode("utf-8", errors="ignore"))
        self._history.append(chunk)
        self._history_bytes_ref[0] += b

        while self._history and (
            self._history_bytes_ref[0] > HISTORY_MAX_BYTES
            or len(self._history) > HISTORY_MAX_CHUNKS
        ):
            left = self._history.popleft()
            self._history_bytes_ref[0] -= len(left.encode("utf-8", errors="ignore"))

    def _queue_put_drop_oldest(self, chunk: str) -> None:
        try:
            self._output_queue.put_nowait(chunk)
        except Exception:
            try:
                _ = self._output_queue.get_nowait()
            except Exception:
                return
            try:
                self._output_queue.put_nowait(chunk)
            except Exception:
                return

    def run(self) -> None:
        while not self._stop_event.is_set():
            if not self._session.is_alive():
                break

            try:
                chunk = self._session.read(4096)
            except EOFError:
                break
            except Exception:
                break

            if not chunk:
                continue

            chunk = strip_terminal_identity_responses(chunk)
            if not chunk:
                continue

            self._push_history(chunk)
            self._queue_put_drop_oldest(chunk)
