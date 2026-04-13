from __future__ import annotations

import math

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.despesa import DespesaFixa, DespesaVariavel


async def listar_fixas(db: AsyncSession) -> list[DespesaFixa]:
    result = await db.execute(select(DespesaFixa).order_by(DespesaFixa.id))
    return result.scalars().all()


async def criar_fixa(db: AsyncSession, nome: str, valor: float) -> DespesaFixa:
    despesa = DespesaFixa(nome=nome, valor=valor)
    db.add(despesa)
    await db.commit()
    await db.refresh(despesa)
    return despesa


async def atualizar_fixa(db: AsyncSession, despesa_id: int, nome: str | None, valor: float | None) -> DespesaFixa:
    result = await db.execute(select(DespesaFixa).where(DespesaFixa.id == despesa_id))
    despesa = result.scalar_one_or_none()
    if not despesa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despesa fixa não encontrada")
    if nome is not None:
        despesa.nome = nome
    if valor is not None:
        despesa.valor = valor
    await db.commit()
    await db.refresh(despesa)
    return despesa


async def excluir_fixa(db: AsyncSession, despesa_id: int) -> dict:
    result = await db.execute(select(DespesaFixa).where(DespesaFixa.id == despesa_id))
    despesa = result.scalar_one_or_none()
    if not despesa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despesa fixa não encontrada")
    await db.delete(despesa)
    await db.commit()
    return {"message": "Despesa fixa excluída"}


async def salvar_fixas_batch(db: AsyncSession, despesas: list[dict]) -> list[DespesaFixa]:
    """Substitui todas as despesas fixas de uma vez."""
    await db.execute(select(DespesaFixa))  # carrega contexto
    existentes = (await db.execute(select(DespesaFixa))).scalars().all()
    for d in existentes:
        await db.delete(d)
    await db.flush()

    novas = []
    for d in despesas:
        nova = DespesaFixa(nome=d["nome"], valor=d.get("valor", 0))
        db.add(nova)
        novas.append(nova)

    await db.commit()
    return (await db.execute(select(DespesaFixa).order_by(DespesaFixa.id))).scalars().all()


async def listar_variaveis(db: AsyncSession) -> list[DespesaVariavel]:
    result = await db.execute(select(DespesaVariavel).order_by(DespesaVariavel.id))
    return result.scalars().all()


async def criar_variavel(db: AsyncSession, nome: str, tipo: str, valor: float) -> DespesaVariavel:
    despesa = DespesaVariavel(nome=nome, tipo=tipo, valor=valor)
    db.add(despesa)
    await db.commit()
    await db.refresh(despesa)
    return despesa


async def atualizar_variavel(db: AsyncSession, despesa_id: int, nome: str | None, tipo: str | None, valor: float | None) -> DespesaVariavel:
    result = await db.execute(select(DespesaVariavel).where(DespesaVariavel.id == despesa_id))
    despesa = result.scalar_one_or_none()
    if not despesa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despesa variável não encontrada")
    if nome is not None:
        despesa.nome = nome
    if tipo is not None:
        despesa.tipo = tipo
    if valor is not None:
        despesa.valor = valor
    await db.commit()
    await db.refresh(despesa)
    return despesa


async def excluir_variavel(db: AsyncSession, despesa_id: int) -> dict:
    result = await db.execute(select(DespesaVariavel).where(DespesaVariavel.id == despesa_id))
    despesa = result.scalar_one_or_none()
    if not despesa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despesa variável não encontrada")
    await db.delete(despesa)
    await db.commit()
    return {"message": "Despesa variável excluída"}


async def salvar_variaveis_batch(db: AsyncSession, despesas: list[dict]) -> list[DespesaVariavel]:
    """Substitui todas as despesas variáveis de uma vez."""
    existentes = (await db.execute(select(DespesaVariavel))).scalars().all()
    for d in existentes:
        await db.delete(d)
    await db.flush()

    novas = []
    for d in despesas:
        nova = DespesaVariavel(nome=d["nome"], tipo=d.get("tipo", "fixo"), valor=d.get("valor", 0))
        db.add(nova)
        novas.append(nova)

    await db.commit()
    return (await db.execute(select(DespesaVariavel).order_by(DespesaVariavel.id))).scalars().all()


async def calcular_break_even(
    db: AsyncSession,
    ticket_medio: float = 65,
    margem_contribuicao: float = 50,
    dias_funcionamento: int = 26,
) -> dict:
    # Total fixas
    result = await db.execute(select(func.sum(DespesaFixa.valor)))
    total_fixas = result.scalar() or 0

    # Total variável por unidade
    variaveis = (await db.execute(select(DespesaVariavel))).scalars().all()
    total_var = 0
    for d in variaveis:
        if d.tipo == "percentual":
            total_var += ticket_medio * d.valor / 100
        else:
            total_var += d.valor

    contribuicao = (ticket_medio * margem_contribuicao / 100) - total_var
    if contribuicao <= 0:
        return {
            "total_fixas": round(float(total_fixas), 2),
            "total_variavel_por_unidade": round(total_var, 2),
            "vendas_mes": 0,
            "vendas_dia": 0,
            "faturamento_minimo": 0,
        }

    vendas_mes = math.ceil(total_fixas / contribuicao)
    return {
        "total_fixas": round(float(total_fixas), 2),
        "total_variavel_por_unidade": round(total_var, 2),
        "vendas_mes": vendas_mes,
        "vendas_dia": math.ceil(vendas_mes / dias_funcionamento),
        "faturamento_minimo": round(vendas_mes * ticket_medio, 2),
    }
