from __future__ import annotations

import math

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.produto import Produto, ProdutoCanal
from app.schemas.produto import ProdutoCreate, ProdutoUpdate

NOMES_CANAIS = {
    "lojaFisica": "Loja Física",
    "shopee": "Shopee",
    "mercadoLivre": "Mercado Livre",
    "amazon": "Amazon",
    "tiktok": "TikTok Shop",
}


async def listar_produtos(
    db: AsyncSession,
    busca: str | None = None,
    categoria: str | None = None,
    status_estoque: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Produto], int]:
    query = select(Produto).options(joinedload(Produto.canais))
    count_query = select(func.count(Produto.id))

    if busca:
        filtro = f"%{busca}%"
        query = query.where(
            Produto.nome.ilike(filtro) | Produto.sku.ilike(filtro) | Produto.categoria.ilike(filtro)
        )
        count_query = count_query.where(
            Produto.nome.ilike(filtro) | Produto.sku.ilike(filtro) | Produto.categoria.ilike(filtro)
        )

    if categoria:
        query = query.where(Produto.categoria == categoria)
        count_query = count_query.where(Produto.categoria == categoria)

    if status_estoque == "OK":
        query = query.where(Produto.qtd_estoque > Produto.limite_minimo)
        count_query = count_query.where(Produto.qtd_estoque > Produto.limite_minimo)
    elif status_estoque == "Baixo":
        query = query.where(Produto.qtd_estoque > 0, Produto.qtd_estoque <= Produto.limite_minimo)
        count_query = count_query.where(Produto.qtd_estoque > 0, Produto.qtd_estoque <= Produto.limite_minimo)
    elif status_estoque == "Esgotado":
        query = query.where(Produto.qtd_estoque == 0)
        count_query = count_query.where(Produto.qtd_estoque == 0)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Produto.criado_em.desc()).offset(skip).limit(limit)
    )
    return result.unique().scalars().all(), total


async def obter_produto(db: AsyncSession, produto_id: int) -> Produto:
    result = await db.execute(
        select(Produto).options(joinedload(Produto.canais)).where(Produto.id == produto_id)
    )
    produto = result.unique().scalar_one_or_none()
    if not produto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")
    return produto


async def criar_produto(db: AsyncSession, dados: ProdutoCreate) -> Produto:
    # Verificar SKU duplicado
    existente = await db.execute(select(Produto).where(Produto.sku == dados.sku))
    if existente.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SKU já existe")

    produto = Produto(
        nome=dados.nome,
        sku=dados.sku,
        categoria=dados.categoria,
        descricao=dados.descricao,
        qtd_estoque=dados.qtd_estoque,
        limite_minimo=dados.limite_minimo,
        valor_compra=dados.valor_compra,
        tipo_banho=dados.tipo_banho,
        valor_grama_banho=dados.valor_grama_banho,
        qtd_gramas=dados.qtd_gramas,
        custo_embalagem=dados.custo_embalagem,
        outros_custos=dados.outros_custos,
        custo_total=dados.custo_total,
    )
    db.add(produto)
    await db.flush()

    for canal_dados in dados.canais:
        canal = ProdutoCanal(
            produto_id=produto.id,
            canal=canal_dados.canal,
            ativo=canal_dados.ativo,
            comissao=canal_dados.comissao,
            taxa_fixa=canal_dados.taxa_fixa,
            taxa_item=canal_dados.taxa_item,
            imposto=canal_dados.imposto,
            margem=canal_dados.margem,
            custo_frete=canal_dados.custo_frete,
            frete_absorvido=canal_dados.frete_absorvido,
            tipo_anuncio=canal_dados.tipo_anuncio,
            usar_fba=canal_dados.usar_fba,
            taxa_fba=canal_dados.taxa_fba,
            comissao_afiliado=canal_dados.comissao_afiliado,
            frete_gratis=canal_dados.frete_gratis,
            preco_sugerido=canal_dados.preco_sugerido,
            preco_final=canal_dados.preco_final,
            margem_real=canal_dados.margem_real,
            lucro=canal_dados.lucro,
            taxas_canal=canal_dados.taxas_canal,
        )
        db.add(canal)

    await db.commit()
    await db.refresh(produto)
    return await obter_produto(db, produto.id)


