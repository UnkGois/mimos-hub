from __future__ import annotations

import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

MAX_SIZE = 800
QUALITY = 85

UPLOAD_DIR = Path("/app/uploads/produtos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.produto import (
    EstoqueEstatisticas,
    MargemCanal,
    ProdutoCreate,
    ProdutoListResponse,
    ProdutoResponse,
    ProdutoUpdate,
)
from app.services import produto_service

router = APIRouter()


@router.get("/", response_model=ProdutoListResponse)
async def listar_produtos(
    busca: str | None = Query(None),
    categoria: str | None = Query(None),
    status_estoque: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await produto_service.listar_produtos(db, busca, categoria, status_estoque, skip, limit)
    return ProdutoListResponse(
        items=[ProdutoResponse.model_validate(p) for p in items],
        total=total,
    )


@router.post("/", response_model=ProdutoResponse, status_code=status.HTTP_201_CREATED)
async def criar_produto(
    dados: ProdutoCreate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    produto = await produto_service.criar_produto(db, dados)
    return ProdutoResponse.model_validate(produto)


@router.get("/stats", response_model=EstoqueEstatisticas)
async def estatisticas(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await produto_service.obter_estatisticas(db)


@router.get("/margens", response_model=list[MargemCanal])
async def margens_por_canal(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await produto_service.obter_margem_por_canal(db)


@router.get("/alertas", response_model=list[ProdutoResponse])
async def alertas_estoque(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    produtos = await produto_service.obter_produtos_baixo_estoque(db)
    return [ProdutoResponse.model_validate(p) for p in produtos]


@router.get("/{produto_id}", response_model=ProdutoResponse)
async def obter_produto(
    produto_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    produto = await produto_service.obter_produto(db, produto_id)
    return ProdutoResponse.model_validate(produto)


@router.put("/{produto_id}", response_model=ProdutoResponse)
async def atualizar_produto(
    produto_id: int,
    dados: ProdutoUpdate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    produto = await produto_service.atualizar_produto(db, produto_id, dados)
    return ProdutoResponse.model_validate(produto)


@router.post("/{produto_id}/imagem", response_model=ProdutoResponse)
async def upload_imagem(
    produto_id: int,
    file: UploadFile,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Formato inválido. Use JPG, PNG ou WebP.")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagem muito grande. Máximo 5MB.")

    img = Image.open(io.BytesIO(content))
    if img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.convert("RGBA").split()[3])
        img = bg
    else:
        img = img.convert("RGB")
    img.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)

    filename = f"{produto_id}_{uuid.uuid4().hex[:8]}.webp"
    filepath = UPLOAD_DIR / filename

    img.save(filepath, format="WEBP", quality=QUALITY, optimize=True)

    imagem_url = f"/api/produtos/uploads/{filename}"
    produto = await produto_service.atualizar_produto(
        db, produto_id, ProdutoUpdate(imagem_url=imagem_url)
    )
    return ProdutoResponse.model_validate(produto)


@router.get("/uploads/{filename}")
async def servir_imagem(filename: str):
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    return FileResponse(filepath)


@router.delete("/{produto_id}")
async def excluir_produto(
    produto_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await produto_service.excluir_produto(db, produto_id)
