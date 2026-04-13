from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ─── Banco de Dados ───
    DATABASE_URL: str

    # ─── JWT / Autenticação ───
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # ─── Segurança ───
    REGISTRATION_SECRET_KEY: str = ""  # Chave para proteger endpoint de registro
    FORCE_HTTPS: bool = False  # Redirecionar HTTP → HTTPS em produção

    # ─── Usuário Padrão (seed) ───
    DEFAULT_USER_EMAIL: str = "admin@mimosdealicejoias.com.br"
    DEFAULT_USER_PASSWORD: str = "changeme123"  # Trocar em produção!
    DEFAULT_USER_NAME: str = "Administrador MDA"

    # ─── Z-API (WhatsApp) ───
    ZAPI_INSTANCE_ID: str = ""
    ZAPI_TOKEN: str = ""
    ZAPI_CLIENT_TOKEN: str = ""

    # ─── CORS ───
    CORS_ORIGINS: str = "http://localhost:5173"
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()
