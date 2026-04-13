from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.cliente import Cliente
from app.models.produto import Produto
from app.models.reserva import Reserva
from app.models.usuario import Usuario
from app.routers.auth import get_current_user
from app.services.whatsapp_service import enviar_mensagem_whatsapp

router = APIRouter()


async def _enviar_e_registrar(db, telefone, mensagem, tipo="LiveShop", cliente_id=None):
    """Envia WhatsApp e registra na tabela de mensagens."""
    from app.services.registrar_mensagem import registrar
    resultado = await enviar_mensagem_whatsapp(telefone, mensagem)
    await registrar(db, tipo=tipo, conteudo=mensagem, resultado_envio=resultado, cliente_id=cliente_id)
    return resultado


# ─── Schemas ───

class ReservaCreate(BaseModel):
    produto_id: Optional[int] = None
    produto_nome_avulso: Optional[str] = None
    produto_preco_avulso: Optional[Decimal] = None
    quantidade: int = 1
    tipo_entrega: str = "retirada"
    cliente_nome: Optional[str] = None
    cliente_telefone: Optional[str] = None
    cliente_cpf: Optional[str] = None
    cliente_instagram: Optional[str] = None
    observacao: Optional[str] = None


class ReservaResponse(BaseModel):
    id: int
    codigo: str
    produto_id: int
    produto_nome: str
    produto_preco: Decimal
    quantidade: int
    tipo_entrega: str
    forma_pagamento: Optional[str] = None
    cliente_id: Optional[int] = None
    cliente_nome: Optional[str] = None
    cliente_telefone: Optional[str] = None
    cliente_cpf: Optional[str] = None
    cliente_instagram: Optional[str] = None
    entrega_cep: Optional[str] = None
    entrega_endereco: Optional[str] = None
    entrega_numero: Optional[str] = None
    entrega_complemento: Optional[str] = None
    entrega_bairro: Optional[str] = None
    entrega_cidade: Optional[str] = None
    entrega_uf: Optional[str] = None
    entrega_observacao: Optional[str] = None
    checkout_token: Optional[str] = None
    status: str
    whatsapp_enviado: str
    observacao: Optional[str] = None
    criado_em: datetime

    class Config:
        from_attributes = True


class ReservaListResponse(BaseModel):
    items: list[ReservaResponse]
    total: int


class ReservaStatusUpdate(BaseModel):
    status: str


class CheckoutSubmit(BaseModel):
    reserva_ids: list[int]
    nome: str
    cpf: str
    telefone: str
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    observacao: Optional[str] = None
    forma_pagamento: str = "pix"
    cartao_nome: Optional[str] = None
    cartao_numero: Optional[str] = None
    cartao_parcelas: Optional[int] = None
    cancelar_restante: bool = True


# ─── Helpers ───

async def _get_horas_expiracao(db: AsyncSession) -> int:
    from app.models.configuracao import Configuracao
    import json
    result = await db.execute(select(Configuracao).where(Configuracao.chave == "pix"))
    cfg = result.scalar_one_or_none()
    if cfg:
        try:
            return int(json.loads(cfg.valor).get("horas_expiracao", 6))
        except Exception:
            pass
    return 6


async def _proximo_codigo(db: AsyncSession) -> str:
    ano = datetime.now(timezone.utc).year
    prefixo = f"RES-{ano}-"
    result = await db.execute(
        select(Reserva.codigo)
        .where(Reserva.codigo.like(f"{prefixo}%"))
        .order_by(Reserva.id.desc())
        .limit(1)
    )
    ultimo = result.scalar_one_or_none()
    seq = 1 if not ultimo else int(ultimo.replace(prefixo, "")) + 1
    return f"{prefixo}{seq:06d}"


def _formatar_pix_mensagem(cliente_nome, produto_nome, preco, quantidade, codigo, pix_config, horas=6):
    total = preco * quantidade
    total_fmt = f"R$ {float(total):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    chave_pix = pix_config.get("chave_pix", "")
    nome_pix = pix_config.get("nome_pix", "MDA - Mimos de Alice")
    banco_pix = pix_config.get("banco_pix", "")

    nome = cliente_nome or "Cliente"

    msg = (
        f"🎉 *Parabéns {nome}!*\n\n"
        f"Você reservou na nossa Live:\n\n"
        f"📦 *{produto_nome}*\n"
        f"💰 Valor: *{total_fmt}*\n"
    )
    if quantidade > 1:
        msg += f"📌 Quantidade: *{quantidade}*\n"

    msg += (
        f"🔖 Código: *{codigo}*\n\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"💳 *PAGAMENTO VIA PIX*\n"
        f"━━━━━━━━━━━━━━━━\n\n"
    )

    if chave_pix:
        msg += f"🔑 Chave PIX:\n*{chave_pix}*\n\n"
    if nome_pix:
        msg += f"👤 Nome: *{nome_pix}*\n"
    if banco_pix:
        msg += f"🏦 Banco: *{banco_pix}*\n"

    msg += (
        f"\n⚠️ *Importante:* Sua reserva será mantida por *{horas} horas*. "
        f"Após o pagamento, envie o comprovante aqui nesta conversa.\n\n"
        f"Obrigada por comprar com a gente! 💕\n"
        f"*MDA - Mimos de Alice Joias* 🪷"
    )
    return msg


