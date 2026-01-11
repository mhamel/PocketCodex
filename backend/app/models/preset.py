from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class PresetVariable(BaseModel):
    name: str
    description: str
    default: Optional[str] = None


class PresetCategory(str, Enum):
    GENERAL = "general"
    DEBUG = "debug"
    TESTING = "testing"
    REFACTOR = "refactor"
    DOCS = "docs"
    REVIEW = "review"
    CUSTOM = "custom"


class PresetScope(str, Enum):
    GLOBAL = "global"
    PROJECT = "project"


class Preset(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    command: str
    variables: List[PresetVariable] = Field(default_factory=list)
    category: PresetCategory = PresetCategory.GENERAL
    shortcut: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PresetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    command: str
    category: PresetCategory = PresetCategory.GENERAL
    shortcut: Optional[str] = None
    scope: PresetScope
    project_path: Optional[str] = None


class PresetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    command: Optional[str] = None
    category: Optional[PresetCategory] = None
    shortcut: Optional[str] = None
