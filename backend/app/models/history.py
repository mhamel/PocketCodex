from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ChatHistoryItem(BaseModel):
    id: str
    title: str
    project_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    transcript: str


class ChatHistoryListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    global_: List[ChatHistoryItem] = Field(alias="global")
    project: List[ChatHistoryItem]


class HistoryScope(str, Enum):
    GLOBAL = "global"
    PROJECT = "project"
    ALL = "all"


class ChatHistoryCreateSnapshot(BaseModel):
    scope: HistoryScope
    title: Optional[str] = None
    project_path: Optional[str] = None


class ChatHistoryRenameRequest(BaseModel):
    title: str
