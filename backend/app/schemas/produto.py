from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProdutoCanalCreate(BaseModel):
    canal: str
    ativo: bool = False
    comissao: float = 0
    taxa_fixa: float = 0
    taxa_item: float = 0
    imposto: float = 6
    margem: float = 80
    custo_frete: float = 0
    frete_absorvido: bool = False
    tipo_anuncio: Optional[str] = None
    usar_fba: bool = False
    taxa_fba: float = 0
    comissao_afiliado: float = 0
    frete_gratis: bool = False
    preco_sugerido: float = 0
    preco_final: float = 0
    margem_real: float = 0
    lucro: float = 0
    taxas_canal: float = 0


class ProdutoCanalResponse(ProdutoCanalCreate):
    id: int

    class Config:
        from_attributes = True


class ProdutoCreate(BaseModel):
    nome: str
    sku: str
    categoria: str
    descricao: Optional[str] = None
    qtd_estoque: int = 0
    limite_minimo: int = 5
    valor_compra: float = 0
    tipo_banho: Optional[str] = None
    valor_grama_banho: float = 0
    qtd_gramas: float = 0
    custo_embalagem: float = 0
    outros_custos: float = 0
    custo_total: float = 0
    imagem_url: Optional[str] = None
    canais: list[ProdutoCanalCreate] = []


class ProdutoUpdate(BaseModel):
    nome: Optional[str] = None
    sku: Optional[str] = None
    categoria: Optional[str] = None
    descricao: Optional[str] = None
    qtd_estoque: Optional[int] = None
    limite_minimo: Optional[int] = None
    valor_compra: Optional[float] = None
    tipo_banho: Optional[str] = None
    valor_grama_banho: Optional[float] = None
    qtd_gramas: Optional[float] = None
    custo_embalagem: Optional[float] = None
    outros_custos: Optional[float] = None
    custo_total: Optional[float] = None
    imagem_url: Optional[str] = None
    canais: Optional[list[ProdutoCanalCreate]] = None


class ProdutoResponse(BaseModel):
    id: int
    nome: str
    sku: str
    categoria: str
    descricao: Optional[str] = None
    qtd_estoque: int
    limite_minimo: int
    valor_compra: float
    tipo_banho: Optional[str] = None
    valor_grama_banho: float
    qtd_gramas: float
    custo_embalagem: float
    outros_custos: float
    custo_total: float
    imagem_url: Optional[str] = None
    criado_em: datetime
    atualizado_em: Optional[datetime] = None
    canais: list[ProdutoCanalResponse] = []

    class Config:
        from_attributes = True


class ProdutoListResponse(BaseModel):
    items: list[ProdutoResponse]
    total: int


class EstoqueEstatisticas(BaseModel):
    total: int
    baixo_estoque: int
    ticket_medio: float
    margem_media: float


class MargemCanal(BaseModel):
    canal: str
    margem: float
    qtd_produtos: int
