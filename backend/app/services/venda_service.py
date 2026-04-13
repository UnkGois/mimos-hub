from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.cliente import Cliente
from app.models.produto import Produto
from app.models.venda import Venda, VendaItem
from app.schemas.venda import VendaCreate
from app.services import cupom_service

FORMAS_PAGAMENTO = {"dinheiro", "cartao_credito", "cartao_debito", "pix"}


async def _proximo_codigo(db: AsyncSession) -> str:
    ano = datetime.now(timezone.utc).year
    prefixo = f"VND-{ano}-"
    result = await db.execute(
        select(Venda.codigo)
        .where(Venda.codigo.like(f"{prefixo}%"))
        .order_by(Venda.id.desc())
        .limit(1)
    )
    ultimo = result.scalar_one_or_none()
    seq = 1 if not ultimo else int(ultimo.replace(prefixo, "")) + 1
    return f"{prefixo}{seq:06d}"


async def criar_venda(db: AsyncSession, dados: VendaCreate, operador_id: int) -> Venda:
    if dados.forma_pagamento not in FORMAS_PAGAMENTO:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Forma de pagamento inválida")
    if not dados.itens:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A venda precisa ter pelo menos 1 item")

    # Calcular subtotal
    subtotal = Decimal("0")
    for item in dados.itens:
        subtotal += item.preco_unitario * item.quantidade

    # Cupom
    cupom_id = None
    desconto_cupom = Decimal("0")
    if dados.cupom_codigo:
        validacao = await cupom_service.validar_cupom(db, dados.cupom_codigo)
        if not validacao["valido"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cupom inválido: {validacao['motivo']}")
        cupom = validacao["cupom"]
        cupom_id = cupom.id
        if cupom.tipo_desconto == "percentual":
            desconto_cupom = subtotal * Decimal(str(cupom.percentual)) / Decimal("100")
        elif cupom.valor_desconto:
            desconto_cupom = Decimal(str(cupom.valor_desconto))
        desconto_cupom = min(desconto_cupom, subtotal)

    desconto_manual = min(dados.desconto_manual, subtotal - desconto_cupom)
    total = subtotal - desconto_cupom - desconto_manual
    if total < 0:
        total = Decimal("0")

    # Troco
    troco = Decimal("0")
    if dados.forma_pagamento == "dinheiro":
        if dados.valor_recebido is None or dados.valor_recebido < total:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Valor recebido insuficiente")
        troco = dados.valor_recebido - total

    codigo = await _proximo_codigo(db)

    venda = Venda(
        codigo=codigo,
        cliente_id=dados.cliente_id,
        operador_id=operador_id,
        cupom_id=cupom_id,
        subtotal=subtotal,
        desconto_cupom=desconto_cupom,
        desconto_manual=desconto_manual,
        desconto_manual_motivo=dados.desconto_manual_motivo,
        total=total,
        forma_pagamento=dados.forma_pagamento,
        valor_recebido=dados.valor_recebido,
        troco=troco,
        observacao=dados.observacao,
    )
    db.add(venda)
    await db.flush()

    # Criar itens e dar baixa no estoque
    for item_data in dados.itens:
        item_subtotal = item_data.preco_unitario * item_data.quantidade
        venda_item = VendaItem(
            venda_id=venda.id,
            produto_id=item_data.produto_id,
            produto_nome=item_data.produto_nome,
            produto_sku=item_data.produto_sku,
            produto_categoria=item_data.produto_categoria,
            preco_unitario=item_data.preco_unitario,
            quantidade=item_data.quantidade,
            subtotal=item_subtotal,
        )
        db.add(venda_item)

        if item_data.produto_id:
            result = await db.execute(
                select(Produto).where(Produto.id == item_data.produto_id)
            )
            produto = result.scalar_one_or_none()
            if produto:
                if produto.qtd_estoque < item_data.quantidade:
                    raise HTTPException(
                        status.HTTP_400_BAD_REQUEST,
                        f"Estoque insuficiente para '{produto.nome}' (disponível: {produto.qtd_estoque})",
                    )
                produto.qtd_estoque -= item_data.quantidade

    # Marcar cupom como usado
    if cupom_id:
        await cupom_service.usar_cupom(db, cupom_id)

    # Incrementar compras do cliente
    if dados.cliente_id:
        result = await db.execute(select(Cliente).where(Cliente.id == dados.cliente_id))
        cliente = result.scalar_one_or_none()
        if cliente:
            cliente.total_compras = (cliente.total_compras or 0) + 1

    await db.commit()
    await db.refresh(venda)
    return await obter_venda(db, venda.id)


async def listar_vendas(
    db: AsyncSession,
    busca: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    status_venda: str | None = None,
    forma_pagamento: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Venda], int]:
    query = select(Venda).options(
        joinedload(Venda.itens),
        joinedload(Venda.cliente),
        joinedload(Venda.operador),
        joinedload(Venda.cupom),
    )
    count_query = select(func.count(Venda.id))

    if busca:
        query = query.where(Venda.codigo.ilike(f"%{busca}%"))
        count_query = count_query.where(Venda.codigo.ilike(f"%{busca}%"))
    if status_venda:
        query = query.where(Venda.status == status_venda)
        count_query = count_query.where(Venda.status == status_venda)
    if forma_pagamento:
        query = query.where(Venda.forma_pagamento == forma_pagamento)
        count_query = count_query.where(Venda.forma_pagamento == forma_pagamento)
    if data_inicio:
        d = date.fromisoformat(data_inicio)
        query = query.where(func.date(Venda.criado_em) >= d)
        count_query = count_query.where(func.date(Venda.criado_em) >= d)
    if data_fim:
        d = date.fromisoformat(data_fim)
        query = query.where(func.date(Venda.criado_em) <= d)
        count_query = count_query.where(func.date(Venda.criado_em) <= d)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Venda.criado_em.desc()).offset(skip).limit(limit)
    )
    return result.unique().scalars().all(), total


