from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ClienteBase(BaseModel):
    cpf: str
    nome: str
    telefone: str


class ClienteCreate(ClienteBase):
    data_nascimento: Optional[date] = None
    email: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None


class ClienteUpdate(BaseModel):
    cpf: Optional[str] = None
    nome: Optional[str] = None
    telefone: Optional[str] = None
    data_nascimento: Optional[date] = None
    email: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None


class ClienteResponse(BaseModel):
    id: int
    cpf: str
    nome: str
    telefone: str
    data_nascimento: Optional[date] = None
    email: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    total_compras: int
    whatsapp_verificado: bool = False
    criado_em: datetime

    class Config:
        from_attributes = True


class ClienteListResponse(BaseModel):
    items: list[ClienteResponse]
    total: int