def _formatar_mensagem_entrega(cliente_nome, produto_nome, preco, quantidade, codigo, checkout_link, horas=6):
    total = preco * quantidade
    total_fmt = f"R$ {float(total):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    nome = cliente_nome or "Cliente"

    return (
        f"🎉 *Parabéns {nome}!*\n\n"
        f"Você reservou:\n\n"
        f"📦 *{produto_nome}*\n"
        f"💰 Valor: *{total_fmt}*\n"
        f"🔖 Código: *{codigo}*\n\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"🚚 *ENTREGA*\n"
        f"━━━━━━━━━━━━━━━━\n\n"
        f"Para finalizar sua compra e informar o endereço de entrega, acesse o link abaixo:\n\n"
        f"👉 *{checkout_link}*\n\n"
        f"⚠️ *Importante:* Complete o checkout em até *{horas} horas* para garantir sua reserva.\n\n"
        f"Obrigada por comprar com a gente! 💕\n"
        f"*MDA - Mimos de Alice Joias* 🪷"
    )


# ─── Endpoints ───

@router.post("/", response_model=ReservaResponse, status_code=status.HTTP_201_CREATED)
async def criar_reserva(
    dados: ReservaCreate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Produto avulso ou do estoque
    produto = None
    produto_nome = ""
    preco = Decimal("0")
    produto_id_final = None

    if dados.produto_id:
        from sqlalchemy.orm import joinedload
        result = await db.execute(
            select(Produto).options(joinedload(Produto.canais)).where(Produto.id == dados.produto_id)
        )
        produto = result.unique().scalar_one_or_none()
        if not produto:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Produto não encontrado")
        if produto.qtd_estoque < dados.quantidade:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Estoque insuficiente (disponível: {produto.qtd_estoque})")
        produto_nome = produto.nome
        produto_id_final = produto.id
        for canal in produto.canais:
            if canal.canal == "lojaFisica" and canal.ativo:
                preco = Decimal(str(canal.preco_final))
                break
        if preco <= 0:
            preco = Decimal(str(produto.custo_total or 0))
    elif dados.produto_nome_avulso and dados.produto_preco_avulso:
        produto_nome = dados.produto_nome_avulso
        preco = dados.produto_preco_avulso
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Informe um produto do estoque ou um produto avulso")

    # Buscar/criar cliente se telefone fornecido
    cliente_id = None
    if dados.cliente_telefone:
        tel_limpo = "".join(c for c in dados.cliente_telefone if c.isdigit())
        result = await db.execute(select(Cliente).where(Cliente.telefone == tel_limpo))
        cliente = result.scalar_one_or_none()
        if cliente:
            cliente_id = cliente.id
            if not dados.cliente_nome and cliente.nome:
                dados.cliente_nome = cliente.nome
    elif dados.cliente_cpf:
        cpf_limpo = "".join(c for c in dados.cliente_cpf if c.isdigit())
        result = await db.execute(select(Cliente).where(Cliente.cpf == cpf_limpo))
        cliente = result.scalar_one_or_none()
        if cliente:
            cliente_id = cliente.id
            if not dados.cliente_nome:
                dados.cliente_nome = cliente.nome
            if not dados.cliente_telefone:
                dados.cliente_telefone = cliente.telefone

    codigo = await _proximo_codigo(db)

    # Decrementar estoque (só se produto do catálogo)
    if produto:
        produto.qtd_estoque -= dados.quantidade

    import uuid as uuid_lib
    checkout_token = str(uuid_lib.uuid4()) if dados.tipo_entrega == "entrega" else None

    reserva = Reserva(
        codigo=codigo,
        produto_id=produto_id_final,
        cliente_id=cliente_id,
        produto_nome=produto_nome,
        produto_preco=preco,
        quantidade=dados.quantidade,
        tipo_entrega=dados.tipo_entrega,
        cliente_nome=dados.cliente_nome,
        cliente_telefone=dados.cliente_telefone,
        cliente_cpf=dados.cliente_cpf,
        cliente_instagram=dados.cliente_instagram,
        checkout_token=checkout_token,
        observacao=dados.observacao,
    )
    db.add(reserva)
    await db.flush()

    # Enviar WhatsApp se tem telefone
    if dados.cliente_telefone:
        tel_limpo = "".join(c for c in dados.cliente_telefone if c.isdigit())
        # Buscar config PIX e horas
        from app.models.configuracao import Configuracao
        import json
        pix_config = {}
        result = await db.execute(select(Configuracao).where(Configuracao.chave == "pix"))
        cfg = result.scalar_one_or_none()
        if cfg:
            try:
                pix_config = json.loads(cfg.valor)
            except Exception:
                pass
        horas = int(pix_config.get("horas_expiracao", 6))

        if dados.tipo_entrega == "entrega" and checkout_token:
            from app.config import settings
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            checkout_link = f"{frontend_url}/checkout/{checkout_token}"
            mensagem = _formatar_mensagem_entrega(
                dados.cliente_nome, produto_nome, preco, dados.quantidade, codigo, checkout_link, horas
            )
        else:
            mensagem = _formatar_pix_mensagem(
                dados.cliente_nome, produto_nome, preco, dados.quantidade, codigo, pix_config, horas
            )
        resultado = await _enviar_e_registrar(db, tel_limpo, mensagem, cliente_id=reserva.cliente_id)
        reserva.whatsapp_enviado = "enviado" if resultado.get("status") in ("enviado", "simulado") else "falha"

    await db.commit()
    await db.refresh(reserva)
    return ReservaResponse.model_validate(reserva)


@router.get("/", response_model=ReservaListResponse)
async def listar_reservas(
    status_reserva: str | None = Query(None, alias="status"),
    busca: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Reserva)
    count_query = select(func.count(Reserva.id))

    if status_reserva:
        query = query.where(Reserva.status == status_reserva)
        count_query = count_query.where(Reserva.status == status_reserva)
    if busca:
        filtro = f"%{busca}%"
        cond = Reserva.codigo.ilike(filtro) | Reserva.cliente_nome.ilike(filtro) | Reserva.produto_nome.ilike(filtro) | Reserva.cliente_instagram.ilike(filtro)
        query = query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query.order_by(Reserva.criado_em.desc()).offset(skip).limit(limit))
    items = result.scalars().all()
    return ReservaListResponse(items=[ReservaResponse.model_validate(r) for r in items], total=total)


