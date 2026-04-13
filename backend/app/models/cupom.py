from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.database import Base


class Cupom(Base):
    __tablename__ = "cupons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    garantia_id = Column(Integer, ForeignKey("garantias.id"), nullable=True)
    tipo_desconto = Column(String(20), default="percentual")
    percentual = Column(Numeric(5, 2), nullable=False, default=0)
    valor_desconto = Column(Numeric(10, 2), nullable=True)
    motivo = Column(String(200), nullable=True)
    usado = Column(Boolean, default=False)
    usado_em = Column(DateTime(timezone=True), nullable=True)
    desativado = Column(Boolean, default=False)
    validade = Column(Date, nullable=False)
    criado_em = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    cliente = relationship("Cliente", backref="cupons")
    garantia = relationship("Garantia", backref="cupons")
