from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.usuario import (
    LoginRequest,
    LoginResponse,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
)
from app.services import auth_service

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    return await auth_service.obter_usuario_atual(db, token)


@router.post("/registro", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def registro(
    dados: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    x_registration_key: str | None = Header(None, alias="X-Registration-Key"),
):
    """Registra novo usuário. Requer chave secreta via header X-Registration-Key."""
    if settings.REGISTRATION_SECRET_KEY:
        if not x_registration_key or x_registration_key != settings.REGISTRATION_SECRET_KEY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chave de registro inválida ou não fornecida",
            )
    usuario = await auth_service.registrar_usuario(db, dados)
    return usuario


@router.post("/login", response_model=LoginResponse)
async def login(dados: LoginRequest, db: AsyncSession = Depends(get_db)):
    usuario = await auth_service.autenticar_usuario(db, dados.email, dados.senha)
    access_token = auth_service.gerar_token(usuario)
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        usuario=UsuarioResponse.model_validate(usuario),
    )


@router.get("/me", response_model=UsuarioResponse)
async def me(usuario: Usuario = Depends(get_current_user)):
    return usuario


@router.put("/perfil", response_model=UsuarioResponse)
async def atualizar_perfil(
    dados: UsuarioUpdate,
    usuario: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if dados.email and dados.email != usuario.email:
        existente = await auth_service.obter_usuario_por_email(db, dados.email)
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email já cadastrado por outro usuário",
            )

    if dados.nome is not None:
        usuario.nome = dados.nome
    if dados.email is not None:
        usuario.email = dados.email
    if dados.cargo is not None:
        usuario.cargo = dados.cargo

    await db.commit()
    await db.refresh(usuario)
    return usuario
