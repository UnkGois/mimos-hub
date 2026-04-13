from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Venda(Base):
    __tablename__ = "vendas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    operador_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    cupom_id = Column(Integer, ForeignKey("cupons.id"), nullable=True)

    subtotal = Column(Numeric(10, 2), nullable=False)
    desconto_cupom = Column(Numeric(10, 2), nullable=False, default=0)
    desconto_manual = Column(Numeric(10, 2), nullable=False, default=0)
    desconto_manual_motivo = Column(String(200), nullable=True)
    total = Column(Numeric(10, 2), nullable=False)

    forma_pagamento = Column(String(20), nullable=False)
    valor_recebido = Column(Numeric(10, 2), nullable=True)
    troco = Column(Numeric(10, 2), nullable=False, default=0)

    status = Column(String(20), nullable=False, default="Concluida")
    observacao = Column(Text, nullable=True)

    criado_em = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    cliente = relationship("Cliente", backref="vendas")
    operador = relationship("Usuario")
    cupom = relationship("Cupom")
    itens = relationship("VendaItem", back_populates="venda", cascade="all, delete-orphan")


class VendaItem(Base):
    __tablename__ = "venda_itens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    venda_id = Column(Integer, ForeignKey("vendas.id"), nullable=False, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=True)

    produto_nome = Column(String(200), nullable=False)
    produto_sku = Column(String(50), nullable=True)
    produto_categoria = Column(String(50), nullable=True)
    preco_unitario = Column(Numeric(10, 2), nullable=False)
    quantidade = Column(Integer, nullable=False, default=1)
    subtotal = Column(Numeric(10, 2), nullable=False)

    garantia_id = Column(Integer, ForeignKey("garantias.id"), nullable=True)

    venda = relationship("Venda", back_populates="itens")
    produto = relationship("Produto")
    garantia = relationship("Garantia")
