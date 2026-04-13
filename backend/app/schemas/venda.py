from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class VendaItemCreate(BaseModel):
    produto_id: Optional[int] = None
    produto_nome: str
    produto_sku: Optional[str] = None
    produto_categoria: Optional[str] = None
    preco_unitario: Decimal
    quantidade: int = 1


class VendaCreate(BaseModel):
    cliente_id: Optional[int] = None
    cupom_codigo: Optional[str] = None
    desconto_manual: Decimal = Decimal("0")
    desconto_manual_motivo: Optional[str] = None
    forma_pagamento: str
    valor_recebido: Optional[Decimal] = None
    observacao: Optional[str] = None
    itens: list[VendaItemCreate]


class VendaItemResponse(BaseModel):
    id: int
    produto_id: Optional[int] = None
    produto_nome: str
    produto_sku: Optional[str] = None
    produto_categoria: Optional[str] = None
    preco_unitario: Decimal
    quantidade: int
    subtotal: Decimal
    garantia_id: Optional[int] = None

    class Config:
        from_attributes = True


class VendaResponse(BaseModel):
    id: int
    codigo: str
    cliente_id: Optional[int] = None
    cliente_nome: Optional[str] = None
    operador_id: int
    operador_nome: Optional[str] = None
    cupom_id: Optional[int] = None
    cupom_codigo: Optional[str] = None
    subtotal: Decimal
    desconto_cupom: Decimal
    desconto_manual: Decimal
    desconto_manual_motivo: Optional[str] = None
    total: Decimal
    forma_pagamento: str
    valor_recebido: Optional[Decimal] = None
    troco: Decimal
    status: str
    observacao: Optional[str] = None
    criado_em: datetime
    itens: list[VendaItemResponse] = []

    class Config:
        from_attributes = True


class VendaListResponse(BaseModel):
    items: list[VendaResponse]
    total: int


class VendaEstatisticas(BaseModel):
    total_vendas: int
    vendas_hoje: int
    faturamento_hoje: Decimal
    faturamento_mes: Decimal
    ticket_medio: Decimal
    forma_pagamento_mais_usada: Optional[str] = None


class VendaItemGarantiaLink(BaseModel):
    garantia_id: int
