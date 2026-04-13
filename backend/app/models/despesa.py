from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.database import Base


class DespesaFixa(Base):
    __tablename__ = "despesas_fixas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(200), nullable=False)
    valor = Column(Float, nullable=False, default=0)
    criado_em = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DespesaVariavel(Base):
    __tablename__ = "despesas_variaveis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(200), nullable=False)
    tipo = Column(String(20), nullable=False, default="fixo")  # fixo ou percentual
    valor = Column(Float, nullable=False, default=0)
    criado_em = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
