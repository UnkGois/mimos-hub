from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.cupom import Cupom
from app.utils.helpers import calcular_desconto, gerar_codigo_cupom


async def _gerar_codigo_unico(db: AsyncSession) -> str:
    for _ in range(10):
        codigo = gerar_codigo_cupom()
        result = await db.execute(select(Cupom).where(Cupom.codigo == codigo))
        if not result.scalar_one_or_none():
            return codigo
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Não foi possível gerar código único para o cupom",
    )


async def gerar_cupom_desconto(
    db: AsyncSession,
    cliente_id: int,
    total_compras: int,
    garantia_id: int | None = None,
) -> Cupom | None:
    percentual = calcular_desconto(total_compras)
    if percentual == 0:
        return None

    codigo = await _gerar_codigo_unico(db)
    validade = date.today() + timedelta(days=90)

    cupom = Cupom(
        codigo=codigo,
        cliente_id=cliente_id,
        garantia_id=garantia_id,
        percentual=percentual,
        motivo=f"Desconto automático — {total_compras}ª compra",
        validade=validade,
    )
    db.add(cupom)
    await db.flush()
    return cupom


async def gerar_cupom_manual(
    db: AsyncSession,
    cliente_id: int,
    tipo_desconto: str,
    valor: Decimal,
    motivo: str,
    validade_dias: int = 90,
) -> Cupom:
    if tipo_desconto not in ("percentual", "valor"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tipo_desconto deve ser 'percentual' ou 'valor'",
        )

    if validade_dias <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validade deve ser maior que zero",
        )

    if valor <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valor do desconto deve ser maior que zero",
        )

    if tipo_desconto == "percentual" and valor > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Percentual não pode ser maior que 100%",
        )

    codigo = await _gerar_codigo_unico(db)
    validade = date.today() + timedelta(days=validade_dias)

    if tipo_desconto == "percentual":
        cupom = Cupom(
            codigo=codigo,
            cliente_id=cliente_id,
            tipo_desconto="percentual",
            percentual=valor,
            valor_desconto=None,
            motivo=motivo,
            validade=validade,
        )
    else:
        cupom = Cupom(
            codigo=codigo,
            cliente_id=cliente_id,
            tipo_desconto="valor",
            percentual=Decimal("0"),
            valor_desconto=valor,
            motivo=motivo,
            validade=validade,
        )

    db.add(cupom)
    await db.commit()
    await db.refresh(cupom)
    return cupom


async def listar_cupons(
    db: AsyncSession,
    cliente_id: int | None = None,
    usado: bool | None = None,
    codigo: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Cupom], int]:
    query = select(Cupom).options(joinedload(Cupom.cliente))
    count_query = select(func.count(Cupom.id))

    if cliente_id is not None:
        query = query.where(Cupom.cliente_id == cliente_id)
        count_query = count_query.where(Cupom.cliente_id == cliente_id)
    if usado is not None:
        query = query.where(Cupom.usado == usado)
        count_query = count_query.where(Cupom.usado == usado)
    if codigo:
        query = query.where(Cupom.codigo.ilike(f"%{codigo}%"))
        count_query = count_query.where(Cupom.codigo.ilike(f"%{codigo}%"))

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Cupom.criado_em.desc()).offset(skip).limit(limit)
    )
    return result.unique().scalars().all(), total


async def validar_cupom(db: AsyncSession, codigo: str) -> dict:
    result = await db.execute(select(Cupom).where(Cupom.codigo == codigo))
    cupom = result.scalar_one_or_none()

    if not cupom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cupom não encontrado",
        )

    if cupom.usado:
        return {"valido": False, "motivo": "Cupom já utilizado", "cupom": cupom}

    if cupom.validade < date.today():
        return {"valido": False, "motivo": "Cupom expirado", "cupom": cupom}

    # Montar mensagem correta baseada no tipo de desconto
    if cupom.tipo_desconto == "valor" and cupom.valor_desconto:
        desconto_texto = f"R$ {float(cupom.valor_desconto):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    else:
        desconto_texto = f"{cupom.percentual}%"

    return {
        "valido": True,
        "motivo": f"Cupom válido — {desconto_texto} de desconto",
        "cupom": cupom,
    }


async def atualizar_status_cupom(
    db: AsyncSession,
    cupom_id: int,
    novo_status: str,
) -> Cupom:
    """Atualiza o status de um cupom."""
    status_validos = {"Ativo", "Usado", "Desativado", "Expirado"}
    if novo_status not in status_validos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status inválido. Use: {', '.join(sorted(status_validos))}",
        )

    result = await db.execute(
        select(Cupom).options(joinedload(Cupom.cliente)).where(Cupom.id == cupom_id)
    )
    cupom = result.unique().scalar_one_or_none()
    if not cupom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cupom não encontrado",
        )

    if novo_status == "Ativo":
        cupom.usado = False
        cupom.usado_em = None
        cupom.desativado = False
        # Se expirado, estender validade por 30 dias
        if cupom.validade < date.today():
            cupom.validade = date.today() + timedelta(days=30)
    elif novo_status == "Usado":
        cupom.usado = True
        cupom.usado_em = datetime.now(timezone.utc)
        cupom.desativado = False
    elif novo_status == "Desativado":
        cupom.desativado = True
        cupom.usado = False
        cupom.usado_em = None
    elif novo_status == "Expirado":
        cupom.desativado = False
        cupom.usado = False
        cupom.usado_em = None
        cupom.validade = date.today() - timedelta(days=1)

    await db.commit()
    await db.refresh(cupom)
    return cupom


async def excluir_cupom(db: AsyncSession, cupom_id: int) -> None:
    """Exclui um cupom permanentemente."""
    result = await db.execute(select(Cupom).where(Cupom.id == cupom_id))
    cupom = result.scalar_one_or_none()
    if not cupom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cupom não encontrado",
        )
    await db.delete(cupom)
    await db.commit()


async def usar_cupom(db: AsyncSession, cupom_id: int) -> Cupom:
    result = await db.execute(select(Cupom).where(Cupom.id == cupom_id))
    cupom = result.scalar_one_or_none()

    if not cupom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cupom não encontrado",
        )

    if cupom.usado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cupom já foi utilizado",
        )

    if cupom.validade < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cupom expirado",
        )

    cupom.usado = True
    cupom.usado_em = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cupom)
    return cupom
