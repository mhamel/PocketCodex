from __future__ import annotations

import re

_DA_RESPONSE_RE = re.compile("(?:\x1b\\[|\\[)(?:\\?|>)[0-9;]*c")


def strip_terminal_identity_responses(text: str) -> str:
    return _DA_RESPONSE_RE.sub("", text)

