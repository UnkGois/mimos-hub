from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.mensagem import (
    ClienteResumo,
    MensagemEnviar,
    MensagemListResponse,
    MensagemResponse,
    MensagemUpdate,
)
from app.services import mensagem_service

router = APIRouter()


def _build_response(msg) -> MensagemResponse:
    resp = MensagemResponse.model_validate(msg)
    if msg.cliente:
        resp.cliente = ClienteResumo.model_validate(msg.cliente)
    return resp


@router.get("/", response_model=MensagemListResponse)
async def listar_mensagens(
    nome: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    status_filtro: Optional[str] = Query(None, alias="status"),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await mensagem_service.listar_mensagens(
        db, nome, tipo, status_filtro, data_inicio, data_fim, skip, limit
    )
    return MensagemListResponse(
        items=[_build_response(m) for m in items],
        total=total,
    )


@router.post("/enviar", response_model=MensagemResponse)
async def enviar_mensagem(
    dados: MensagemEnviar,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await mensagem_service.enviar_mensagem(db, dados.garantia_id, dados.tipo)


@router.put("/{mensagem_id}", response_model=MensagemResponse)
async def editar_mensagem(
    mensagem_id: int,
    dados: MensagemUpdate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = await mensagem_service.editar_mensagem(
        db, mensagem_id, dados.conteudo, dados.reenviar
    )
    return _build_response(msg)


@router.delete("/{mensagem_id}", status_code=204)
async def excluir_mensagem(
    mensagem_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await mensagem_service.excluir_mensagem(db, mensagem_id)


@router.post("/{mensagem_id}/reenviar", response_model=MensagemResponse)
async def reenviar_mensagem(
    mensagem_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await mensagem_service.reenviar_mensagem(db, mensagem_id)