@router.get("/stats")
async def estatisticas_reservas(
    data_inicio: str | None = Query(None),
    data_fim: str | None = Query(None),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type
    query_base = select(Reserva)
    if data_inicio:
        query_base = query_base.where(func.date(Reserva.criado_em) >= date_type.fromisoformat(data_inicio))
    if data_fim:
        query_base = query_base.where(func.date(Reserva.criado_em) <= date_type.fromisoformat(data_fim))

    result = await db.execute(query_base)
    todas = result.scalars().all()

    total = len(todas)
    pagos = sum(1 for r in todas if r.status == "Pago")
    pendentes = sum(1 for r in todas if r.status in ("Reservado", "AguardandoPagamento"))
    cancelados = sum(1 for r in todas if r.status == "Cancelado")
    expirados = sum(1 for r in todas if r.status == "Expirado")
    faturamento = sum(float(r.produto_preco * r.quantidade) for r in todas if r.status == "Pago")
    taxa_conversao = round((pagos / total * 100), 1) if total > 0 else 0

    return {
        "total": total,
        "pagos": pagos,
        "pendentes": pendentes,
        "cancelados": cancelados,
        "expirados": expirados,
        "faturamento": faturamento,
        "taxa_conversao": taxa_conversao,
    }


@router.put("/{reserva_id}/status", response_model=ReservaResponse)
async def atualizar_status(
    reserva_id: int,
    dados: ReservaStatusUpdate,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Reserva).where(Reserva.id == reserva_id))
    reserva = result.scalar_one_or_none()
    if not reserva:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reserva não encontrada")

    # Se reabrir (voltar para Reservado de Cancelado/Expirado), decrementar estoque novamente
    if dados.status == "Reservado" and reserva.status in ("Cancelado", "Expirado") and reserva.produto_id:
        result = await db.execute(select(Produto).where(Produto.id == reserva.produto_id))
        produto = result.scalar_one_or_none()
        if produto:
            if produto.qtd_estoque < reserva.quantidade:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Estoque insuficiente para reabrir (disponível: {produto.qtd_estoque})")
            produto.qtd_estoque -= reserva.quantidade

    # Se cancelar, restaurar estoque e notificar cliente
    if dados.status == "Cancelado" and reserva.status in ("Reservado", "AguardandoPagamento"):
        result = await db.execute(select(Produto).where(Produto.id == reserva.produto_id))
        produto = result.scalar_one_or_none()
        if produto:
            produto.qtd_estoque += reserva.quantidade

        # Enviar mensagem de cancelamento via WhatsApp
        if reserva.cliente_telefone:
            tel_limpo = "".join(c for c in reserva.cliente_telefone if c.isdigit())
            nome = reserva.cliente_nome or "Cliente"
            mensagem = (
                f"Oi {nome}! 💕\n\n"
                f"Passando pra avisar que sua reserva *{reserva.codigo}* "
                f"do produto *{reserva.produto_nome}* foi cancelada.\n\n"
                f"Mas não fica triste não! 🤗\n\n"
                f"Você pode solicitar esse mesmo produto ou qualquer outro "
                f"a qualquer momento. Estamos sempre com novidades lindas "
                f"esperando por você! ✨\n\n"
                f"É só chamar aqui no WhatsApp que a gente te ajuda! 💬\n\n"
                f"Com carinho,\n"
                f"*MDA - Mimos de Alice Joias* 🪷"
            )
            await _enviar_e_registrar(db, tel_limpo, mensagem, cliente_id=reserva.cliente_id if hasattr(reserva, "cliente_id") else None)

    # Se pago, vincular ao cliente e incrementar compras
    if dados.status == "Pago":
        if reserva.cliente_telefone and not reserva.cliente_id:
            tel = "".join(c for c in reserva.cliente_telefone if c.isdigit())
            result_cli = await db.execute(select(Cliente).where(Cliente.telefone == tel))
            cli = result_cli.scalar_one_or_none()
            if cli:
                reserva.cliente_id = cli.id
                cli.total_compras = (cli.total_compras or 0) + 1

    # Se pago, enviar confirmação via WhatsApp
    if dados.status == "Pago" and reserva.cliente_telefone:
        tel_limpo = "".join(c for c in reserva.cliente_telefone if c.isdigit())
        nome = reserva.cliente_nome or "Cliente"
        total = float(reserva.produto_preco * reserva.quantidade)
        total_fmt = f"R$ {total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

        mensagem = (
            f"✅ *Pagamento Confirmado!*\n\n"
            f"Oi {nome}! Recebemos seu pagamento. 🎉\n\n"
            f"📦 Produto: *{reserva.produto_nome}*\n"
            f"💰 Valor: *{total_fmt}*\n"
            f"🔖 Pedido: *{reserva.codigo}*\n\n"
        )

        if reserva.tipo_entrega == "entrega" and reserva.entrega_endereco:
            endereco = f"{reserva.entrega_endereco}, {reserva.entrega_numero or ''}"
            if reserva.entrega_complemento:
                endereco += f" - {reserva.entrega_complemento}"
            endereco += f"\n{reserva.entrega_bairro or ''}, {reserva.entrega_cidade or ''}/{reserva.entrega_uf or ''}"
            if reserva.entrega_observacao:
                endereco += f"\nObs: {reserva.entrega_observacao}"

            mensagem += (
                f"━━━━━━━━━━━━━━━━\n"
                f"📦 *SEU PEDIDO ESTÁ SENDO SEPARADO!*\n"
                f"━━━━━━━━━━━━━━━━\n\n"
                f"Estamos preparando sua encomenda com muito carinho! 💝\n\n"
                f"🚚 *Entrega em:*\n{endereco}\n\n"
                f"Assim que for enviado, avisamos aqui com o código de rastreio! 📬\n\n"
            )
        else:
            mensagem += (
                f"━━━━━━━━━━━━━━━━\n"
                f"📦 *SEU PEDIDO ESTÁ SENDO SEPARADO!*\n"
                f"━━━━━━━━━━━━━━━━\n\n"
                f"Estamos preparando seu produto com muito carinho! 💝\n\n"
                f"🏪 *Retirada na loja:* MDA - Mimos de Alice Joias\n\n"
                f"Avisaremos quando estiver pronto para retirada! 📦\n\n"
            )

        mensagem += (
            f"Qualquer dúvida, estamos por aqui! 💬\n\n"
            f"Obrigada pela confiança! 💕\n"
            f"*MDA - Mimos de Alice Joias* 🪷"
        )
        await _enviar_e_registrar(db, tel_limpo, mensagem, cliente_id=reserva.cliente_id if hasattr(reserva, "cliente_id") else None)

    reserva.status = dados.status
    await db.commit()
    await db.refresh(reserva)
    return ReservaResponse.model_validate(reserva)