async def atualizar_produto(db: AsyncSession, produto_id: int, dados: ProdutoUpdate) -> Produto:
    produto = await obter_produto(db, produto_id)

    campos = dados.model_dump(exclude_unset=True, exclude={"canais"})
    for campo, valor in campos.items():
        setattr(produto, campo, valor)

    if dados.canais is not None:
        # Remover canais antigos
        for canal in produto.canais:
            await db.delete(canal)
        await db.flush()

        # Criar novos canais
        for canal_dados in dados.canais:
            canal = ProdutoCanal(
                produto_id=produto.id,
                canal=canal_dados.canal,
                ativo=canal_dados.ativo,
                comissao=canal_dados.comissao,
                taxa_fixa=canal_dados.taxa_fixa,
                taxa_item=canal_dados.taxa_item,
                imposto=canal_dados.imposto,
                margem=canal_dados.margem,
                custo_frete=canal_dados.custo_frete,
                frete_absorvido=canal_dados.frete_absorvido,
                tipo_anuncio=canal_dados.tipo_anuncio,
                usar_fba=canal_dados.usar_fba,
                taxa_fba=canal_dados.taxa_fba,
                comissao_afiliado=canal_dados.comissao_afiliado,
                frete_gratis=canal_dados.frete_gratis,
                preco_sugerido=canal_dados.preco_sugerido,
                preco_final=canal_dados.preco_final,
                margem_real=canal_dados.margem_real,
                lucro=canal_dados.lucro,
                taxas_canal=canal_dados.taxas_canal,
            )
            db.add(canal)

    await db.commit()
    return await obter_produto(db, produto_id)


async def excluir_produto(db: AsyncSession, produto_id: int) -> dict:
    produto = await obter_produto(db, produto_id)
    nome = produto.nome
    await db.delete(produto)
    await db.commit()
    return {"message": f"Produto '{nome}' excluído com sucesso"}


async def obter_estatisticas(db: AsyncSession) -> dict:
    total = (await db.execute(select(func.count(Produto.id)))).scalar() or 0

    baixo_estoque = (await db.execute(
        select(func.count(Produto.id)).where(Produto.qtd_estoque <= Produto.limite_minimo)
    )).scalar() or 0

    # Ticket médio = média dos preços da loja física
    result = await db.execute(
        select(func.avg(ProdutoCanal.preco_final))
        .where(ProdutoCanal.canal == "lojaFisica", ProdutoCanal.ativo == True, ProdutoCanal.preco_final > 0)
    )
    ticket_medio = result.scalar() or 0

    # Margem média da loja física
    result = await db.execute(
        select(func.avg(ProdutoCanal.margem_real))
        .where(ProdutoCanal.canal == "lojaFisica", ProdutoCanal.ativo == True)
    )
    margem_media = result.scalar() or 0

    return {
        "total": total,
        "baixo_estoque": baixo_estoque,
        "ticket_medio": round(float(ticket_medio), 2),
        "margem_media": round(float(margem_media), 1),
    }


async def obter_margem_por_canal(db: AsyncSession) -> list[dict]:
    canais_keys = ["lojaFisica", "shopee", "mercadoLivre", "amazon", "tiktok"]
    resultado = []

    for canal_key in canais_keys:
        result = await db.execute(
            select(
                func.avg(ProdutoCanal.margem_real),
                func.count(ProdutoCanal.id),
            ).where(ProdutoCanal.canal == canal_key, ProdutoCanal.ativo == True)
        )
        row = result.one()
        margem = round(float(row[0] or 0), 1)
        qtd = row[1] or 0
        resultado.append({
            "canal": NOMES_CANAIS.get(canal_key, canal_key),
            "margem": margem,
            "qtd_produtos": qtd,
        })

    return resultado


async def obter_produtos_baixo_estoque(db: AsyncSession) -> list[Produto]:
    result = await db.execute(
        select(Produto)
        .where(Produto.qtd_estoque <= Produto.limite_minimo)
        .order_by(Produto.qtd_estoque.asc())
    )
    return result.scalars().all()
