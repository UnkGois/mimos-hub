from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class ConfiguracaoUpdate(BaseModel):
    empresa: Optional[dict[str, Any]] = None
    categorias: Optional[list[str]] = None
    tipos_banho: Optional[list[dict[str, Any]]] = None
    alerta_estoque: Optional[dict[str, Any]] = None
    taxas_padrao: Optional[dict[str, Any]] = None
    pix: Optional[dict[str, Any]] = None


class ConfiguracaoResponse(BaseModel):
    empresa: dict[str, Any]
    categorias: list[str]
    tipos_banho: list[dict[str, Any]]
    alerta_estoque: dict[str, Any]
    taxas_padrao: dict[str, Any]
    pix: dict[str, Any] = {}
