from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.cupom import (
    CupomCreate,
    CupomListResponse,
    CupomManualCreate,
    CupomResponse,
    CupomStatusUpdate,
    CupomValidacaoResponse,
)
from app.services import cliente_service, cupom_service, mensagem_service

router = APIRouter()


def _compute_status(c) -> str:
    if getattr(c, "desativado", False):
        return "Desativado"
    if c.usado:
        return "Usado"
    if c.validade < date.today():
        return "Expirado"
    return "Ativo"


def _build_cupom_response(c) -> CupomResponse:
    resp = CupomResponse.model_validate(c)
    resp.status = _compute_status(c)
    if hasattr(c, "cliente") and c.cliente:
        resp.cliente_nome = c.cliente.nome
    return resp


@router.get("/", response_model=CupomListResponse)
async def listar_cupons(
    cliente_id: int | None = Query(None),
    usado: bool | None = Query(None),
    codigo: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await cupom_service.listar_cupons(
        db, cliente_id, usado, codigo, skip, limit
    )
    return CupomListResponse(
        items=[_build_cupom_response(c) for c in items],
        total=total,
    )


@router.post("/", response_model=CupomResponse, status_code=status.HTTP_201_CREATED)
async def criar_cupom_manual(
    dados: CupomManualCreate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cliente = await cliente_service.obter_cliente(db, dados.cliente_id)
    cliente_nome = cliente.nome
    cupom = await cupom_service.gerar_cupom_manual(
        db, dados.cliente_id, dados.tipo_desconto, dados.valor, dados.motivo,
        dados.validade_dias,
    )

    # Enviar cupom via WhatsApp
    await mensagem_service.enviar_cupom_whatsapp(
        db, dados.cliente_id, cupom.codigo, float(cupom.percentual),
        validade=cupom.validade,
        tipo_desconto=dados.tipo_desconto,
        valor_desconto=float(cupom.valor_desconto) if cupom.valor_desconto else None,
    )

    resp = CupomResponse.model_validate(cupom)
    resp.cliente_nome = cliente_nome
    resp.status = "Ativo"
    return resp


@router.post("/gerar", response_model=CupomResponse, status_code=status.HTTP_201_CREATED)
async def gerar_cupom_automatico(
    dados: CupomCreate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cliente = await cliente_service.obter_cliente(db, dados.cliente_id)
    cupom = await cupom_service.gerar_cupom_desconto(
        db, cliente.id, cliente.total_compras, dados.garantia_id
    )
    if not cupom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cliente não tem direito a cupom (precisa de pelo menos 2 compras)",
        )
    await db.commit()
    await db.refresh(cupom)

    # Enviar cupom via WhatsApp
    await mensagem_service.enviar_cupom_whatsapp(
        db, cliente.id, cupom.codigo, float(cupom.percentual), dados.garantia_id
    )

    resp = CupomResponse.model_validate(cupom)
    resp.status = "Ativo"
    return resp


@router.get("/validar/{codigo}", response_model=CupomValidacaoResponse)
async def validar_cupom(
    codigo: str,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resultado = await cupom_service.validar_cupom(db, codigo)
    return CupomValidacaoResponse(
        valido=resultado["valido"],
        motivo=resultado["motivo"],
        cupom=CupomResponse.model_validate(resultado["cupom"]),
    )


@router.put("/{cupom_id}/status", response_model=CupomResponse)
async def atualizar_status_cupom(
    cupom_id: int,
    dados: CupomStatusUpdate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cupom = await cupom_service.atualizar_status_cupom(db, cupom_id, dados.status)
    return _build_cupom_response(cupom)


@router.delete("/{cupom_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_cupom(
    cupom_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await cupom_service.excluir_cupom(db, cupom_id)


@router.put("/{cupom_id}/usar", response_model=CupomResponse)
async def usar_cupom(
    cupom_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cupom = await cupom_service.usar_cupom(db, cupom_id)
    return _build_cupom_response(cupom)