@router.post("/{reserva_id}/notificar-retirada")
async def notificar_pronto_retirada(
    reserva_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Reserva).where(Reserva.id == reserva_id))
    reserva = result.scalar_one_or_none()
    if not reserva:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reserva não encontrada")
    if not reserva.cliente_telefone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reserva sem telefone")
    if reserva.status != "Pago":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Só é possível notificar pedidos pagos")

    tel_limpo = "".join(c for c in reserva.cliente_telefone if c.isdigit())
    nome = reserva.cliente_nome or "Cliente"

    if reserva.tipo_entrega == "entrega":
        mensagem = (
            f"📦 *Pedido Enviado!*\n\n"
            f"Oi {nome}! Seu pedido *{reserva.codigo}* acabou de ser enviado! 🚚✨\n\n"
            f"📦 Produto: *{reserva.produto_nome}*\n\n"
            f"🏠 *Entrega em:*\n"
        )
        if reserva.entrega_endereco:
            mensagem += f"{reserva.entrega_endereco}, {reserva.entrega_numero or ''}"
            if reserva.entrega_complemento:
                mensagem += f" - {reserva.entrega_complemento}"
            mensagem += f"\n{reserva.entrega_bairro or ''}, {reserva.entrega_cidade or ''}/{reserva.entrega_uf or ''}\n"
        mensagem += (
            f"\nFique de olho! Quando chegar, confirma pra gente aqui. 📬\n\n"
            f"Obrigada pela compra! 💕\n"
            f"*MDA - Mimos de Alice Joias* 🪷"
        )
    else:
        mensagem = (
            f"🎀 *Pedido Pronto!*\n\n"
            f"Oi {nome}! Seu pedido *{reserva.codigo}* já está pronto e "
            f"esperando por você! 🤩\n\n"
            f"📦 Produto: *{reserva.produto_nome}*\n\n"
            f"🏪 *Retirada em:*\n"
            f"MDA - Mimos de Alice Joias\n\n"
            f"Estamos te esperando! Pode vir buscar quando quiser. 😊\n\n"
            f"Se precisar combinar um horário, é só chamar aqui! 💬\n\n"
            f"Com carinho,\n"
            f"*MDA - Mimos de Alice Joias* 🪷"
        )

    resultado = await _enviar_e_registrar(db, tel_limpo, mensagem, cliente_id=reserva.cliente_id)
    return {"status": resultado.get("status", "falha")}


