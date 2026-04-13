from __future__ import annotations

import io
import re
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.cliente import ClienteResponse
from app.schemas.garantia import (
    CupomInfo,
    EstatisticasResponse,
    GarantiaCreate,
    GarantiaInfo,
    GarantiaListResponse,
    GarantiaResponse,
    GarantiaStatusUpdate,
    ProdutoInfo,
)
from app.services import garantia_service
from app.services.pdf_service import gerar_certificado_pdf

router = APIRouter()


def _build_response(garantia, cliente, cupom=None) -> GarantiaResponse:
    return GarantiaResponse(
        id=garantia.id,
        certificado=garantia.certificado,
        status=garantia.status,
        criado_em=garantia.criado_em,
        cliente=ClienteResponse.model_validate(cliente),
        produto=ProdutoInfo(
            nome=garantia.produto_nome,
            serie=garantia.produto_serie,
            categoria=garantia.produto_categoria,
            valor=garantia.produto_valor,
            loja=garantia.loja,
            data_compra=garantia.data_compra,
        ),
        garantia=GarantiaInfo(
            tipo=garantia.tipo_garantia,
            periodo=garantia.periodo_meses,
            inicio=garantia.data_inicio,
            termino=garantia.data_termino,
        ),
        cupom=CupomInfo(
            codigo=cupom.codigo,
            percentual=cupom.percentual,
        ) if cupom else None,
    )


@router.get("/", response_model=GarantiaListResponse)
async def listar_garantias(
    nome: str | None = Query(None),
    cpf: str | None = Query(None),
    certificado: str | None = Query(None),
    status_filtro: str | None = Query(None, alias="status"),
    data_inicio: date | None = Query(None),
    data_fim: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await garantia_service.listar_garantias(
        db, nome, cpf, certificado, status_filtro, data_inicio, data_fim, skip, limit
    )
    return GarantiaListResponse(
        items=[_build_response(g, g.cliente) for g in items],
        total=total,
    )


@router.post("/", response_model=GarantiaResponse, status_code=status.HTTP_201_CREATED)
async def criar_garantia(
    dados: GarantiaCreate,
    user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resultado = await garantia_service.criar_garantia(db, dados, user.id)
    return _build_response(
        resultado["garantia"],
        resultado["cliente"],
        resultado["cupom"],
    )


@router.get("/stats", response_model=EstatisticasResponse)
async def estatisticas(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await garantia_service.obter_estatisticas(db)


@router.get("/{garantia_id}", response_model=GarantiaResponse)
async def obter_garantia(
    garantia_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    garantia = await garantia_service.obter_garantia(db, garantia_id)
    cupom = garantia.cupons[0] if garantia.cupons else None
    return _build_response(garantia, garantia.cliente, cupom)


@router.get("/{garantia_id}/pdf")
async def download_pdf(
    garantia_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    garantia = await garantia_service.obter_garantia(db, garantia_id)
    cliente = garantia.cliente
    operador = garantia.operador

    pdf_bytes = gerar_certificado_pdf(
        certificado=garantia.certificado,
        # Cliente
        cliente_nome=cliente.nome,
        cliente_cpf=cliente.cpf,
        cliente_nascimento=cliente.data_nascimento,
        cliente_telefone=cliente.telefone,
        cliente_email=cliente.email,
        cliente_endereco=cliente.endereco,
        cliente_numero=cliente.numero,
        cliente_bairro=cliente.bairro,
        cliente_cidade=cliente.cidade,
        cliente_uf=cliente.uf,
        cliente_cep=cliente.cep,
        # Produto
        produto_nome=garantia.produto_nome,
        produto_categoria=garantia.produto_categoria,
        produto_serie=garantia.produto_serie,
        produto_valor=garantia.produto_valor,
        produto_loja=garantia.loja,
        data_compra=garantia.data_compra,
        # Garantia
        tipo_garantia=garantia.tipo_garantia,
        periodo_meses=garantia.periodo_meses,
        data_inicio=garantia.data_inicio,
        data_termino=garantia.data_termino,
        # Meta
        operador_nome=operador.nome if operador else "",
        data_emissao=garantia.criado_em,
    )

    safe_filename = re.sub(r"[^a-zA-Z0-9_\-]", "_", garantia.certificado)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}.pdf"'
        },
    )


@router.delete("/{garantia_id}")
async def excluir_garantia(
    garantia_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await garantia_service.excluir_garantia(db, garantia_id)


@router.put("/{garantia_id}/status", response_model=GarantiaResponse)
async def atualizar_status(
    garantia_id: int,
    dados: GarantiaStatusUpdate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    garantia = await garantia_service.atualizar_status(db, garantia_id, dados.status)
    cupom = garantia.cupons[0] if garantia.cupons else None
    return _build_response(garantia, garantia.cliente, cupom)
