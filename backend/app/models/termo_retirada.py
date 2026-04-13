from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class TermoRetirada(Base):
    __tablename__ = "termos_retirada"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(
        String(36),
        unique=True,
        nullable=False,
        index=True,
        default=lambda: str(uuid.uuid4()),
    )
    garantia_id = Column(Integer, ForeignKey("garantias.id"), nullable=False)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    operador_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    # Retirada
    local_retirada = Column(
        String(300), default="MDA - Mimos de Alice Joias - Loja Física"
    )
    data_retirada = Column(DateTime(timezone=True), nullable=True)

    # Assinaturas (base64 PNG)
    assinatura_cliente = Column(Text, nullable=True)
    assinatura_operador = Column(Text, nullable=True)

    # Status: Pendente | AguardandoOperador | Concluido | Expirado
    status = Column(String(30), default="Pendente")

    # Fluxo: presencial | whatsapp | terceiro
    tipo_fluxo = Column(String(20), default="presencial")

    # Dados do terceiro autorizado (quando tipo_fluxo == "terceiro")
    terceiro_nome = Column(String(200), nullable=True)
    terceiro_cpf = Column(String(14), nullable=True)
    terceiro_rg = Column(String(30), nullable=True)
    terceiro_telefone = Column(String(20), nullable=True)
    terceiro_relacao = Column(String(100), nullable=True)

    # Expiração do token (24h para fluxo WhatsApp)
    token_expira_em = Column(DateTime(timezone=True), nullable=True)

    # Controle de envio
    pdf_enviado = Column(Boolean, default=False)

    criado_em = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relacionamentos
    garantia = relationship("Garantia", backref="termos_retirada")
    cliente = relationship("Cliente")
    operador = relationship("Usuario")
