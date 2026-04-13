from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.venda import (
    VendaCreate,
    VendaEstatisticas,
    VendaItemGarantiaLink,
    VendaItemResponse,
    VendaListResponse,
    VendaResponse,
)
from app.services import venda_service

router = APIRouter()


@router.post("/", response_model=VendaResponse, status_code=status.HTTP_201_CREATED)
async def criar_venda(
    dados: VendaCreate,
    user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    venda = await venda_service.criar_venda(db, dados, user.id)
    return _to_response(venda)


@router.get("/", response_model=VendaListResponse)
async def listar_vendas(
    busca: str | None = Query(None),
    data_inicio: str | None = Query(None),
    data_fim: str | None = Query(None),
    status_venda: str | None = Query(None, alias="status"),
    forma_pagamento: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await venda_service.listar_vendas(
        db, busca, data_inicio, data_fim, status_venda, forma_pagamento, skip, limit
    )
    return VendaListResponse(
        items=[_to_response(v) for v in items],
        total=total,
    )


@router.get("/stats", response_model=VendaEstatisticas)
async def estatisticas(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await venda_service.obter_estatisticas(db)


@router.get("/{venda_id}", response_model=VendaResponse)
async def obter_venda(
    venda_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    venda = await venda_service.obter_venda(db, venda_id)
    return _to_response(venda)


@router.put("/{venda_id}/cancelar", response_model=VendaResponse)
async def cancelar_venda(
    venda_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    venda = await venda_service.cancelar_venda(db, venda_id)
    return _to_response(venda)


@router.put("/{venda_id}/itens/{item_id}/garantia", response_model=VendaItemResponse)
async def vincular_garantia(
    venda_id: int,
    item_id: int,
    dados: VendaItemGarantiaLink,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await venda_service.vincular_garantia_item(db, venda_id, item_id, dados.garantia_id)
    return VendaItemResponse.model_validate(item)


def _to_response(venda) -> VendaResponse:
    return VendaResponse(
        id=venda.id,
        codigo=venda.codigo,
        cliente_id=venda.cliente_id,
        cliente_nome=venda.cliente.nome if venda.cliente else None,
        operador_id=venda.operador_id,
        operador_nome=venda.operador.nome if venda.operador else None,
        cupom_id=venda.cupom_id,
        cupom_codigo=venda.cupom.codigo if venda.cupom else None,
        subtotal=venda.subtotal,
        desconto_cupom=venda.desconto_cupom,
        desconto_manual=venda.desconto_manual,
        desconto_manual_motivo=venda.desconto_manual_motivo,
        total=venda.total,
        forma_pagamento=venda.forma_pagamento,
        valor_recebido=venda.valor_recebido,
        troco=venda.troco,
        status=venda.status,
        observacao=venda.observacao,
        criado_em=venda.criado_em,
        itens=[VendaItemResponse.model_validate(i) for i in venda.itens],
    )
