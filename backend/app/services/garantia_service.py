from __future__ import annotations

import re
from datetime import date, datetime, timezone

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.cliente import Cliente
from app.models.cupom import Cupom
from app.models.garantia import Garantia
from app.models.mensagem import Mensagem
from app.schemas.garantia import GarantiaCreate
from app.services import cupom_service
from app.utils.helpers import gerar_numero_certificado


async def obter_proximo_sequencial(db: AsyncSession, ano: int) -> int:
    prefixo = f"MDA-{ano}-"
    result = await db.execute(
        select(Garantia.certificado)
        .where(Garantia.certificado.like(f"{prefixo}%"))
        .order_by(Garantia.id.desc())
        .limit(1)
    )
    ultimo = result.scalar_one_or_none()
    if not ultimo:
        return 1
    seq = int(ultimo.replace(prefixo, ""))
    return seq + 1


async def listar_garantias(
    db: AsyncSession,
    nome: str | None = None,
    cpf: str | None = None,
    certificado: str | None = None,
    status_filtro: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Garantia], int]:
    query = select(Garantia).options(joinedload(Garantia.cliente))
    count_query = select(func.count(Garantia.id))

    if nome:
        query = query.join(Cliente).where(Cliente.nome.ilike(f"%{nome}%"))
        count_query = count_query.join(Cliente).where(Cliente.nome.ilike(f"%{nome}%"))
    if cpf:
        cpf_limpo = re.sub(r"\D", "", cpf)
        if nome:
            query = query.where(Cliente.cpf == cpf_limpo)
            count_query = count_query.where(Cliente.cpf == cpf_limpo)
        else:
            query = query.join(Cliente).where(Cliente.cpf == cpf_limpo)
            count_query = count_query.join(Cliente).where(Cliente.cpf == cpf_limpo)
    if certificado:
        query = query.where(Garantia.certificado.ilike(f"%{certificado}%"))
        count_query = count_query.where(Garantia.certificado.ilike(f"%{certificado}%"))
    if status_filtro:
        query = query.where(Garantia.status == status_filtro)
        count_query = count_query.where(Garantia.status == status_filtro)
    if data_inicio:
        query = query.where(Garantia.data_inicio >= data_inicio)
        count_query = count_query.where(Garantia.data_inicio >= data_inicio)
    if data_fim:
        query = query.where(Garantia.data_inicio <= data_fim)
        count_query = count_query.where(Garantia.data_inicio <= data_fim)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Garantia.criado_em.desc()).offset(skip).limit(limit)
    )
    return result.unique().scalars().all(), total


async def obter_garantia(db: AsyncSession, garantia_id: int) -> Garantia:
    result = await db.execute(
        select(Garantia)
        .options(
            joinedload(Garantia.cliente),
            joinedload(Garantia.mensagens),
            joinedload(Garantia.cupons),
            joinedload(Garantia.operador),
        )
        .where(Garantia.id == garantia_id)
    )
    garantia = result.unique().scalar_one_or_none()
    if not garantia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Garantia não encontrada",
        )
    return garantia


async def criar_garantia(
    db: AsyncSession, dados: GarantiaCreate, operador_id: int
) -> dict:
    cpf_limpo = re.sub(r"\D", "", dados.cpf)

    # Buscar ou criar cliente
    result = await db.execute(select(Cliente).where(Cliente.cpf == cpf_limpo))
    cliente = result.scalar_one_or_none()

    if cliente:
        # Atualizar dados do cliente existente
        cliente.nome = dados.nome
        cliente.telefone = re.sub(r"\D", "", dados.telefone)
        if dados.email:
            cliente.email = dados.email
        if dados.cep:
            cliente.cep = re.sub(r"\D", "", dados.cep)
        if dados.endereco:
            cliente.endereco = dados.endereco
        if dados.numero:
            cliente.numero = dados.numero
        if dados.complemento:
            cliente.complemento = dados.complemento
        if dados.bairro:
            cliente.bairro = dados.bairro
        if dados.cidade:
            cliente.cidade = dados.cidade
        if dados.uf:
            cliente.uf = dados.uf
    else:
        cliente = Cliente(
            cpf=cpf_limpo,
            nome=dados.nome,
            telefone=re.sub(r"\D", "", dados.telefone),
            data_nascimento=dados.data_nascimento,
            email=dados.email,
            cep=re.sub(r"\D", "", dados.cep) if dados.cep else None,
            endereco=dados.endereco,
            numero=dados.numero,
            complemento=dados.complemento,
            bairro=dados.bairro,
            cidade=dados.cidade,
            uf=dados.uf,
        )
        db.add(cliente)
        await db.flush()

    # Incrementar total_compras
    cliente.total_compras = (cliente.total_compras or 0) + 1

    # Gerar certificado
    ano = date.today().year
    seq = await obter_proximo_sequencial(db, ano)
    certificado = gerar_numero_certificado(ano, seq)

    # Calcular datas
    inicio = dados.data_inicio or dados.data_compra
    termino = inicio + relativedelta(months=dados.periodo_meses)

    # Criar garantia
    garantia = Garantia(
        certificado=certificado,
        cliente_id=cliente.id,
        produto_nome=dados.produto_nome,
        produto_serie=dados.produto_serie,
        produto_categoria=dados.produto_categoria,
        produto_valor=dados.produto_valor,
        loja=dados.loja,
        data_compra=dados.data_compra,
        periodo_meses=dados.periodo_meses,
        data_inicio=inicio,
        data_termino=termino,
        operador_id=operador_id,
    )
    db.add(garantia)
    await db.flush()

    # Gerar cupom se aplicável
    cupom = None
    if cliente.total_compras >= 2:
        cupom = await cupom_service.gerar_cupom_desconto(
            db, cliente.id, cliente.total_compras, garantia.id
        )

    await db.commit()
    await db.refresh(garantia)
    await db.refresh(cliente)

    return {
        "garantia": garantia,
        "cliente": cliente,
        "cupom": cupom,
    }


