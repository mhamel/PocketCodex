from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..utils.slash_commands import load_slash_commands

router = APIRouter(prefix="/api/slash-commands", tags=["slash-commands"])


class SlashCommand(BaseModel):
    trigger: str = Field(..., min_length=1)
    description: Optional[str] = None
    send: Optional[str] = None


class SlashCommandsResponse(BaseModel):
    commands: List[SlashCommand]


@router.get("", response_model=SlashCommandsResponse)
async def list_slash_commands() -> SlashCommandsResponse:
    items = []
    for raw in load_slash_commands():
        try:
            items.append(SlashCommand.model_validate(raw))
        except Exception:
            continue
    return SlashCommandsResponse(commands=items)

