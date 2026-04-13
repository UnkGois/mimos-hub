from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class DespesaFixaCreate(BaseModel):
    nome: str
    valor: float = 0


class DespesaFixaUpdate(BaseModel):
    nome: Optional[str] = None
    valor: Optional[float] = None


class DespesaFixaResponse(BaseModel):
    id: int
    nome: str
    valor: float

    class Config:
        from_attributes = True


class DespesaVariavelCreate(BaseModel):
    nome: str
    tipo: str = "fixo"  # fixo ou percentual
    valor: float = 0


class DespesaVariavelUpdate(BaseModel):
    nome: Optional[str] = None
    tipo: Optional[str] = None
    valor: Optional[float] = None


class DespesaVariavelResponse(BaseModel):
    id: int
    nome: str
    tipo: str
    valor: float

    class Config:
        from_attributes = True


class BreakEvenRequest(BaseModel):
    ticket_medio: float = 65
    margem_contribuicao: float = 50
    dias_funcionamento: int = 26


class BreakEvenResponse(BaseModel):
    total_fixas: float
    total_variavel_por_unidade: float
    vendas_mes: int
    vendas_dia: int
    faturamento_minimo: float
