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
from app.routers import auth, clientes, cupons, dashboard, garantias, mensagens, termos, produtos, despesas, configuracoes, vendas
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    await seed_usuario()
    yield


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


@app.get("/")
async def root():
    return {"status": "ok", "app": "Mimos Hub API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
