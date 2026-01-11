from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class WSBaseMessage(BaseModel):
    type: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class InputPayload(BaseModel):
    data: str


class InputMessage(WSBaseMessage):
    type: Literal["input"]
    payload: InputPayload


class ResizePayload(BaseModel):
    cols: int
    rows: int


class ResizeMessage(WSBaseMessage):
    type: Literal["resize"]
    payload: ResizePayload


class SpecialKeyPayload(BaseModel):
    key: str
    modifiers: List[str] = Field(default_factory=list)


class SpecialKeyMessage(WSBaseMessage):
    type: Literal["special_key"]
    payload: SpecialKeyPayload


class PingMessage(WSBaseMessage):
    type: Literal["ping"]


class OutputPayload(BaseModel):
    data: str


class OutputMessage(WSBaseMessage):
    type: Literal["output"]
    payload: OutputPayload


class StatusPayload(BaseModel):
    status: Literal["running", "stopped", "error"]
    message: Optional[str] = None
    pid: Optional[int] = None


class StatusMessage(WSBaseMessage):
    type: Literal["status"]
    payload: StatusPayload


class ErrorPayload(BaseModel):
    code: str
    message: str


class ErrorMessage(WSBaseMessage):
    type: Literal["error"]
    payload: ErrorPayload


class PongMessage(WSBaseMessage):
    type: Literal["pong"]
