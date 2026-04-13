from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.database import Base


class Garantia(Base):
    __tablename__ = "garantias"

    id = Column(Integer, primary_key=True, autoincrement=True)
    certificado = Column(String(20), unique=True, nullable=False, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    produto_nome = Column(String(200), nullable=False)
    produto_serie = Column(String(100), nullable=True)
    produto_categoria = Column(String(50), nullable=False)
    produto_valor = Column(Numeric(10, 2), nullable=False)
    loja = Column(String(200), nullable=False)
    data_compra = Column(Date, nullable=False)
    tipo_garantia = Column(String(20), default="Universal")
    periodo_meses = Column(Integer, nullable=False)
    data_inicio = Column(Date, nullable=False)
    data_termino = Column(Date, nullable=False)
    status = Column(String(20), default="Ativa")
    operador_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    criado_em = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    cliente = relationship("Cliente", backref="garantias")
    operador = relationship("Usuario")
