from __future__ import annotations

import io
import re

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.termo_retirada import (
    AssinaturaSubmit,
    TermoListResponse,
    TermoMetricsResponse,
    TermoPresencialCreate,
    TermoPublicoResponse,
    TermoRetiradaCreate,
    TermoRetiradaResponse,
)
from app.services import termo_service

router = APIRouter()


# ────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────

def _build_response(termo) -> TermoRetiradaResponse:
    """Constroi resposta a partir do model ORM."""
    cliente_nome = None
    certificado = None
    produto_nome = None
    if termo.garantia:
        certificado = termo.garantia.certificado
        produto_nome = termo.garantia.produto_nome
        if termo.garantia.cliente:
            cliente_nome = termo.garantia.cliente.nome

    return TermoRetiradaResponse(
        id=termo.id,
        token=termo.token,
        garantia_id=termo.garantia_id,
        cliente_id=termo.cliente_id,
        operador_id=termo.operador_id,
        local_retirada=termo.local_retirada or "",
        data_retirada=termo.data_retirada,
        status=termo.status,
        tipo_fluxo=termo.tipo_fluxo,
        assinatura_cliente=None,  # Nunca retornar base64 na listagem
        assinatura_operador=None,
        pdf_enviado=termo.pdf_enviado,
        token_expira_em=termo.token_expira_em,
        criado_em=termo.criado_em,
        cliente_nome=cliente_nome,
        certificado=certificado,
        produto_nome=produto_nome,
        terceiro_nome=termo.terceiro_nome,
        terceiro_cpf=termo.terceiro_cpf,
        terceiro_rg=termo.terceiro_rg,
        terceiro_telefone=termo.terceiro_telefone,
        terceiro_relacao=termo.terceiro_relacao,
    )


# ────────────────────────────────────────────
# Endpoints Autenticados
# ────────────────────────────────────────────

@router.post("/", response_model=TermoRetiradaResponse, status_code=status.HTTP_201_CREATED)
async def criar_termo(
    dados: TermoRetiradaCreate,
    user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cria novo termo de retirada (presencial, whatsapp ou terceiro)."""
    termo = await termo_service.criar_termo(
        db,
        garantia_id=dados.garantia_id,
        operador_id=user.id,
        tipo_fluxo=dados.tipo_fluxo,
        local_retirada=dados.local_retirada,
        terceiro_nome=dados.terceiro_nome,
        terceiro_cpf=dados.terceiro_cpf,
        terceiro_rg=dados.terceiro_rg,
        terceiro_telefone=dados.terceiro_telefone,
        terceiro_relacao=dados.terceiro_relacao,
    )
    return _build_response(termo)


@router.post(
    "/presencial",
    response_model=TermoRetiradaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_termo_presencial(
    dados: TermoPresencialCreate,
    user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cria termo presencial com ambas assinaturas de uma vez."""
    termo = await termo_service.criar_termo_presencial(
        db,
        garantia_id=dados.garantia_id,
        operador_id=user.id,
        assinatura_cliente=dados.assinatura_cliente,
        assinatura_operador=dados.assinatura_operador,
        local_retirada=dados.local_retirada,
        tipo_fluxo=dados.tipo_fluxo,
        terceiro_nome=dados.terceiro_nome,
        terceiro_cpf=dados.terceiro_cpf,
        terceiro_rg=dados.terceiro_rg,
        terceiro_telefone=dados.terceiro_telefone,
        terceiro_relacao=dados.terceiro_relacao,
    )
    return _build_response(termo)


@router.get("/todos", response_model=TermoListResponse)
async def listar_todos(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    nome: str | None = None,
    status_filtro: str | None = Query(None, alias="status"),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista todos os termos de retirada com filtros."""
    items, total = await termo_service.listar_todos(
        db, skip=skip, limit=limit, nome=nome, status_filtro=status_filtro,
    )
    return TermoListResponse(
        items=[_build_response(t) for t in items],
        total=total,
    )


@router.get("/metricas", response_model=TermoMetricsResponse)
async def obter_metricas(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna métricas dos termos de retirada."""
    return await termo_service.obter_metricas(db)


@router.get("/garantia/{garantia_id}", response_model=TermoListResponse)
async def listar_termos(
    garantia_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista termos de retirada de uma garantia."""
    items, total = await termo_service.listar_por_garantia(db, garantia_id)
    return TermoListResponse(
        items=[_build_response(t) for t in items],
        total=total,
    )


@router.post("/{termo_id}/assinar-operador", response_model=TermoRetiradaResponse)
async def assinar_operador(
    termo_id: int,
    dados: AssinaturaSubmit,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Operador assina o termo. Gera PDF e envia via WhatsApp."""
    termo = await termo_service.assinar_operador(db, termo_id, dados.assinatura)
    return _build_response(termo)


@router.get("/{termo_id}/pdf")
async def download_pdf(
    termo_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download do PDF do termo de retirada."""
    pdf_bytes = await termo_service.download_pdf(db, termo_id)
    termo = await termo_service._load_termo(db, termo_id)
    cert = termo.garantia.certificado if termo.garantia else str(termo_id)
    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", cert)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Termo_Retirada_{safe_name}.pdf"'
        },
    )


@router.post("/{termo_id}/enviar-whatsapp", response_model=TermoRetiradaResponse)
async def enviar_whatsapp(
    termo_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Envia PDF do termo concluído via WhatsApp."""
    termo = await termo_service._load_termo(db, termo_id)
    if termo.status != "Concluido":
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Termo precisa estar concluído para enviar via WhatsApp",
        )
    await termo_service.gerar_e_enviar_pdf(db, termo)
    return _build_response(termo)


@router.delete("/{termo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_termo(
    termo_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Exclui um termo de retirada."""
    await termo_service.excluir_termo(db, termo_id)


# ────────────────────────────────────────────
# Endpoints Públicos (SEM autenticação)
# ────────────────────────────────────────────

@router.get("/publico/{token}", response_model=TermoPublicoResponse)
async def obter_termo_publico(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Retorna dados do termo para a página pública de assinatura."""
    termo = await termo_service.obter_por_token(db, token)
    return termo_service.build_publico_response(termo)


@router.post("/publico/{token}/assinar")
async def assinar_cliente_publico(
    token: str,
    dados: AssinaturaSubmit,
    db: AsyncSession = Depends(get_db),
):
    """Cliente assina o termo via link público."""
    await termo_service.assinar_cliente(db, token, dados.assinatura)
    return {"status": "ok", "mensagem": "Assinatura registrada com sucesso"}
