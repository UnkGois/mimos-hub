from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UsuarioBase(BaseModel):
    nome: str
    email: str


class UsuarioCreate(UsuarioBase):
    senha: str


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    cargo: Optional[str] = None


class UsuarioResponse(UsuarioBase):
    id: int
    cargo: str | None
    ativo: bool
    criado_em: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    senha: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioResponse
