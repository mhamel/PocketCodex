from __future__ import annotations

from typing import List


def map_special_key(key: str, modifiers: List[str]) -> str:
    mods = {m.lower() for m in modifiers}

    base = {
        "arrowup": "\x1b[A",
        "arrowdown": "\x1b[B",
        "arrowright": "\x1b[C",
        "arrowleft": "\x1b[D",
        "enter": "\r",
        "escape": "\x1b",
        "tab": "\t",
        "backspace": "\x7f",
        "delete": "\x1b[3~",
        "home": "\x1b[H",
        "end": "\x1b[F",
        "pageup": "\x1b[5~",
        "pagedown": "\x1b[6~",
        "f1": "\x1bOP",
        "f2": "\x1bOQ",
        "f3": "\x1bOR",
        "f4": "\x1bOS",
        "f5": "\x1b[15~",
        "f6": "\x1b[17~",
        "f7": "\x1b[18~",
        "f8": "\x1b[19~",
        "f9": "\x1b[20~",
        "f10": "\x1b[21~",
        "f11": "\x1b[23~",
        "f12": "\x1b[24~",
    }

    k = key.lower()

    if "ctrl" in mods and k in {"arrowup", "arrowdown", "arrowright", "arrowleft"}:
        return {
            "arrowup": "\x1b[1;5A",
            "arrowdown": "\x1b[1;5B",
            "arrowright": "\x1b[1;5C",
            "arrowleft": "\x1b[1;5D",
        }[k]

    if "shift" in mods and k == "tab":
        return "\x1b[Z"

    return base.get(k, "")
