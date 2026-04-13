"""Lógica de negócio para Termos de Retirada."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from functools import partial
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.config import settings
from app.models.cliente import Cliente
from app.models.garantia import Garantia
from app.models.mensagem import Mensagem
from app.models.termo_retirada import TermoRetirada
from app.services.termo_pdf_service import (
    _build_endereco,
    _build_texto_terceiro,
    _build_texto_termo,
    gerar_termo_retirada_pdf,
)
from app.services.whatsapp_service import (
    enviar_documento_whatsapp,
    enviar_mensagem_whatsapp,
)

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────

def _mask_cpf(cpf: str) -> str:
    """Mascara CPF: 123.456.789-01 → ***.456.789-**"""
    d = (cpf or "").replace(".", "").replace("-", "").replace(" ", "")
    if len(d) == 11:
        return f"***.{d[3:6]}.{d[6:9]}-**"
    return "***.***.***-**"


async def _load_garantia_full(db: AsyncSession, garantia_id: int) -> Garantia:
    """Carrega garantia com cliente e operador."""
    result = await db.execute(
        select(Garantia)
        .options(
            joinedload(Garantia.cliente),
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


async def _load_termo(db: AsyncSession, termo_id: int) -> TermoRetirada:
    """Carrega termo com relacionamentos."""
    result = await db.execute(
        select(TermoRetirada)
        .options(
            joinedload(TermoRetirada.garantia).joinedload(Garantia.cliente),
            joinedload(TermoRetirada.operador),
        )
        .where(TermoRetirada.id == termo_id)
    )
    termo = result.unique().scalar_one_or_none()
    if not termo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Termo de retirada não encontrado",
        )
    return termo


def _gerar_pdf_bytes(termo: TermoRetirada) -> bytes:
    """Gera PDF do termo (sync, para rodar em to_thread)."""
    garantia = termo.garantia
    cliente = garantia.cliente
    operador = termo.operador

    return gerar_termo_retirada_pdf(
        certificado=garantia.certificado,
        cliente_nome=cliente.nome,
        cliente_cpf=cliente.cpf,
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
        data_compra=garantia.data_compra,
        local_retirada=termo.local_retirada or "",
        data_retirada=termo.data_retirada,
        operador_nome=operador.nome if operador else "",
        assinatura_cliente_b64=termo.assinatura_cliente,
        assinatura_operador_b64=termo.assinatura_operador,
        terceiro_nome=termo.terceiro_nome,
        terceiro_cpf=termo.terceiro_cpf,
        terceiro_rg=termo.terceiro_rg,
        terceiro_telefone=termo.terceiro_telefone,
        terceiro_relacao=termo.terceiro_relacao,
    )


# ────────────────────────────────────────────
# CRUD / Business Logic
# ────────────────────────────────────────────

async def criar_termo(
    db: AsyncSession,
    garantia_id: int,
    operador_id: int,
    tipo_fluxo: str = "presencial",
    local_retirada: str = "MDA - Mimos de Alice Joias - Loja Física",
    terceiro_nome: Optional[str] = None,
    terceiro_cpf: Optional[str] = None,
    terceiro_rg: Optional[str] = None,
    terceiro_telefone: Optional[str] = None,
    terceiro_relacao: Optional[str] = None,
) -> TermoRetirada:
    """Cria novo termo de retirada. Para WhatsApp, envia link ao cliente/terceiro."""
    garantia = await _load_garantia_full(db, garantia_id)
    cliente = garantia.cliente

    now = datetime.now(timezone.utc)

    termo = TermoRetirada(
        garantia_id=garantia_id,
        cliente_id=cliente.id,
        operador_id=operador_id,
        local_retirada=local_retirada,
        tipo_fluxo=tipo_fluxo,
        status="Pendente",
        data_retirada=now,
        terceiro_nome=terceiro_nome,
        terceiro_cpf=terceiro_cpf,
        terceiro_rg=terceiro_rg,
        terceiro_telefone=terceiro_telefone,
        terceiro_relacao=terceiro_relacao,
    )

    if tipo_fluxo == "whatsapp":
        termo.token_expira_em = now + timedelta(hours=24)

    db.add(termo)
    await db.commit()
    await db.refresh(termo)

    # Para WhatsApp, enviar link de assinatura
    if tipo_fluxo == "whatsapp":
        link = f"{settings.FRONTEND_URL}/assinar/{termo.token}"

        # Se é terceiro com telefone, envia para o terceiro
        if terceiro_nome and terceiro_telefone:
            telefone_destino = terceiro_telefone
            conteudo = (
                f"\u2728 Olá {terceiro_nome}! Tudo bem? \U0001f495\n\n"
                f"Você foi autorizado(a) por {cliente.nome} a retirar o "
                f"produto *{garantia.produto_nome}* na MDA - Mimos de Alice Joias! \U0001f381\n\n"
                f"Para concluir, precisamos da sua assinatura digital no "
                f"Termo de Retirada.\n\n"
                f"\U0001f449 Clique aqui para assinar:\n"
                f"{link}\n\n"
                f"\u23f0 Este link expira em 24 horas.\n\n"
                f"Com carinho,\n"
                f"MDA - Mimos de Alice Joias \U0001fa77"
            )
        else:
            telefone_destino = cliente.telefone
            conteudo = (
                f"\u2728 Oi {cliente.nome}! Tudo bem? \U0001f495\n\n"
                f"A MDA - Mimos de Alice preparou o Termo de Retirada "
                f"do seu produto *{garantia.produto_nome}*! \U0001f381\n\n"
                f"\U0001f4dd Para assinar digitalmente, acesse o link abaixo:\n"
                f"{link}\n\n"
                f"\u23f0 Este link expira em 24 horas.\n\n"
                f"Com carinho,\n"
                f"MDA - Mimos de Alice Joias \U0001fa77"
            )

        mensagem = Mensagem(
            garantia_id=garantia_id,
            cliente_id=cliente.id,
            tipo="Termo",
            conteudo=conteudo,
            status="Pendente",
        )
        db.add(mensagem)
        await db.flush()

        resultado = await enviar_mensagem_whatsapp(telefone_destino, conteudo)
        if resultado["status"] in ("enviado", "simulado"):
            mensagem.status = "Enviado"
            mensagem.enviado_em = datetime.now(timezone.utc)
        else:
            mensagem.status = "Falha"
            mensagem.motivo_falha = resultado.get("erro", "Erro desconhecido")

        await db.commit()

    # Recarregar com relacionamentos para evitar lazy-load em async
    return await _load_termo(db, termo.id)


async def criar_termo_presencial(
    db: AsyncSession,
    garantia_id: int,
    operador_id: int,
    assinatura_cliente: str,
    assinatura_operador: str,
    local_retirada: str = "MDA - Mimos de Alice Joias - Loja Física",
    tipo_fluxo: str = "presencial",
    terceiro_nome: Optional[str] = None,
    terceiro_cpf: Optional[str] = None,
    terceiro_rg: Optional[str] = None,
    terceiro_telefone: Optional[str] = None,
    terceiro_relacao: Optional[str] = None,
) -> TermoRetirada:
    """Cria termo presencial com ambas assinaturas de uma vez."""
    garantia = await _load_garantia_full(db, garantia_id)

    now = datetime.now(timezone.utc)

    termo = TermoRetirada(
        garantia_id=garantia_id,
        cliente_id=garantia.cliente.id,
        operador_id=operador_id,
        local_retirada=local_retirada,
        tipo_fluxo=tipo_fluxo,
        status="Concluido",
        data_retirada=now,
        assinatura_cliente=assinatura_cliente,
        assinatura_operador=assinatura_operador,
        terceiro_nome=terceiro_nome,
        terceiro_cpf=terceiro_cpf,
        terceiro_rg=terceiro_rg,
        terceiro_telefone=terceiro_telefone,
        terceiro_relacao=terceiro_relacao,
    )
    db.add(termo)
    await db.commit()
    await db.refresh(termo)

    # Recarregar com relacionamentos para evitar lazy-load em async
    termo = await _load_termo(db, termo.id)

    # Gerar PDF e enviar via WhatsApp automaticamente
    try:
        await gerar_e_enviar_pdf(db, termo)
        logger.info("Termo presencial %s: PDF gerado e WhatsApp enviado", termo.id)
    except Exception as e:
        logger.error("Termo presencial %s: falha ao enviar WhatsApp: %s", termo.id, e)

    return termo


async def obter_por_token(db: AsyncSession, token: str) -> TermoRetirada:
    """Busca termo pelo token público. Valida expiração."""
    result = await db.execute(
        select(TermoRetirada)
        .options(
            joinedload(TermoRetirada.garantia).joinedload(Garantia.cliente),
            joinedload(TermoRetirada.operador),
        )
        .where(TermoRetirada.token == token)
    )
    termo = result.unique().scalar_one_or_none()
    if not termo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Termo não encontrado",
        )

    # Verificar expiração
    now = datetime.now(timezone.utc)
    if termo.token_expira_em and now > termo.token_expira_em and termo.status == "Pendente":
        termo.status = "Expirado"
        await db.commit()

    return termo


async def assinar_cliente(
    db: AsyncSession,
    token: str,
    assinatura_b64: str,
) -> TermoRetirada:
    """Cliente assina via token público."""
    termo = await obter_por_token(db, token)

    if termo.status == "Expirado":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Link de assinatura expirado",
        )

    if termo.status != "Pendente":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este termo já foi assinado",
        )

    termo.assinatura_cliente = assinatura_b64
    termo.status = "AguardandoOperador"
    if not termo.data_retirada:
        termo.data_retirada = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(termo)
    return termo


async def assinar_operador(
    db: AsyncSession,
    termo_id: int,
    assinatura_b64: str,
) -> TermoRetirada:
    """Operador assina (autenticado). Gera PDF e envia WhatsApp."""
    termo = await _load_termo(db, termo_id)

    if termo.status not in ("AguardandoOperador", "Pendente"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Termo com status '{termo.status}' não pode ser assinado pelo operador",
        )

    termo.assinatura_operador = assinatura_b64
    termo.status = "Concluido"
    await db.commit()

    # Gerar e enviar PDF via WhatsApp
    await gerar_e_enviar_pdf(db, termo)

    return termo


async def gerar_e_enviar_pdf(
    db: AsyncSession,
    termo: TermoRetirada,
) -> bytes:
    """Gera PDF do termo com assinaturas e envia via WhatsApp."""
    # Recarregar com relacionamentos se necessário
    if not termo.garantia or not termo.garantia.cliente:
        termo = await _load_termo(db, termo.id)

    pdf_bytes = await asyncio.to_thread(partial(_gerar_pdf_bytes, termo))

    cliente = termo.garantia.cliente
    certificado = termo.garantia.certificado
    is_terceiro = bool(termo.terceiro_nome and termo.terceiro_cpf)

    # Enviar via WhatsApp
    filename = f"Termo_Retirada_{certificado}"
    caption = f"Termo de Retirada - {certificado} - MDA - Mimos de Alice"

    from app.services.pdf_service import _fmt_data, _fmt_hora
    now = termo.data_retirada or datetime.now(timezone.utc)

    if is_terceiro:
        # ── Mensagem para o CLIENTE (titular da compra) ──
        conteudo_cliente = (
            f"\u2705 Olá {cliente.nome}! Tudo bem? \U0001f495\n\n"
            f"Informamos que o seu produto *{termo.garantia.produto_nome}* "
            f"foi retirado com sucesso na MDA - Mimos de Alice Joias! \U0001f381\n\n"
            f"Retirado por: {termo.terceiro_nome}\n"
            f"Data: {_fmt_data(now)} às {_fmt_hora(now)}\n"
            f"Certificado: {certificado}\n\n"
            f"\U0001f4c4 O Termo de Retirada assinado segue em anexo.\n\n"
            f"Qualquer dúvida, estamos à disposição!\n\n"
            f"Com carinho,\n"
            f"MDA - Mimos de Alice Joias \U0001fa77\n"
            f"www.mimosdealicejoias.com.br"
        )

        mensagem_cliente = Mensagem(
            garantia_id=termo.garantia_id,
            cliente_id=termo.cliente_id,
            tipo="Termo",
            conteudo=conteudo_cliente,
            status="Pendente",
        )
        db.add(mensagem_cliente)
        await db.flush()

        resultado_texto = await enviar_mensagem_whatsapp(cliente.telefone, conteudo_cliente)
        resultado_pdf_cli = await enviar_documento_whatsapp(
            telefone=cliente.telefone,
            pdf_bytes=pdf_bytes,
            filename=filename,
            caption=caption,
        )

        if resultado_texto["status"] in ("enviado", "simulado"):
            mensagem_cliente.status = "Enviado"
            mensagem_cliente.enviado_em = datetime.now(timezone.utc)
        else:
            mensagem_cliente.status = "Falha"
            mensagem_cliente.motivo_falha = resultado_texto.get("erro", "Erro desconhecido")

        logger.info(
            "Termo %s PDF enviado ao cliente: texto=%s, doc=%s",
            termo.id, resultado_texto["status"], resultado_pdf_cli["status"],
        )

        # ── Mensagem para o TERCEIRO ──
        if termo.terceiro_telefone:
            conteudo_terceiro = (
                f"\u2705 Olá {termo.terceiro_nome}!\n\n"
                f"O Termo de Retirada foi concluído com sucesso! \U0001f4dd\n\n"
                f"Você retirou o produto *{termo.garantia.produto_nome}* "
                f"em nome de {cliente.nome}.\n\n"
                f"\U0001f4c4 Segue em anexo o documento assinado para seu controle.\n\n"
                f"Obrigada pela confiança!\n\n"
                f"MDA - Mimos de Alice Joias \U0001fa77\n"
                f"www.mimosdealicejoias.com.br"
            )

            res_terc_txt = await enviar_mensagem_whatsapp(
                termo.terceiro_telefone, conteudo_terceiro,
            )
            res_terc_pdf = await enviar_documento_whatsapp(
                telefone=termo.terceiro_telefone,
                pdf_bytes=pdf_bytes,
                filename=filename,
                caption=caption,
            )

            logger.info(
                "Termo %s PDF enviado ao terceiro: texto=%s, doc=%s",
                termo.id, res_terc_txt["status"], res_terc_pdf["status"],
            )
    else:
        # ── Mensagem padrão para o cliente (retirada normal) ──
        conteudo_msg = (
            f"\u2705 Olá {cliente.nome}! Seu Termo de Retirada foi concluído! \U0001f4c4\n\n"
            f"Segue em anexo o documento assinado.\n\n"
            f"Agradecemos pela preferência! Volte sempre! \U0001f48e\U0001fa77\n"
            f"MDA - Mimos de Alice Joias\n"
            f"www.mimosdealicejoias.com.br"
        )

        mensagem_cliente = Mensagem(
            garantia_id=termo.garantia_id,
            cliente_id=termo.cliente_id,
            tipo="Termo",
            conteudo=conteudo_msg,
            status="Pendente",
        )
        db.add(mensagem_cliente)
        await db.flush()

        resultado_texto = await enviar_mensagem_whatsapp(cliente.telefone, conteudo_msg)
        resultado_pdf = await enviar_documento_whatsapp(
            telefone=cliente.telefone,
            pdf_bytes=pdf_bytes,
            filename=filename,
            caption=caption,
        )

        if resultado_texto["status"] in ("enviado", "simulado"):
            mensagem_cliente.status = "Enviado"
            mensagem_cliente.enviado_em = datetime.now(timezone.utc)
        else:
            mensagem_cliente.status = "Falha"
            mensagem_cliente.motivo_falha = resultado_texto.get("erro", "Erro desconhecido")

        logger.info(
            "Termo %s PDF enviado: texto=%s, doc=%s",
            termo.id, resultado_texto["status"], resultado_pdf["status"],
        )

    termo.pdf_enviado = True
    await db.commit()

    return pdf_bytes


async def download_pdf(db: AsyncSession, termo_id: int) -> bytes:
    """Gera PDF do termo sob demanda."""
    termo = await _load_termo(db, termo_id)
    return await asyncio.to_thread(partial(_gerar_pdf_bytes, termo))


async def listar_por_garantia(
    db: AsyncSession,
    garantia_id: int,
) -> tuple[list[TermoRetirada], int]:
    """Lista termos de uma garantia."""
    query = (
        select(TermoRetirada)
        .options(
            joinedload(TermoRetirada.garantia).joinedload(Garantia.cliente),
            joinedload(TermoRetirada.operador),
        )
        .where(TermoRetirada.garantia_id == garantia_id)
        .order_by(TermoRetirada.criado_em.desc())
    )
    count_query = select(func.count(TermoRetirada.id)).where(
        TermoRetirada.garantia_id == garantia_id
    )

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query)
    return result.unique().scalars().all(), total


async def listar_todos(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    nome: Optional[str] = None,
    status_filtro: Optional[str] = None,
) -> tuple[list[TermoRetirada], int]:
    """Lista todos os termos com filtros opcionais."""
    base_query = (
        select(TermoRetirada)
        .options(
            joinedload(TermoRetirada.garantia).joinedload(Garantia.cliente),
            joinedload(TermoRetirada.operador),
        )
    )
    count_base = select(func.count(TermoRetirada.id))

    # Filtros
    if status_filtro:
        base_query = base_query.where(TermoRetirada.status == status_filtro)
        count_base = count_base.where(TermoRetirada.status == status_filtro)

    if nome:
        base_query = base_query.join(TermoRetirada.garantia).join(Garantia.cliente).where(
            or_(
                Cliente.nome.ilike(f"%{nome}%"),
                TermoRetirada.terceiro_nome.ilike(f"%{nome}%"),
            )
        )
        count_base = count_base.join(TermoRetirada.garantia).join(Garantia.cliente).where(
            or_(
                Cliente.nome.ilike(f"%{nome}%"),
                TermoRetirada.terceiro_nome.ilike(f"%{nome}%"),
            )
        )

    query = base_query.order_by(TermoRetirada.criado_em.desc()).offset(skip).limit(limit)

    total = (await db.execute(count_base)).scalar() or 0
    result = await db.execute(query)
    return result.unique().scalars().all(), total


async def obter_metricas(db: AsyncSession) -> dict:
    """Retorna métricas dos termos."""
    total_q = select(func.count(TermoRetirada.id))
    concluidos_q = select(func.count(TermoRetirada.id)).where(
        TermoRetirada.status == "Concluido"
    )
    aguardando_q = select(func.count(TermoRetirada.id)).where(
        TermoRetirada.status.in_(["Pendente", "AguardandoOperador"])
    )

    total = (await db.execute(total_q)).scalar() or 0
    concluidos = (await db.execute(concluidos_q)).scalar() or 0
    aguardando = (await db.execute(aguardando_q)).scalar() or 0

    return {"total": total, "concluidos": concluidos, "aguardando": aguardando}


async def excluir_termo(db: AsyncSession, termo_id: int) -> None:
    """Exclui um termo de retirada."""
    termo = await _load_termo(db, termo_id)
    await db.delete(termo)
    await db.commit()


def build_publico_response(termo: TermoRetirada) -> dict:
    """Monta resposta pública a partir de um termo carregado."""
    garantia = termo.garantia
    cliente = garantia.cliente
    now = datetime.now(timezone.utc)

    endereco_completo = _build_endereco(
        cliente.endereco or "",
        cliente.numero or "",
        cliente.bairro or "",
        cliente.cidade or "",
        cliente.uf or "",
        cliente.cep or "",
    )

    expirado = False
    if termo.token_expira_em and now > termo.token_expira_em and termo.status == "Pendente":
        expirado = True

    from app.services.pdf_service import _fmt_cpf, _fmt_tel, _fmt_valor

    is_terceiro = bool(termo.terceiro_nome and termo.terceiro_cpf)

    if is_terceiro:
        texto_termo = _build_texto_terceiro(
            cliente.nome,
            cliente.cpf,
            cliente.telefone or "",
            termo.terceiro_nome,
            termo.terceiro_cpf,
            termo.terceiro_rg or "",
            termo.terceiro_telefone or "",
            termo.terceiro_relacao or "",
        )
    else:
        texto_termo = _build_texto_termo(
            cliente.nome, cliente.cpf, endereco_completo, cliente.telefone or "",
        )

    return {
        "token": termo.token,
        "status": termo.status,
        "tipo_fluxo": termo.tipo_fluxo,
        "local_retirada": termo.local_retirada or "",
        "data_retirada": termo.data_retirada,
        "cliente_nome": cliente.nome,
        "cliente_cpf_masked": _mask_cpf(cliente.cpf),
        "cliente_endereco_completo": endereco_completo,
        "produto_nome": garantia.produto_nome,
        "produto_categoria": garantia.produto_categoria,
        "produto_valor": _fmt_valor(garantia.produto_valor),
        "certificado": garantia.certificado,
        "data_compra": garantia.data_compra,
        "assinatura_cliente_presente": bool(termo.assinatura_cliente),
        "assinatura_operador_presente": bool(termo.assinatura_operador),
        "expirado": expirado,
        "texto_termo": texto_termo,
        "terceiro_nome": termo.terceiro_nome,
        "terceiro_cpf": _fmt_cpf(termo.terceiro_cpf) if termo.terceiro_cpf else None,
        "terceiro_rg": termo.terceiro_rg,
        "terceiro_telefone": _fmt_tel(termo.terceiro_telefone) if termo.terceiro_telefone else None,
        "terceiro_relacao": termo.terceiro_relacao,
        "is_terceiro": is_terceiro,
    }
