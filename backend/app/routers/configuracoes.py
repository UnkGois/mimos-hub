from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.configuracao import ConfiguracaoResponse, ConfiguracaoUpdate
from app.services import configuracao_service

router = APIRouter()


@router.get("/", response_model=ConfiguracaoResponse)
async def obter_configuracoes(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await configuracao_service.obter_configuracoes(db)


@router.put("/", response_model=ConfiguracaoResponse)
async def salvar_configuracoes(
    dados: ConfiguracaoUpdate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await configuracao_service.salvar_configuracoes(db, dados.model_dump(exclude_unset=True))
