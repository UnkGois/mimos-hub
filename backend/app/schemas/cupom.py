from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class CupomCreate(BaseModel):
    cliente_id: int
    garantia_id: Optional[int] = None


class CupomManualCreate(BaseModel):
    cliente_id: int
    tipo_desconto: str = "percentual"
    valor: Decimal
    motivo: str
    validade_dias: int = 90


class CupomStatusUpdate(BaseModel):
    status: str


class CupomResponse(BaseModel):
    id: int
    codigo: str
    tipo_desconto: str = "percentual"
    percentual: Decimal
    valor_desconto: Optional[Decimal] = None
    motivo: Optional[str] = None
    usado: bool
    usado_em: Optional[datetime] = None
    desativado: bool = False
    validade: date
    cliente_id: int
    garantia_id: Optional[int] = None
    criado_em: datetime
    cliente_nome: Optional[str] = None
    status: Optional[str] = None

    class Config:
        from_attributes = True


class CupomValidacaoResponse(BaseModel):
    valido: bool
    motivo: str
    cupom: CupomResponse


class CupomListResponse(BaseModel):
    items: list[CupomResponse]
    total: int
