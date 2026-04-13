from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone
from functools import partial

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

logger = logging.getLogger(__name__)

from app.models.cliente import Cliente
from app.models.garantia import Garantia
from app.models.mensagem import Mensagem
from app.services.whatsapp_service import (
    enviar_documento_whatsapp,
    enviar_mensagem_whatsapp,
)


def _gerar_conteudo(
    tipo: str,
    garantia: Garantia,
    cliente: Cliente,
    cupom_codigo: str | None = None,
    cupom_percentual: float | None = None,
) -> str:
    if tipo == "Certificado":
        return (
            f"Olá {cliente.nome}! Seu certificado de garantia MDA - Mimos de Alice "
            f"nº {garantia.certificado} foi emitido com sucesso. "
            f"Produto: {garantia.produto_nome}. "
            f"Vigência: {garantia.data_inicio.strftime('%d/%m/%Y')} "
            f"a {garantia.data_termino.strftime('%d/%m/%Y')}. "
            f"Em anexo, segue o certificado em PDF."
        )
    if tipo == "Lembrete":
        return (
            f"Olá {cliente.nome}! Sua garantia MDA - Mimos de Alice "
            f"nº {garantia.certificado} do produto {garantia.produto_nome} "
            f"vence em {garantia.data_termino.strftime('%d/%m/%Y')}. "
            f"Aproveite para renovar!"
        )
    if tipo == "Desconto":
        if cupom_codigo and cupom_percentual:
            return (
                f"Olá {cliente.nome}! Você ganhou um cupom de desconto MDA - Mimos de Alice! "
                f"Use o código *{cupom_codigo}* e ganhe *{cupom_percentual:.0f}% OFF* "
                f"na sua próxima compra. Válido por 90 dias. Aproveite!"
            )
        return (
            f"Olá {cliente.nome}! Você tem um cupom de desconto MDA - Mimos de Alice "
            f"disponível. Acesse a loja e aproveite condições especiais!"
        )
    return f"Olá {cliente.nome}! Mensagem da MDA - Mimos de Alice Garantias."


async def listar_mensagens(
    db: AsyncSession,
    cliente_nome: str | None = None,
    tipo: str | None = None,
    status_filtro: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Mensagem], int]:
    query = select(Mensagem).options(joinedload(Mensagem.cliente))
    count_query = select(func.count(Mensagem.id))

    if cliente_nome:
        query = query.join(Cliente).where(Cliente.nome.ilike(f"%{cliente_nome}%"))
        count_query = count_query.join(Cliente).where(Cliente.nome.ilike(f"%{cliente_nome}%"))
    if tipo:
        query = query.where(Mensagem.tipo == tipo)
        count_query = count_query.where(Mensagem.tipo == tipo)
    if status_filtro:
        query = query.where(Mensagem.status == status_filtro)
        count_query = count_query.where(Mensagem.status == status_filtro)
    if data_inicio:
        inicio = datetime(data_inicio.year, data_inicio.month, data_inicio.day, tzinfo=timezone.utc)
        query = query.where(Mensagem.criado_em >= inicio)
        count_query = count_query.where(Mensagem.criado_em >= inicio)
    if data_fim:
        fim = datetime(data_fim.year, data_fim.month, data_fim.day, 23, 59, 59, tzinfo=timezone.utc)
        query = query.where(Mensagem.criado_em <= fim)
        count_query = count_query.where(Mensagem.criado_em <= fim)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Mensagem.criado_em.desc()).offset(skip).limit(limit)
    )
    return result.unique().scalars().all(), total


