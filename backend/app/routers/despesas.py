from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.despesa import (
    BreakEvenRequest,
    BreakEvenResponse,
    DespesaFixaCreate,
    DespesaFixaResponse,
    DespesaFixaUpdate,
    DespesaVariavelCreate,
    DespesaVariavelResponse,
    DespesaVariavelUpdate,
)
from app.services import despesa_service

router = APIRouter()


# ─── Despesas Fixas ───


@router.get("/fixas", response_model=list[DespesaFixaResponse])
async def listar_fixas(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await despesa_service.listar_fixas(db)


@router.post("/fixas", response_model=DespesaFixaResponse)
async def criar_fixa(
    dados: DespesaFixaCreate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await despesa_service.criar_fixa(db, dados.nome, dados.valor)


@router.put("/fixas/{despesa_id}", response_model=DespesaFixaResponse)
async def atualizar_fixa(
    despesa_id: int,
    dados: DespesaFixaUpdate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await despesa_service.atualizar_fixa(db, despesa_id, dados.nome, dados.valor)


@router.delete("/fixas/{despesa_id}")
async def excluir_fixa(
    despesa_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await despesa_service.excluir_fixa(db, despesa_id)


@router.put("/fixas")
async def salvar_fixas_batch(
    despesas: list[DespesaFixaCreate],
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await despesa_service.salvar_fixas_batch(db, [d.model_dump() for d in despesas])
    return [DespesaFixaResponse.model_validate(d) for d in result]


# ─── Despesas Variáveis ───


@router.get("/variaveis", response_model=list[DespesaVariavelResponse])
async def listar_variaveis(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await despesa_service.listar_variaveis(db)


@router.post("/variaveis", response_model=DespesaVariavelResponse)
async def criar_variavel(
    dados: DespesaVariavelCreate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await despesa_service.criar_variavel(db, dados.nome, dados.tipo, dados.valor)


@router.put("/variaveis/{despesa_id}", response_model=DespesaVariavelResponse)
async def atualizar_variavel(
    despesa_id: int,
    dados: DespesaVariavelUpdate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await despesa_service.atualizar_variavel(db, despesa_id, dados.nome, dados.tipo, dados.valor)


@router.delete("/variaveis/{despesa_id}")
async def excluir_variavel(
    despesa_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await despesa_service.excluir_variavel(db, despesa_id)


@router.put("/variaveis")
async def salvar_variaveis_batch(
    despesas: list[DespesaVariavelCreate],
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await despesa_service.salvar_variaveis_batch(db, [d.model_dump() for d in despesas])
    return [DespesaVariavelResponse.model_validate(d) for d in result]


# ─── Break-Even ───


@router.post("/break-even", response_model=BreakEvenResponse)
async def calcular_break_even(
    params: BreakEvenRequest,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await despesa_service.calcular_break_even(
        db, params.ticket_medio, params.margem_contribuicao, params.dias_funcionamento
    )