async def obter_venda(db: AsyncSession, venda_id: int) -> Venda:
    result = await db.execute(
        select(Venda)
        .options(
            joinedload(Venda.itens),
            joinedload(Venda.cliente),
            joinedload(Venda.operador),
            joinedload(Venda.cupom),
        )
        .where(Venda.id == venda_id)
    )
    venda = result.unique().scalar_one_or_none()
    if not venda:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venda não encontrada")
    return venda


async def cancelar_venda(db: AsyncSession, venda_id: int) -> Venda:
    venda = await obter_venda(db, venda_id)
    if venda.status == "Cancelada":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Venda já cancelada")

    venda.status = "Cancelada"

    # Restaurar estoque
    for item in venda.itens:
        if item.produto_id:
            result = await db.execute(
                select(Produto).where(Produto.id == item.produto_id)
            )
            produto = result.scalar_one_or_none()
            if produto:
                produto.qtd_estoque += item.quantidade

    # Desmarcar cupom
    if venda.cupom_id and venda.cupom:
        venda.cupom.usado = False
        venda.cupom.usado_em = None

    # Decrementar compras do cliente
    if venda.cliente_id and venda.cliente:
        if venda.cliente.total_compras and venda.cliente.total_compras > 0:
            venda.cliente.total_compras -= 1

    await db.commit()
    return await obter_venda(db, venda_id)


async def obter_estatisticas(db: AsyncSession) -> dict:
    hoje = date.today()
    primeiro_dia_mes = hoje.replace(day=1)

    total_vendas = (await db.execute(
        select(func.count(Venda.id)).where(Venda.status == "Concluida")
    )).scalar() or 0

    vendas_hoje = (await db.execute(
        select(func.count(Venda.id))
        .where(Venda.status == "Concluida")
        .where(func.date(Venda.criado_em) == hoje)
    )).scalar() or 0

    faturamento_hoje = (await db.execute(
        select(func.sum(Venda.total))
        .where(Venda.status == "Concluida")
        .where(func.date(Venda.criado_em) == hoje)
    )).scalar() or Decimal("0")

    faturamento_mes = (await db.execute(
        select(func.sum(Venda.total))
        .where(Venda.status == "Concluida")
        .where(func.date(Venda.criado_em) >= primeiro_dia_mes)
    )).scalar() or Decimal("0")

    ticket_medio = faturamento_mes / total_vendas if total_vendas > 0 else Decimal("0")

    forma_result = await db.execute(
        select(Venda.forma_pagamento, func.count(Venda.id).label("qtd"))
        .where(Venda.status == "Concluida")
        .group_by(Venda.forma_pagamento)
        .order_by(func.count(Venda.id).desc())
        .limit(1)
    )
    row = forma_result.first()
    forma_mais_usada = row[0] if row else None

    return {
        "total_vendas": total_vendas,
        "vendas_hoje": vendas_hoje,
        "faturamento_hoje": faturamento_hoje,
        "faturamento_mes": faturamento_mes,
        "ticket_medio": round(ticket_medio, 2),
        "forma_pagamento_mais_usada": forma_mais_usada,
    }


async def vincular_garantia_item(
    db: AsyncSession, venda_id: int, item_id: int, garantia_id: int
) -> VendaItem:
    venda = await obter_venda(db, venda_id)
    item = next((i for i in venda.itens if i.id == item_id), None)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item não encontrado")
    item.garantia_id = garantia_id
    await db.commit()
    await db.refresh(item)
    return item
