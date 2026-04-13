from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class TermoRetiradaCreate(BaseModel):
    garantia_id: int
    tipo_fluxo: str = "presencial"
    local_retirada: str = "MDA - Mimos de Alice Joias - Loja Física"
    # Dados do terceiro (quando tipo_fluxo == "terceiro")
    terceiro_nome: Optional[str] = None
    terceiro_cpf: Optional[str] = None
    terceiro_rg: Optional[str] = None
    terceiro_telefone: Optional[str] = None
    terceiro_relacao: Optional[str] = None


class TermoPresencialCreate(BaseModel):
    garantia_id: int
    assinatura_cliente: str
    assinatura_operador: str
    local_retirada: str = "MDA - Mimos de Alice Joias - Loja Física"
    # Dados do terceiro (quando tipo_fluxo == "terceiro")
    tipo_fluxo: str = "presencial"
    terceiro_nome: Optional[str] = None
    terceiro_cpf: Optional[str] = None
    terceiro_rg: Optional[str] = None
    terceiro_telefone: Optional[str] = None
    terceiro_relacao: Optional[str] = None


class AssinaturaSubmit(BaseModel):
    assinatura: str  # base64 PNG


class TermoRetiradaResponse(BaseModel):
    id: int
    token: str
    garantia_id: int
    cliente_id: int
    operador_id: int
    local_retirada: str
    data_retirada: Optional[datetime] = None
    status: str
    tipo_fluxo: str
    assinatura_cliente: Optional[str] = None
    assinatura_operador: Optional[str] = None
    pdf_enviado: bool
    token_expira_em: Optional[datetime] = None
    criado_em: datetime

    # Dados extra para listagem
    cliente_nome: Optional[str] = None
    certificado: Optional[str] = None
    produto_nome: Optional[str] = None

    # Terceiro
    terceiro_nome: Optional[str] = None
    terceiro_cpf: Optional[str] = None
    terceiro_rg: Optional[str] = None
    terceiro_telefone: Optional[str] = None
    terceiro_relacao: Optional[str] = None

    class Config:
        from_attributes = True


class TermoPublicoResponse(BaseModel):
    """Resposta pública para a página de assinatura (sem login)."""

    token: str
    status: str
    tipo_fluxo: str
    local_retirada: str
    data_retirada: Optional[datetime] = None
    # Cliente (dados mínimos)
    cliente_nome: str
    cliente_cpf_masked: str
    cliente_endereco_completo: str
    # Produto
    produto_nome: str
    produto_categoria: str
    produto_valor: str
    # Garantia
    certificado: str
    data_compra: Optional[date] = None
    # Flags
    assinatura_cliente_presente: bool
    assinatura_operador_presente: bool
    expirado: bool
    # Texto do termo
    texto_termo: str
    # Terceiro
    terceiro_nome: Optional[str] = None
    terceiro_cpf: Optional[str] = None
    terceiro_rg: Optional[str] = None
    terceiro_telefone: Optional[str] = None
    terceiro_relacao: Optional[str] = None
    is_terceiro: bool = False


class TermoListResponse(BaseModel):
    items: list[TermoRetiradaResponse]
    total: int


class TermoMetricsResponse(BaseModel):
    total: int
    concluidos: int
    aguardando: int