@router.post("/{reserva_id}/reenviar-whatsapp")
async def reenviar_whatsapp(
    reserva_id: int,
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Reserva).where(Reserva.id == reserva_id))
    reserva = result.scalar_one_or_none()
    if not reserva:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reserva não encontrada")
    if not reserva.cliente_telefone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reserva sem telefone")

    from app.models.configuracao import Configuracao
    import json
    pix_config = {}
    result = await db.execute(select(Configuracao).where(Configuracao.chave == "pix"))
    cfg = result.scalar_one_or_none()
    if cfg:
        try:
            pix_config = json.loads(cfg.valor)
        except Exception:
            pass

    tel_limpo = "".join(c for c in reserva.cliente_telefone if c.isdigit())
    horas = int(pix_config.get("horas_expiracao", 6))

    if reserva.tipo_entrega == "entrega" and reserva.checkout_token:
        from app.config import settings
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        checkout_link = f"{frontend_url}/checkout/{reserva.checkout_token}"
        mensagem = _formatar_mensagem_entrega(
            reserva.cliente_nome, reserva.produto_nome,
            reserva.produto_preco, reserva.quantidade, reserva.codigo, checkout_link, horas
        )
    else:
        mensagem = _formatar_pix_mensagem(
            reserva.cliente_nome, reserva.produto_nome,
            reserva.produto_preco, reserva.quantidade, reserva.codigo, pix_config, horas
        )
    resultado = await _enviar_e_registrar(db, tel_limpo, mensagem, cliente_id=reserva.cliente_id)
    reserva.whatsapp_enviado = "enviado" if resultado.get("status") in ("enviado", "simulado") else "falha"
    await db.commit()
    return {"status": reserva.whatsapp_enviado}


