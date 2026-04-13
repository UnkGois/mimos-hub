from __future__ import annotations

import base64
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

ZAPI_BASE = "https://api.z-api.io/instances"


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Client-Token": settings.ZAPI_CLIENT_TOKEN,
    }


def _formatar_telefone(telefone: str) -> str:
    telefone_limpo = "".join(c for c in telefone if c.isdigit())
    if not telefone_limpo.startswith("55"):
        telefone_limpo = f"55{telefone_limpo}"
    return telefone_limpo


def _base_url() -> str:
    return f"{ZAPI_BASE}/{settings.ZAPI_INSTANCE_ID}/token/{settings.ZAPI_TOKEN}"


async def enviar_mensagem_whatsapp(telefone: str, mensagem: str) -> dict:
    """Envia mensagem de texto via Z-API (WhatsApp Business)."""
    if not settings.ZAPI_INSTANCE_ID or not settings.ZAPI_TOKEN:
        return {"status": "simulado", "mensagem": "Credenciais Z-API não configuradas"}

    url = f"{_base_url()}/send-text"
    payload = {
        "phone": _formatar_telefone(telefone),
        "message": mensagem,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url, json=payload, headers=_headers(), timeout=30
            )
            response.raise_for_status()
            return {"status": "enviado", "dados": response.json()}
    except httpx.HTTPStatusError as e:
        logger.error("WhatsApp send-text HTTP %s: %s", e.response.status_code, e.response.text)
        return {"status": "falha", "erro": f"HTTP {e.response.status_code}"}
    except Exception:
        logger.exception("WhatsApp send-text erro inesperado")
        return {"status": "falha", "erro": "Erro interno ao enviar mensagem"}


async def enviar_documento_whatsapp(
    telefone: str,
    pdf_bytes: bytes,
    filename: str,
    caption: str = "",
) -> dict:
    """Envia documento PDF via Z-API usando base64."""
    if not settings.ZAPI_INSTANCE_ID or not settings.ZAPI_TOKEN:
        return {"status": "simulado", "mensagem": "Credenciais Z-API não configuradas"}

    url = f"{_base_url()}/send-document/pdf"
    # Normalizar: garantir que filename termina com exatamente um .pdf
    if filename.lower().endswith(".pdf"):
        filename = filename[:-4]
    payload = {
        "phone": _formatar_telefone(telefone),
        "document": f"data:application/pdf;base64,{base64.b64encode(pdf_bytes).decode('utf-8')}",
        "fileName": f"{filename}.pdf",
    }
    if caption:
        payload["caption"] = caption

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url, json=payload, headers=_headers(), timeout=60
            )
            response.raise_for_status()
            return {"status": "enviado", "dados": response.json()}
    except httpx.HTTPStatusError as e:
        logger.error("WhatsApp send-document HTTP %s: %s", e.response.status_code, e.response.text)
        return {"status": "falha", "erro": f"HTTP {e.response.status_code}"}
    except Exception:
        logger.exception("WhatsApp send-document erro inesperado")
        return {"status": "falha", "erro": "Erro interno ao enviar documento"}