async def enviar_mensagem(
    db: AsyncSession,
    garantia_id: int,
    tipo: str,
    cupom_codigo: str | None = None,
    cupom_percentual: float | None = None,
) -> Mensagem:
    result = await db.execute(
        select(Garantia)
        .options(joinedload(Garantia.cliente), joinedload(Garantia.operador))
        .where(Garantia.id == garantia_id)
    )
    garantia = result.unique().scalar_one_or_none()
    if not garantia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Garantia não encontrada",
        )

    cliente = garantia.cliente
    conteudo = _gerar_conteudo(tipo, garantia, cliente, cupom_codigo, cupom_percentual)

    mensagem = Mensagem(
        garantia_id=garantia_id,
        cliente_id=cliente.id,
        tipo=tipo,
        conteudo=conteudo,
        status="Pendente",
    )
    db.add(mensagem)
    await db.flush()

    # Tentar enviar texto via WhatsApp
    resultado = await enviar_mensagem_whatsapp(cliente.telefone, conteudo)

    if resultado["status"] == "enviado" or resultado["status"] == "simulado":
        mensagem.status = "Enviado"
        mensagem.enviado_em = datetime.now(timezone.utc)

        # Para Certificado, enviar também o PDF em anexo
        if tipo == "Certificado":
            await _enviar_pdf_certificado(garantia, cliente)
    else:
        mensagem.status = "Falha"
        mensagem.motivo_falha = resultado.get("erro", "Erro desconhecido")

    await db.commit()

    # Reload com eager load do cliente
    result = await db.execute(
        select(Mensagem)
        .options(joinedload(Mensagem.cliente))
        .where(Mensagem.id == mensagem.id)
    )
    return result.unique().scalar_one()


async def _enviar_pdf_certificado(garantia: Garantia, cliente: Cliente) -> None:
    """Gera o PDF do certificado e envia via WhatsApp."""
    from app.services.pdf_service import gerar_certificado_pdf

    pdf_bytes = await asyncio.to_thread(partial(gerar_certificado_pdf,
        certificado=garantia.certificado,
        cliente_nome=cliente.nome,
        cliente_cpf=cliente.cpf,
        cliente_nascimento=cliente.data_nascimento,
        cliente_telefone=cliente.telefone or "",
        cliente_email=cliente.email or "",
        cliente_endereco=cliente.endereco or "",
        cliente_numero=cliente.numero or "",
        cliente_bairro=cliente.bairro or "",
        cliente_cidade=cliente.cidade or "",
        cliente_uf=cliente.uf or "",
        cliente_cep=cliente.cep or "",
        produto_nome=garantia.produto_nome or "",
        produto_categoria=garantia.produto_categoria or "",
        produto_serie=garantia.produto_serie or "",
        produto_valor=garantia.produto_valor or 0,
        produto_loja=garantia.loja or "",
        data_compra=garantia.data_compra,
        tipo_garantia=garantia.tipo_garantia or "Universal",
        periodo_meses=garantia.periodo_meses or 0,
        data_inicio=garantia.data_inicio,
        data_termino=garantia.data_termino,
        operador_nome=garantia.operador.nome if garantia.operador else "",
        data_emissao=garantia.criado_em,
    ))

    filename = f"Certificado_{garantia.certificado}"
    logger.info("Enviando PDF %s (%d bytes) para %s", filename, len(pdf_bytes), cliente.telefone)
    resultado = await enviar_documento_whatsapp(
        telefone=cliente.telefone,
        pdf_bytes=pdf_bytes,
        filename=filename,
        caption=f"Certificado de Garantia {garantia.certificado} - MDA - Mimos de Alice",
    )
    logger.info("Resultado envio PDF: %s", resultado)


async def enviar_cupom_whatsapp(
    db: AsyncSession,
    cliente_id: int,
    cupom_codigo: str,
    cupom_percentual: float,
    garantia_id: int | None = None,
    validade: date | None = None,
    tipo_desconto: str = "percentual",
    valor_desconto: float | None = None,
) -> None:
    """Envia mensagem WhatsApp com detalhes do cupom de desconto."""
    result = await db.execute(
        select(Cliente).where(Cliente.id == cliente_id)
    )
    cliente = result.scalar_one_or_none()
    if not cliente:
        return

    validade_str = validade.strftime("%d/%m/%Y") if validade else ""

    if tipo_desconto == "valor" and valor_desconto:
        desconto_texto = f"*R$ {valor_desconto:,.2f} de desconto*".replace(",", "X").replace(".", ",").replace("X", ".")
    else:
        desconto_texto = f"*{cupom_percentual:.0f}% de desconto*"

    conteudo = (
        f"\u2728 Oi {cliente.nome}! Tudo bem? \U0001f495\n\n"
        f"A Mimos de Alice preparou um presente especial pra voc\u00ea! \U0001f381\n\n"
        f"Voc\u00ea ganhou {desconto_texto} na sua pr\u00f3xima compra!\n\n"
        f"\U0001f380 Cupom: *{cupom_codigo}*\n"
        f"\U0001f4c5 V\u00e1lido at\u00e9: {validade_str}\n\n"
        f"Use na loja f\u00edsica ou nas nossas lojas online!\n"
        f"Estamos com pe\u00e7as lindas esperando por voc\u00ea! \U0001f48e\n\n"
        f"Com carinho,\n"
        f"MDA - Mimos de Alice Joias \U0001fa77\n"
        f"www.mimosdealicejoias.com.br"
    )

    mensagem = Mensagem(
        garantia_id=garantia_id,
        cliente_id=cliente_id,
        tipo="Desconto",
        conteudo=conteudo,
        status="Pendente",
    )
    db.add(mensagem)
    await db.flush()

    resultado = await enviar_mensagem_whatsapp(cliente.telefone, conteudo)

    if resultado["status"] == "enviado" or resultado["status"] == "simulado":
        mensagem.status = "Enviado"
        mensagem.enviado_em = datetime.now(timezone.utc)
    else:
        mensagem.status = "Falha"
        mensagem.motivo_falha = resultado.get("erro", "Erro desconhecido")

    await db.commit()