@router.post("/enviar-checkout-cliente")
async def enviar_checkout_cliente(
    telefone: str = Query(...),
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Envia um único link de checkout com TODAS as reservas pendentes do cliente."""
    tel_limpo = "".join(c for c in telefone if c.isdigit())
    if len(tel_limpo) < 10:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Telefone inválido")

    result = await db.execute(
        select(Reserva).where(
            Reserva.cliente_telefone == tel_limpo,
            Reserva.status.in_(["Reservado", "AguardandoPagamento"]),
        )
    )
    reservas_pendentes = result.scalars().all()
    if not reservas_pendentes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nenhuma reserva pendente para este cliente")

    # Gerar token de checkout do cliente (usa o telefone como chave)
    import uuid as uuid_lib
    import hashlib
    checkout_token = hashlib.md5(f"{tel_limpo}-checkout".encode()).hexdigest()

    # Atualizar todas as reservas com o mesmo token
    for r in reservas_pendentes:
        r.checkout_token = checkout_token

    nome = reservas_pendentes[0].cliente_nome or "Cliente"
    total = sum(float(r.produto_preco * r.quantidade) for r in reservas_pendentes)
    total_fmt = f"R$ {total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    itens_texto = ""
    for r in reservas_pendentes:
        valor = float(r.produto_preco * r.quantidade)
        valor_fmt = f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        itens_texto += f"  📦 *{r.produto_nome}* — {valor_fmt}\n"

    from app.config import settings
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    checkout_link = f"{frontend_url}/checkout/{checkout_token}"

    mensagem = (
        f"🛍️ *Seus Pedidos da Live!*\n\n"
        f"Oi {nome}! Aqui estão todos os produtos que você reservou:\n\n"
        f"{itens_texto}\n"
        f"💰 Total: *{total_fmt}*\n\n"
        f"Para finalizar sua compra, acesse o link abaixo:\n\n"
        f"👉 *{checkout_link}*\n\n"
        f"No checkout você pode escolher quais produtos deseja pagar. "
        f"Os não selecionados serão cancelados automaticamente. ⏰\n\n"
        f"Obrigada por comprar com a gente! 💕\n"
        f"*MDA - Mimos de Alice Joias* 🪷"
    )

    resultado = await _enviar_e_registrar(db, tel_limpo, mensagem, cliente_id=reserva.cliente_id)
    await db.commit()
    return {
        "enviado": resultado.get("status") in ("enviado", "simulado"),
        "reservas": len(reservas_pendentes),
        "total": total,
    }


@router.post("/expirar-pendentes")
async def expirar_pendentes(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancela reservas pendentes que passaram do prazo configurado."""
    from app.models.configuracao import Configuracao
    import json

    # Buscar horas de expiração da config
    horas = 6
    result_cfg = await db.execute(select(Configuracao).where(Configuracao.chave == "pix"))
    cfg = result_cfg.scalar_one_or_none()
    if cfg:
        try:
            pix_config = json.loads(cfg.valor)
            horas = int(pix_config.get("horas_expiracao", 6))
        except Exception:
            pass

    from datetime import timedelta
    limite = datetime.now(timezone.utc) - timedelta(hours=horas)

    result = await db.execute(
        select(Reserva).where(
            Reserva.status.in_(["Reservado", "AguardandoPagamento"]),
            Reserva.criado_em <= limite,
        )
    )
    reservas_expiradas = result.scalars().all()

    canceladas = 0
    for reserva in reservas_expiradas:
        reserva.status = "Expirado"

        # Restaurar estoque
        result_prod = await db.execute(select(Produto).where(Produto.id == reserva.produto_id))
        produto = result_prod.scalar_one_or_none()
        if produto:
            produto.qtd_estoque += reserva.quantidade

        # Notificar cliente
        if reserva.cliente_telefone:
            tel_limpo = "".join(c for c in reserva.cliente_telefone if c.isdigit())
            nome = reserva.cliente_nome or "Cliente"
            mensagem = (
                f"Oi {nome}! 💕\n\n"
                f"Sua reserva *{reserva.codigo}* do produto *{reserva.produto_nome}* "
                f"expirou pois não recebemos o pagamento em *{horas} horas*.\n\n"
                f"Mas relaxa! Se ainda quiser o produto, é só reservar novamente. 🤗\n\n"
                f"Chama a gente aqui no WhatsApp! 💬\n\n"
                f"Com carinho,\n"
                f"*MDA - Mimos de Alice Joias* 🪷"
            )
            await _enviar_e_registrar(db, tel_limpo, mensagem, cliente_id=reserva.cliente_id if hasattr(reserva, "cliente_id") else None)

        canceladas += 1

    await db.commit()
    return {"expiradas": canceladas, "horas_limite": horas}


# ─── Endpoints Públicos (sem auth) ───

@router.get("/checkout/{token}")
async def obter_checkout(token: str, db: AsyncSession = Depends(get_db)):
    # Buscar a reserva do token
    result = await db.execute(
        select(Reserva).where(Reserva.checkout_token == token)
    )
    reserva_principal = result.scalar_one_or_none()
    if not reserva_principal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checkout não encontrado")
    if reserva_principal.status not in ("Reservado", "AguardandoPagamento"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Este pedido já foi finalizado")

    # Buscar TODAS as reservas pendentes do mesmo cliente (pelo telefone)
    itens = []
    if reserva_principal.cliente_telefone:
        result_todas = await db.execute(
            select(Reserva).where(
                Reserva.cliente_telefone == reserva_principal.cliente_telefone,
                Reserva.status.in_(["Reservado", "AguardandoPagamento"]),
            )
        )
        todas = result_todas.scalars().all()
    else:
        todas = [reserva_principal]

    for r in todas:
        itens.append({
            "id": r.id,
            "codigo": r.codigo,
            "produto_nome": r.produto_nome,
            "produto_preco": str(r.produto_preco),
            "quantidade": r.quantidade,
            "total": str(r.produto_preco * r.quantidade),
            "is_principal": r.id == reserva_principal.id,
        })

    total_geral = sum(float(r.produto_preco * r.quantidade) for r in todas)

    # Buscar dados completos do cliente se existir na base
    cliente_dados = {}
    tel = reserva_principal.cliente_telefone
    if tel:
        result_cli = await db.execute(select(Cliente).where(Cliente.telefone == tel))
        cli = result_cli.scalar_one_or_none()
        if cli:
            cliente_dados = {
                "cliente_endereco": cli.endereco,
                "cliente_numero": cli.numero,
                "cliente_complemento": cli.complemento,
                "cliente_bairro": cli.bairro,
                "cliente_cidade": cli.cidade,
                "cliente_uf": cli.uf,
                "cliente_cep": cli.cep,
                "cliente_cpf": cli.cpf,
                "cliente_email": cli.email,
            }

    return {
        "itens": itens,
        "total": str(total_geral),
        "cliente_nome": reserva_principal.cliente_nome,
        "cliente_telefone": reserva_principal.cliente_telefone,
        "cliente_cpf": reserva_principal.cliente_cpf or cliente_dados.get("cliente_cpf"),
        "tipo_entrega": reserva_principal.tipo_entrega,
        **cliente_dados,
    }


@router.post("/checkout/{token}")
async def submeter_checkout(
    token: str,
    dados: CheckoutSubmit,
    db: AsyncSession = Depends(get_db),
):
    if not dados.reserva_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Selecione pelo menos um produto")

    # Buscar as reservas selecionadas
    result = await db.execute(
        select(Reserva).where(
            Reserva.id.in_(dados.reserva_ids),
            Reserva.status.in_(["Reservado", "AguardandoPagamento"]),
        )
    )
    reservas_selecionadas = result.scalars().all()
    if not reservas_selecionadas:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nenhuma reserva válida encontrada")

    tel_limpo = "".join(c for c in dados.telefone if c.isdigit())

    # Atualizar apenas as selecionadas
    for reserva in reservas_selecionadas:
        reserva.cliente_nome = dados.nome
        reserva.cliente_cpf = dados.cpf
        reserva.cliente_telefone = tel_limpo
        reserva.forma_pagamento = dados.forma_pagamento
        reserva.status = "AguardandoPagamento"
        if dados.cep:
            reserva.entrega_cep = dados.cep
            reserva.entrega_endereco = dados.endereco
            reserva.entrega_numero = dados.numero
            reserva.entrega_complemento = dados.complemento
            reserva.entrega_bairro = dados.bairro
            reserva.entrega_cidade = dados.cidade
            reserva.entrega_uf = dados.uf
            reserva.entrega_observacao = dados.observacao

    await db.flush()

    # Criar ou atualizar cliente na base
    cpf_limpo = "".join(c for c in (dados.cpf or "") if c.isdigit())
    cliente = None

    # Buscar por CPF primeiro
    if cpf_limpo and len(cpf_limpo) >= 11:
        result_cli = await db.execute(select(Cliente).where(Cliente.cpf == cpf_limpo))
        cliente = result_cli.scalar_one_or_none()

    # Se não encontrou por CPF, buscar por telefone
    if not cliente and tel_limpo:
        result_cli = await db.execute(select(Cliente).where(Cliente.telefone == tel_limpo))
        cliente = result_cli.scalar_one_or_none()

    if cliente:
        # Atualizar dados existentes
        cliente.nome = dados.nome
        if tel_limpo:
            cliente.telefone = tel_limpo
        if cpf_limpo and len(cpf_limpo) >= 11:
            cliente.cpf = cpf_limpo
        if dados.cep:
            cliente.cep = "".join(c for c in dados.cep if c.isdigit())
            cliente.endereco = dados.endereco
            cliente.numero = dados.numero
            cliente.complemento = dados.complemento
            cliente.bairro = dados.bairro
            cliente.cidade = dados.cidade
            cliente.uf = dados.uf
        cliente.total_compras = (cliente.total_compras or 0) + len(reservas_selecionadas)
    else:
        # Criar novo cliente
        if cpf_limpo and len(cpf_limpo) >= 11 and tel_limpo:
            cliente = Cliente(
                cpf=cpf_limpo,
                nome=dados.nome,
                telefone=tel_limpo,
                cep="".join(c for c in (dados.cep or "") if c.isdigit()) or None,
                endereco=dados.endereco,
                numero=dados.numero,
                complemento=dados.complemento,
                bairro=dados.bairro,
                cidade=dados.cidade,
                uf=dados.uf,
                total_compras=len(reservas_selecionadas),
            )
            db.add(cliente)
            await db.flush()

    # Vincular reservas ao cliente
    if cliente:
        for r in reservas_selecionadas:
            r.cliente_id = cliente.id

    # Cancelar os não selecionados se o cliente escolheu
    if dados.cancelar_restante:
        # Buscar todas as pendentes do mesmo telefone que NÃO foram selecionadas
        result_outras = await db.execute(
            select(Reserva).where(
                Reserva.cliente_telefone == tel_limpo,
                Reserva.status.in_(["Reservado"]),
                ~Reserva.id.in_(dados.reserva_ids),
            )
        )
        for r_cancelar in result_outras.scalars().all():
            r_cancelar.status = "Cancelado"
            # Restaurar estoque
            if r_cancelar.produto_id:
                result_prod = await db.execute(select(Produto).where(Produto.id == r_cancelar.produto_id))
                prod = result_prod.scalar_one_or_none()
                if prod:
                    prod.qtd_estoque += r_cancelar.quantidade

    reserva = reservas_selecionadas[0]

    # Montar mensagem com todos os itens selecionados
    if tel_limpo:
        from app.models.configuracao import Configuracao
        import json
        pix_config = {}
        result_cfg = await db.execute(select(Configuracao).where(Configuracao.chave == "pix"))
        cfg = result_cfg.scalar_one_or_none()
        if cfg:
            try:
                pix_config = json.loads(cfg.valor)
            except Exception:
                pass

        total = sum(float(r.produto_preco * r.quantidade) for r in reservas_selecionadas)
        total_fmt = f"R$ {total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

        itens_texto = ""
        for r in reservas_selecionadas:
            v = float(r.produto_preco * r.quantidade)
            v_fmt = f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            itens_texto += f"  📦 *{r.produto_nome}* — {v_fmt}\n"

        mensagem = (
            f"✅ *Checkout Concluído!*\n\n"
            f"Oi {dados.nome}! Recebemos seus dados. 🎉\n\n"
            f"{itens_texto}\n"
            f"💰 Total: *{total_fmt}*\n\n"
        )

        if dados.endereco:
            endereco_completo = f"{dados.endereco}, {dados.numero}"
            if dados.complemento:
                endereco_completo += f" - {dados.complemento}"
            endereco_completo += f"\n{dados.bairro}, {dados.cidade}/{dados.uf}\nCEP: {dados.cep}"
            if dados.observacao:
                endereco_completo += f"\nObs: {dados.observacao}"
            mensagem += (
                f"━━━━━━━━━━━━━━━━\n"
                f"🚚 *ENDEREÇO DE ENTREGA*\n"
                f"━━━━━━━━━━━━━━━━\n\n"
                f"{endereco_completo}\n\n"
            )

        if dados.forma_pagamento == "pix":
            chave_pix = pix_config.get("chave_pix", "")
            nome_pix = pix_config.get("nome_pix", "MDA - Mimos de Alice")
            banco_pix = pix_config.get("banco_pix", "")
            mensagem += f"━━━━━━━━━━━━━━━━\n💳 *PAGAMENTO VIA PIX*\n━━━━━━━━━━━━━━━━\n\n"
            if chave_pix:
                mensagem += f"🔑 Chave PIX:\n*{chave_pix}*\n\n"
            if nome_pix:
                mensagem += f"👤 Nome: *{nome_pix}*\n"
            if banco_pix:
                mensagem += f"🏦 Banco: *{banco_pix}*\n"
            mensagem += f"\n⚠️ Após o pagamento, envie o comprovante aqui. 📸\n\n"
        elif dados.forma_pagamento == "cartao_credito":
            mensagem += f"━━━━━━━━━━━━━━━━\n💳 *PAGAMENTO NO CARTÃO*\n━━━━━━━━━━━━━━━━\n\n"
            if dados.cartao_nome:
                mensagem += f"👤 Nome: *{dados.cartao_nome}*\n"
            if dados.cartao_numero:
                mensagem += f"💳 Cartão: *{dados.cartao_numero}*\n"
            if dados.cartao_parcelas and dados.cartao_parcelas > 1:
                parcela_valor = total / dados.cartao_parcelas
                parcela_fmt = f"R$ {parcela_valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                mensagem += f"📅 Parcelas: *{dados.cartao_parcelas}x de {parcela_fmt}*\n"
            else:
                mensagem += f"📅 *À vista*\n"
            mensagem += f"\nSeu pagamento será processado em breve. ✨\n\n"

        mensagem += f"Obrigada por comprar com a gente! 💕\n*MDA - Mimos de Alice Joias* 🪷"
        await _enviar_e_registrar(db, tel_limpo, mensagem, cliente_id=reserva.cliente_id if hasattr(reserva, "cliente_id") else None)

    await db.commit()
    await db.refresh(reserva)
    return {"status": "ok", "mensagem": "Checkout concluído! Aguardando pagamento."}
