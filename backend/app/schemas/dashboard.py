from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class VariacaoMetricas(BaseModel):
    garantias_mes: float
    mensagens_hoje: float
    cupons_mes: float
    clientes_recompra: float


class MetricasResponse(BaseModel):
    total_garantias: int
    garantias_ativas: int
    garantias_mes: int
    mensagens_hoje: int
    cupons_mes: int
    clientes_recompra: int
    variacao: VariacaoMetricas


class GarantiaRecente(BaseModel):
    id: int
    certificado: str
    cliente_nome: str
    produto_nome: str
    status: str
    criado_em: datetime


class MensagemRecente(BaseModel):
    id: int
    cliente_nome: str
    tipo: str
    status: str
    criado_em: datetime


class RecentesResponse(BaseModel):
    garantias: list[GarantiaRecente]
    mensagens: list[MensagemRecente]


class VencimentoItem(BaseModel):
    id: int
    certificado: str
    cliente_nome: str
    produto_nome: str
    data_termino: date
    dias_restantes: int


class VencimentosResponse(BaseModel):
    items: list[VencimentoItem]
    total: int
