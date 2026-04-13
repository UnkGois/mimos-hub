from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Reserva(Base):
    __tablename__ = "reservas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True, index=True)

    produto_nome = Column(String(200), nullable=False)
    produto_preco = Column(Numeric(10, 2), nullable=False)
    quantidade = Column(Integer, nullable=False, default=1)

    # Identificação do cliente (pode ser qualquer um)
    cliente_nome = Column(String(200), nullable=True)
    cliente_telefone = Column(String(20), nullable=True)
    cliente_cpf = Column(String(14), nullable=True)
    cliente_instagram = Column(String(100), nullable=True)

    # Tipo: retirada ou entrega
    tipo_entrega = Column(String(20), nullable=False, default="retirada")  # retirada, entrega
    forma_pagamento = Column(String(20), nullable=True)  # pix, cartao_credito, cartao_debito, dinheiro

    # Dados de entrega (preenchido pelo cliente no checkout)
    entrega_cep = Column(String(10), nullable=True)
    entrega_endereco = Column(String(300), nullable=True)
    entrega_numero = Column(String(20), nullable=True)
    entrega_complemento = Column(String(100), nullable=True)
    entrega_bairro = Column(String(100), nullable=True)
    entrega_cidade = Column(String(100), nullable=True)
    entrega_uf = Column(String(2), nullable=True)
    entrega_observacao = Column(Text, nullable=True)

    # Token público para checkout
    checkout_token = Column(String(36), unique=True, nullable=True, index=True)

    status = Column(String(20), nullable=False, default="Reservado")  # Reservado, AguardandoPagamento, Pago, Enviado, Cancelado, Expirado
    whatsapp_enviado = Column(String(20), default="nao")  # nao, enviado, falha
    observacao = Column(Text, nullable=True)

    criado_em = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    produto = relationship("Produto")
    cliente = relationship("Cliente")
