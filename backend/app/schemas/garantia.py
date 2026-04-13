from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.schemas.cliente import ClienteResponse


class GarantiaCreate(BaseModel):
    # Dados do cliente
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
    # Dados do produto
    produto_nome: str
    produto_serie: Optional[str] = None
    produto_categoria: str
    produto_valor: Decimal
    loja: str
    data_compra: date
    # Dados da garantia
    periodo_meses: int
    data_inicio: Optional[date] = None


class ProdutoInfo(BaseModel):
    nome: str
    serie: Optional[str] = None
    categoria: str
    valor: Decimal
    loja: str
    data_compra: date


class GarantiaInfo(BaseModel):
    tipo: str
    periodo: int
    inicio: date
    termino: date


class CupomInfo(BaseModel):
    codigo: str
    percentual: Decimal


class GarantiaResponse(BaseModel):
    id: int
    certificado: str
    status: str
    criado_em: datetime
    cliente: ClienteResponse
    produto: ProdutoInfo
    garantia: GarantiaInfo
    cupom: Optional[CupomInfo] = None


class GarantiaListResponse(BaseModel):
    items: list[GarantiaResponse]
    total: int


class GarantiaStatusUpdate(BaseModel):
    status: str


class EstatisticasResponse(BaseModel):
    total_garantias: int
    garantias_ativas: int
    garantias_expiradas: int
    garantias_canceladas: int
    total_clientes: int
    garantias_mes_atual: int
    mensagens_hoje: int
    cupons_gerados: int