async def editar_mensagem(
    db: AsyncSession,
    mensagem_id: int,
    novo_conteudo: str,
    reenviar: bool = False,
) -> Mensagem:
    """Edita o conteúdo de uma mensagem e opcionalmente reenvia via WhatsApp."""
    result = await db.execute(
        select(Mensagem)
        .options(joinedload(Mensagem.cliente))
        .where(Mensagem.id == mensagem_id)
    )
    mensagem = result.unique().scalar_one_or_none()
    if not mensagem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mensagem não encontrada",
        )

    mensagem.conteudo = novo_conteudo

    if reenviar:
        resultado = await enviar_mensagem_whatsapp(
            mensagem.cliente.telefone, novo_conteudo
        )
        if resultado["status"] == "enviado" or resultado["status"] == "simulado":
            mensagem.status = "Enviado"
            mensagem.enviado_em = datetime.now(timezone.utc)
            mensagem.motivo_falha = None
        else:
            mensagem.status = "Falha"
            mensagem.motivo_falha = resultado.get("erro", "Erro desconhecido")

    await db.commit()

    result = await db.execute(
        select(Mensagem)
        .options(joinedload(Mensagem.cliente))
        .where(Mensagem.id == mensagem.id)
    )
    return result.unique().scalar_one()


async def excluir_mensagem(db: AsyncSession, mensagem_id: int) -> None:
    """Exclui uma mensagem permanentemente."""
    result = await db.execute(select(Mensagem).where(Mensagem.id == mensagem_id))
    mensagem = result.scalar_one_or_none()
    if not mensagem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mensagem não encontrada",
        )
    await db.delete(mensagem)
    await db.commit()


async def reenviar_mensagem(db: AsyncSession, mensagem_id: int) -> Mensagem:
    result = await db.execute(
        select(Mensagem)
        .options(joinedload(Mensagem.cliente))
        .where(Mensagem.id == mensagem_id)
    )
    mensagem = result.unique().scalar_one_or_none()
    if not mensagem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mensagem não encontrada",
        )

    if mensagem.status != "Falha":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas mensagens com status Falha podem ser reenviadas",
        )

    resultado = await enviar_mensagem_whatsapp(
        mensagem.cliente.telefone, mensagem.conteudo
    )

    if resultado["status"] == "enviado" or resultado["status"] == "simulado":
        mensagem.status = "Enviado"
        mensagem.enviado_em = datetime.now(timezone.utc)
        mensagem.motivo_falha = None

        # Para Certificado, reenviar também o PDF em anexo
        if mensagem.tipo == "Certificado" and mensagem.garantia_id:
            gar_result = await db.execute(
                select(Garantia)
                .options(joinedload(Garantia.cliente), joinedload(Garantia.operador))
                .where(Garantia.id == mensagem.garantia_id)
            )
            garantia = gar_result.unique().scalar_one_or_none()
            if garantia:
                await _enviar_pdf_certificado(garantia, garantia.cliente)
    else:
        mensagem.status = "Falha"
        mensagem.motivo_falha = resultado.get("erro", "Erro desconhecido")

    await db.commit()

    result = await db.execute(
        select(Mensagem)
        .options(joinedload(Mensagem.cliente))
        .where(Mensagem.id == mensagem.id)
    )
    return result.unique().scalar_one()
