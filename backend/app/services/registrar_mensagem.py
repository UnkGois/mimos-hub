"""Helper para registrar mensagens enviadas na tabela de mensagens."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mensagem import Mensagem


async def registrar(
    db: AsyncSession,
    tipo: str,
    conteudo: str,
    resultado_envio: dict,
    cliente_id: int | None = None,
    garantia_id: int | None = None,
):
    status_envio = resultado_envio.get("status", "falha")
    mensagem = Mensagem(
        tipo=tipo,
        conteudo=conteudo[:500],  # Limitar tamanho
        cliente_id=cliente_id,
        garantia_id=garantia_id,
        status="Enviado" if status_envio in ("enviado", "simulado") else "Falha",
        motivo_falha=resultado_envio.get("erro") if status_envio == "falha" else None,
        enviado_em=datetime.now(timezone.utc) if status_envio in ("enviado", "simulado") else None,
    )
    db.add(mensagem)
