from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(200), nullable=False)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    categoria = Column(String(50), nullable=False)
    descricao = Column(Text, nullable=True)
    qtd_estoque = Column(Integer, nullable=False, default=0)
    limite_minimo = Column(Integer, nullable=False, default=5)

    # Custos
    valor_compra = Column(Float, nullable=False, default=0)
    tipo_banho = Column(String(50), nullable=True)
    valor_grama_banho = Column(Float, nullable=False, default=0)
    qtd_gramas = Column(Float, nullable=False, default=0)
    custo_embalagem = Column(Float, nullable=False, default=0)
    outros_custos = Column(Float, nullable=False, default=0)
    custo_total = Column(Float, nullable=False, default=0)
    imagem_url = Column(String(500), nullable=True)

    criado_em = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    atualizado_em = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    canais = relationship("ProdutoCanal", back_populates="produto", cascade="all, delete-orphan")


class ProdutoCanal(Base):
    __tablename__ = "produto_canais"

    id = Column(Integer, primary_key=True, autoincrement=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False, index=True)
    canal = Column(String(30), nullable=False)
    ativo = Column(Boolean, default=False)

    # Taxas e config do canal
    comissao = Column(Float, default=0)
    taxa_fixa = Column(Float, default=0)
    taxa_item = Column(Float, default=0)
    imposto = Column(Float, default=6)
    margem = Column(Float, default=80)
    custo_frete = Column(Float, default=0)
    frete_absorvido = Column(Boolean, default=False)
    tipo_anuncio = Column(String(30), nullable=True)
    usar_fba = Column(Boolean, default=False)
    taxa_fba = Column(Float, default=0)
    comissao_afiliado = Column(Float, default=0)
    frete_gratis = Column(Boolean, default=False)

    # Resultados calculados
    preco_sugerido = Column(Float, default=0)
    preco_final = Column(Float, default=0)
    margem_real = Column(Float, default=0)
    lucro = Column(Float, default=0)
    taxas_canal = Column(Float, default=0)

    produto = relationship("Produto", back_populates="canais")
