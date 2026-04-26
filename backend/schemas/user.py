"""Schemas Pydantic pour les utilisateurs (CRUD)."""
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional
from enum import Enum


class UserRoleSchema(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    COLLABORATOR = "collaborator"


# === Création ===
class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    role: UserRoleSchema = UserRoleSchema.COLLABORATOR
    password: Optional[str] = Field(None, min_length=8)
    # Si password absent, un mot de passe temporaire sera generé


# === Mise à jour ===
class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    role: Optional[UserRoleSchema] = None
    is_active: Optional[str] = Field(None, pattern="^[YN]$")


# === Reset password ===
class UserResetPassword(BaseModel):
    new_password: str = Field(min_length=8)


# === Self-update (pour /me) — l'user peut juste changer son nom et son mot de passe ===
class UserSelfUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(None, min_length=8)


# === Response ===
class UserResponseFull(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: str
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserStatsResponse(BaseModel):
    total: int
    active: int
    inactive: int
    by_role: dict
