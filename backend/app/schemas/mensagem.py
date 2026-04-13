from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.cliente import ClienteResponse


class MensagemCreate(BaseModel):
    cliente_id: int
    garantia_id: Optional[int] = None
    tipo: str
    conteudo: str


class MensagemEnviar(BaseModel):
    garantia_id: int
    tipo: str


class ClienteResumo(BaseModel):
    id: int
    nome: str
    telefone: str
    email: Optional[str] = None

    class Config:
        from_attributes = True


class MensagemResponse(BaseModel):
    id: int
    cliente_id: int
    garantia_id: Optional[int] = None
    tipo: str
    conteudo: str
    status: str
    motivo_falha: Optional[str] = None
    enviado_em: Optional[datetime] = None
    criado_em: datetime
    cliente: Optional[ClienteResumo] = None

    class Config:
        from_attributes = True


class MensagemUpdate(BaseModel):
    conteudo: str
    reenviar: bool = False


class MensagemListResponse(BaseModel):
    items: list[MensagemResponse]
    total: int
