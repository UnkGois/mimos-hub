from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import select

from app.config import settings
from app.database import async_session, create_tables
from app.models.usuario import Usuario
from app.routers import auth, clientes, cupons, dashboard, garantias, mensagens, termos, produtos, despesas, configuracoes, vendas, reservas
from app.utils.security import hash_password

logger = logging.getLogger(__name__)

# Rate limiter global
limiter = Limiter(key_func=get_remote_address)


async def seed_usuario():
    """Cria usuário padrão se não existir nenhum."""
    async with async_session() as db:
        result = await db.execute(select(Usuario).limit(1))
        if result.scalar_one_or_none() is None:
            usuario = Usuario(
                nome=settings.DEFAULT_USER_NAME,
                email=settings.DEFAULT_USER_EMAIL,
                senha_hash=hash_password(settings.DEFAULT_USER_PASSWORD),
                cargo="Administrador",
            )
            db.add(usuario)
            await db.commit()
            logger.info(f"Usuário seed criado: {settings.DEFAULT_USER_EMAIL}")


async def _task_expirar_reservas():
    """Verifica reservas expiradas a cada 30 minutos."""
    import asyncio
    import json
    from datetime import timedelta, datetime, timezone
    from sqlalchemy import select as sa_select
    from app.models.reserva import Reserva
    from app.models.produto import Produto
    from app.models.configuracao import Configuracao
    from app.services.whatsapp_service import enviar_mensagem_whatsapp

    while True:
        try:
            await asyncio.sleep(30 * 60)  # 30 minutos
            async with async_session() as db:
                horas = 6
                result_cfg = await db.execute(sa_select(Configuracao).where(Configuracao.chave == "pix"))
                cfg = result_cfg.scalar_one_or_none()
                if cfg:
                    try:
                        horas = int(json.loads(cfg.valor).get("horas_expiracao", 6))
                    except Exception:
                        pass

                limite = datetime.now(timezone.utc) - timedelta(hours=horas)
                result = await db.execute(
                    sa_select(Reserva).where(
                        Reserva.status.in_(["Reservado", "AguardandoPagamento"]),
                        Reserva.criado_em <= limite,
                    )
                )
                expiradas = result.scalars().all()
                for reserva in expiradas:
                    reserva.status = "Expirado"
                    result_prod = await db.execute(sa_select(Produto).where(Produto.id == reserva.produto_id))
                    produto = result_prod.scalar_one_or_none()
                    if produto:
                        produto.qtd_estoque += reserva.quantidade
                    if reserva.cliente_telefone:
                        tel = "".join(c for c in reserva.cliente_telefone if c.isdigit())
                        nome = (reserva.cliente_nome or "").strip() or "Cliente"
                        try:
                            await enviar_mensagem_whatsapp(tel, (
                                f"Oi {nome}! 💕\n\nSua reserva *{reserva.codigo}* do produto "
                                f"*{reserva.produto_nome}* expirou pois não recebemos o pagamento "
                                f"em *{horas} horas*.\n\nMas relaxa! Se ainda quiser o produto, "
                                f"é só reservar novamente. 🤗\n\nChama a gente aqui no WhatsApp! 💬\n\n"
                                f"Com carinho,\n*MDA - Mimos de Alice Joias* 🪷"
                            ))
                        except Exception as wpp_err:
                            logger.warning(f"Falha ao enviar WhatsApp expiração {reserva.codigo}: {wpp_err}")
                await db.commit()
                if expiradas:
                    logger.info(f"Expiradas {len(expiradas)} reservas")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Erro ao expirar reservas: {e}")
            await asyncio.sleep(60)  # Aguardar 1 min antes de tentar novamente


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    await create_tables()
    await seed_usuario()
    task = asyncio.create_task(_task_expirar_reservas())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Mimos Hub - Mimos de Alice",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Autenticação"])
app.include_router(clientes.router, prefix="/api/clientes", tags=["Clientes"])
app.include_router(garantias.router, prefix="/api/garantias", tags=["Garantias"])
app.include_router(mensagens.router, prefix="/api/mensagens", tags=["Mensagens"])
app.include_router(cupons.router, prefix="/api/cupons", tags=["Cupons"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(termos.router, prefix="/api/termos", tags=["Termos de Retirada"])
app.include_router(produtos.router, prefix="/api/produtos", tags=["Produtos / Estoque"])
app.include_router(despesas.router, prefix="/api/despesas", tags=["Despesas"])
app.include_router(configuracoes.router, prefix="/api/configuracoes", tags=["Configurações"])
app.include_router(vendas.router, prefix="/api/vendas", tags=["Vendas / PDV"])
app.include_router(reservas.router, prefix="/api/reservas", tags=["Live Shop / Reservas"])


@app.get("/")
async def root():
    return {"status": "ok", "app": "Mimos Hub API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
