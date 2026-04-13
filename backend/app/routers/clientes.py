from __future__ import annotations

import random
import string  # noqa: used by random.choices(string.digits)

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.schemas.cliente import (
    ClienteCreate,
    ClienteListResponse,
    ClienteResponse,
    ClienteUpdate,
)
from app.services import cliente_service
from app.services.whatsapp_service import enviar_mensagem_whatsapp

# Cache simples de códigos de verificação {telefone: codigo}
_codigos_verificacao: dict[str, str] = {}


class VerificarTelefoneRequest(BaseModel):
    telefone: str


class ConfirmarCodigoRequest(BaseModel):
    telefone: str
    codigo: str
    cliente_id: int | None = None


def _limpar_telefone(tel: str) -> str:
    return "".join(c for c in tel if c.isdigit())

router = APIRouter()


@router.get("/", response_model=ClienteListResponse)
async def listar_clientes(
    nome: str | None = Query(None),
    cpf: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await cliente_service.listar_clientes(db, nome, cpf, skip, limit)
    return ClienteListResponse(
        items=[ClienteResponse.model_validate(c) for c in items],
        total=total,
    )


@router.post("/", response_model=ClienteResponse, status_code=201)
async def criar_cliente(
    dados: ClienteCreate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await cliente_service.criar_cliente(db, dados)


@router.get("/cpf/{cpf}", response_model=ClienteResponse)
async def buscar_por_cpf(
    cpf: str,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cliente = await cliente_service.buscar_cliente_por_cpf(db, cpf)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return cliente


@router.get("/{cliente_id}", response_model=ClienteResponse)
async def obter_cliente(
    cliente_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await cliente_service.obter_cliente(db, cliente_id)


@router.put("/{cliente_id}", response_model=ClienteResponse)
async def atualizar_cliente(
    cliente_id: int,
    dados: ClienteUpdate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await cliente_service.atualizar_cliente(db, cliente_id, dados)


@router.get("/{cliente_id}/historico")
async def historico_cliente(
    cliente_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.reserva import Reserva
    from app.models.venda import Venda, VendaItem
    from sqlalchemy import select as sa_select, func

    historico = []

    # Reservas (Live Shop)
    result = await db.execute(
        sa_select(Reserva).where(Reserva.cliente_id == cliente_id).order_by(Reserva.criado_em.desc()).limit(50)
    )
    for r in result.scalars().all():
        historico.append({
            "tipo": "live_shop",
            "codigo": r.codigo,
            "produto": r.produto_nome,
            "valor": float(r.produto_preco * r.quantidade),
            "quantidade": r.quantidade,
            "status": r.status,
            "data": r.criado_em.isoformat() if r.criado_em else None,
        })

    # Vendas (PDV)
    from sqlalchemy.orm import joinedload
    result = await db.execute(
        sa_select(Venda)
        .options(joinedload(Venda.itens))
        .where(Venda.cliente_id == cliente_id)
        .order_by(Venda.criado_em.desc())
        .limit(50)
    )
    for v in result.unique().scalars().all():
        historico.append({
            "tipo": "pdv",
            "codigo": v.codigo,
            "produto": f"{len(v.itens)} itens",
            "valor": float(v.total),
            "quantidade": 1,
            "status": v.status,
            "data": v.criado_em.isoformat() if v.criado_em else None,
        })

    # Garantias
    from app.models.garantia import Garantia
    result = await db.execute(
        sa_select(Garantia).where(Garantia.cliente_id == cliente_id).order_by(Garantia.criado_em.desc()).limit(50)
    )
    for g in result.scalars().all():
        historico.append({
            "tipo": "garantia",
            "codigo": g.certificado,
            "produto": g.produto_nome,
            "valor": float(g.produto_valor),
            "quantidade": 1,
            "status": g.status,
            "data": g.criado_em.isoformat() if g.criado_em else None,
        })

    # Ordenar por data
    historico.sort(key=lambda x: x["data"] or "", reverse=True)

    return historico


@router.post("/verificar-telefone")
async def verificar_telefone(
    dados: VerificarTelefoneRequest,
    _user: Usuario = Depends(get_current_user),
):
    telefone = _limpar_telefone(dados.telefone)
    if len(telefone) < 10:
        raise HTTPException(status_code=400, detail="Telefone inválido")

    codigo = "".join(random.choices(string.digits, k=6))
    # Sempre sobrescreve: o último código enviado é o válido
    _codigos_verificacao[telefone] = codigo

    mensagem = (
        f"🔐 *MDA - Mimos de Alice*\n\n"
        f"Seu código de verificação é:\n\n"
        f"*{codigo}*\n\n"
        f"Use este código para confirmar seu WhatsApp no sistema."
    )
    resultado = await enviar_mensagem_whatsapp(telefone, mensagem)
    return {"enviado": resultado.get("status") in ("enviado", "simulado"), "status": resultado.get("status")}


@router.post("/confirmar-codigo")
async def confirmar_codigo(
    dados: ConfirmarCodigoRequest,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    telefone = _limpar_telefone(dados.telefone)
    codigo_esperado = _codigos_verificacao.get(telefone)

    if not codigo_esperado:
        raise HTTPException(status_code=400, detail="Nenhum código enviado para este telefone")

    if dados.codigo.strip() != codigo_esperado:
        return {"verificado": False, "motivo": "Código incorreto"}

    del _codigos_verificacao[telefone]

    # Marcar cliente como verificado no banco
    if dados.cliente_id:
        from app.models.cliente import Cliente
        from sqlalchemy import select
        result = await db.execute(select(Cliente).where(Cliente.id == dados.cliente_id))
        cliente = result.scalar_one_or_none()
        if cliente:
            cliente.whatsapp_verificado = True
            await db.commit()

    return {"verificado": True}