async def atualizar_status(
    db: AsyncSession, garantia_id: int, novo_status: str
) -> Garantia:
    validos = ["Ativa", "Expirada", "Cancelada"]
    if novo_status not in validos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status inválido. Valores aceitos: {', '.join(validos)}",
        )

    garantia = await obter_garantia(db, garantia_id)
    garantia.status = novo_status
    await db.commit()
    await db.refresh(garantia)
    return garantia


async def excluir_garantia(db: AsyncSession, garantia_id: int) -> dict:
    """Exclui uma garantia e todos os registros relacionados (mensagens e cupons)."""
    garantia = await obter_garantia(db, garantia_id)
    certificado = garantia.certificado
    cliente_nome = garantia.cliente.nome

    # Excluir mensagens vinculadas
    msgs = await db.execute(
        select(Mensagem).where(Mensagem.garantia_id == garantia_id)
    )
    mensagens_excluidas = 0
    for msg in msgs.scalars().all():
        await db.delete(msg)
        mensagens_excluidas += 1

    # Excluir cupons vinculados
    cups = await db.execute(
        select(Cupom).where(Cupom.garantia_id == garantia_id)
    )
    cupons_excluidos = 0
    for cup in cups.scalars().all():
        await db.delete(cup)
        cupons_excluidos += 1

    # Excluir a garantia
    await db.delete(garantia)
    await db.commit()

    return {
        "certificado": certificado,
        "cliente_nome": cliente_nome,
        "mensagens_excluidas": mensagens_excluidas,
        "cupons_excluidos": cupons_excluidos,
    }


async def obter_estatisticas(db: AsyncSession) -> dict:
    total = (await db.execute(select(func.count(Garantia.id)))).scalar() or 0
    ativas = (await db.execute(
        select(func.count(Garantia.id)).where(Garantia.status == "Ativa")
    )).scalar() or 0
    expiradas = (await db.execute(
        select(func.count(Garantia.id)).where(Garantia.status == "Expirada")
    )).scalar() or 0
    canceladas = (await db.execute(
        select(func.count(Garantia.id)).where(Garantia.status == "Cancelada")
    )).scalar() or 0
    total_clientes = (await db.execute(select(func.count(Cliente.id)))).scalar() or 0

    hoje = date.today()
    primeiro_dia_mes = hoje.replace(day=1)
    garantias_mes = (await db.execute(
        select(func.count(Garantia.id)).where(Garantia.criado_em >= datetime(
            primeiro_dia_mes.year, primeiro_dia_mes.month, primeiro_dia_mes.day,
            tzinfo=timezone.utc
        ))
    )).scalar() or 0

    inicio_hoje = datetime(hoje.year, hoje.month, hoje.day, tzinfo=timezone.utc)
    mensagens_hoje = (await db.execute(
        select(func.count(Mensagem.id)).where(Mensagem.criado_em >= inicio_hoje)
    )).scalar() or 0

    cupons_gerados = (await db.execute(select(func.count(Cupom.id)))).scalar() or 0

    return {
        "total_garantias": total,
        "garantias_ativas": ativas,
        "garantias_expiradas": expiradas,
        "garantias_canceladas": canceladas,
        "total_clientes": total_clientes,
        "garantias_mes_atual": garantias_mes,
        "mensagens_hoje": mensagens_hoje,
        "cupons_gerados": cupons_gerados,
    }
