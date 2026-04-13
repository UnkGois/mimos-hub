from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.cliente import Cliente
from app.models.cupom import Cupom
from app.models.garantia import Garantia
from app.models.mensagem import Mensagem


def _inicio_mes(d: date) -> datetime:
    return datetime(d.year, d.month, 1, tzinfo=timezone.utc)


def _inicio_mes_anterior(d: date) -> datetime:
    primeiro = d.replace(day=1)
    ultimo_mes_anterior = primeiro - timedelta(days=1)
    return datetime(
        ultimo_mes_anterior.year, ultimo_mes_anterior.month, 1,
        tzinfo=timezone.utc,
    )


def _variacao(atual: int, anterior: int) -> float:
    if anterior == 0:
        return 100.0 if atual > 0 else 0.0
    return round(((atual - anterior) / anterior) * 100, 1)


async def obter_metricas(db: AsyncSession) -> dict:
    hoje = date.today()
    inicio_mes = _inicio_mes(hoje)
    inicio_mes_ant = _inicio_mes_anterior(hoje)
    inicio_hoje = datetime(hoje.year, hoje.month, hoje.day, tzinfo=timezone.utc)

    # ── Totais gerais ──
    total_garantias = (
        await db.execute(select(func.count(Garantia.id)))
    ).scalar() or 0

    garantias_ativas = (
        await db.execute(
            select(func.count(Garantia.id)).where(Garantia.status == "Ativa")
        )
    ).scalar() or 0

    # ── Garantias mês atual ──
    garantias_mes = (
        await db.execute(
            select(func.count(Garantia.id)).where(
                Garantia.criado_em >= inicio_mes
            )
        )
    ).scalar() or 0

    # ── Garantias mês anterior ──
    garantias_mes_ant = (
        await db.execute(
            select(func.count(Garantia.id)).where(
                and_(
                    Garantia.criado_em >= inicio_mes_ant,
                    Garantia.criado_em < inicio_mes,
                )
            )
        )
    ).scalar() or 0

    # ── Mensagens hoje ──
    mensagens_hoje = (
        await db.execute(
            select(func.count(Mensagem.id)).where(
                Mensagem.criado_em >= inicio_hoje
            )
        )
    ).scalar() or 0

    # ── Mensagens ontem (para variação) ──
    inicio_ontem = inicio_hoje - timedelta(days=1)
    mensagens_ontem = (
        await db.execute(
            select(func.count(Mensagem.id)).where(
                and_(
                    Mensagem.criado_em >= inicio_ontem,
                    Mensagem.criado_em < inicio_hoje,
                )
            )
        )
    ).scalar() or 0

    # ── Cupons mês atual ──
    cupons_mes = (
        await db.execute(
            select(func.count(Cupom.id)).where(
                Cupom.criado_em >= inicio_mes
            )
        )
    ).scalar() or 0

    # ── Cupons mês anterior ──
    cupons_mes_ant = (
        await db.execute(
            select(func.count(Cupom.id)).where(
                and_(
                    Cupom.criado_em >= inicio_mes_ant,
                    Cupom.criado_em < inicio_mes,
                )
            )
        )
    ).scalar() or 0

    # ── Clientes recompra (total_compras >= 2) ──
    clientes_recompra = (
        await db.execute(
            select(func.count(Cliente.id)).where(Cliente.total_compras >= 2)
        )
    ).scalar() or 0

    # ── Clientes recompra mês anterior (aproximação: clientes que
    #    tinham >= 2 garantias criadas antes do início deste mês) ──
    subq = (
        select(Garantia.cliente_id)
        .where(Garantia.criado_em < inicio_mes)
        .group_by(Garantia.cliente_id)
        .having(func.count(Garantia.id) >= 2)
        .subquery()
    )
    clientes_recompra_ant = (
        await db.execute(select(func.count()).select_from(subq))
    ).scalar() or 0

    return {
        "total_garantias": total_garantias,
        "garantias_ativas": garantias_ativas,
        "garantias_mes": garantias_mes,
        "mensagens_hoje": mensagens_hoje,
        "cupons_mes": cupons_mes,
        "clientes_recompra": clientes_recompra,
        "variacao": {
            "garantias_mes": _variacao(garantias_mes, garantias_mes_ant),
            "mensagens_hoje": _variacao(mensagens_hoje, mensagens_ontem),
            "cupons_mes": _variacao(cupons_mes, cupons_mes_ant),
            "clientes_recompra": _variacao(clientes_recompra, clientes_recompra_ant),
        },
    }


async def obter_recentes(db: AsyncSession) -> dict:
    # Últimas 10 garantias
    result_g = await db.execute(
        select(Garantia)
        .options(joinedload(Garantia.cliente))
        .order_by(Garantia.criado_em.desc())
        .limit(10)
    )
    garantias = result_g.unique().scalars().all()

    # Últimas 10 mensagens
    result_m = await db.execute(
        select(Mensagem)
        .options(joinedload(Mensagem.cliente))
        .order_by(Mensagem.criado_em.desc())
        .limit(10)
    )
    mensagens = result_m.unique().scalars().all()

    return {
        "garantias": [
            {
                "id": g.id,
                "certificado": g.certificado,
                "cliente_nome": g.cliente.nome if g.cliente else "",
                "produto_nome": g.produto_nome,
                "status": g.status,
                "criado_em": g.criado_em,
            }
            for g in garantias
        ],
        "mensagens": [
            {
                "id": m.id,
                "cliente_nome": m.cliente.nome if m.cliente else "",
                "tipo": m.tipo,
                "status": m.status,
                "criado_em": m.criado_em,
            }
            for m in mensagens
        ],
    }


async def obter_vencimentos(db: AsyncSession, dias: int = 30) -> list[dict]:
    hoje = date.today()
    limite = hoje + timedelta(days=dias)

    result = await db.execute(
        select(Garantia)
        .options(joinedload(Garantia.cliente))
        .where(
            and_(
                Garantia.status == "Ativa",
                Garantia.data_termino >= hoje,
                Garantia.data_termino <= limite,
            )
        )
        .order_by(Garantia.data_termino.asc())
    )
    garantias = result.unique().scalars().all()

    return [
        {
            "id": g.id,
            "certificado": g.certificado,
            "cliente_nome": g.cliente.nome if g.cliente else "",
            "produto_nome": g.produto_nome,
            "data_termino": g.data_termino,
            "dias_restantes": (g.data_termino - hoje).days,
        }
        for g in garantias
    ]
