from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.dashboard import (
    MetricasResponse,
    RecentesResponse,
    VencimentoItem,
    VencimentosResponse,
)
from app.services import dashboard_service

router = APIRouter()


@router.get("/metricas", response_model=MetricasResponse)
async def metricas(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await dashboard_service.obter_metricas(db)


@router.get("/recentes", response_model=RecentesResponse)
async def recentes(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await dashboard_service.obter_recentes(db)


@router.get("/vencimentos", response_model=VencimentosResponse)
async def vencimentos(
    dias: int = Query(30, ge=1, le=365),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await dashboard_service.obter_vencimentos(db, dias)
    return VencimentosResponse(
        items=[VencimentoItem(**v) for v in items],
        total=len(items),
    )
