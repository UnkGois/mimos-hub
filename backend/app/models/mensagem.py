from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Mensagem(Base):
    __tablename__ = "mensagens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    garantia_id = Column(Integer, ForeignKey("garantias.id"), nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    tipo = Column(String(20), nullable=False)
    conteudo = Column(Text, nullable=False)
    status = Column(String(20), default="Pendente")
    motivo_falha = Column(String(200), nullable=True)
    enviado_em = Column(DateTime(timezone=True), nullable=True)
    criado_em = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    garantia = relationship("Garantia", backref="mensagens")
    cliente = relationship("Cliente", backref="mensagens")
