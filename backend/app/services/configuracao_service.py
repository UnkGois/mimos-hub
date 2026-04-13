from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.configuracao import Configuracao

DEFAULTS = {
    "empresa": json.dumps({
        "nome": "Mimos de Alice Joias",
        "cnpj": "",
        "endereco": "",
        "telefone": "",
        "email": "",
    }),
    "categorias": json.dumps(["Anel", "Brinco", "Colar", "Pulseira", "Tornozeleira", "Conjunto"]),
    "tipos_banho": json.dumps([
        {"nome": "Ouro 18k", "valorGrama": 0},
        {"nome": "Ródio", "valorGrama": 0},
        {"nome": "Ouro Rosé", "valorGrama": 0},
        {"nome": "Prata", "valorGrama": 0},
        {"nome": "Ouro Branco", "valorGrama": 0},
    ]),
    "alerta_estoque": json.dumps({
        "limiteMinimoPadrao": 5,
        "alertaVisualDashboard": True,
        "alertaEmail": False,
    }),
    "taxas_padrao": json.dumps({
        "lojaFisica": {"imposto": 6, "margem": 100},
        "shopee": {"comissao": 14, "taxaFixa": 4, "freteGratis": True, "comissaoFreteGratis": 20, "imposto": 6, "margem": 80},
        "mercadoLivre": {"tipoAnuncio": "Premium", "comissao": 16, "taxaFixa": 6, "imposto": 6, "margem": 80},
        "amazon": {"comissao": 15, "taxaItem": 0, "assinaturaMensal": 19, "imposto": 6, "margem": 80},
        "tiktok": {"comissao": 6, "taxaItem": 2, "comissaoAfiliado": 0, "imposto": 6, "margem": 80},
    }),
}


async def _get_valor(db: AsyncSession, chave: str) -> str:
    result = await db.execute(select(Configuracao).where(Configuracao.chave == chave))
    config = result.scalar_one_or_none()
    if config:
        return config.valor
    return DEFAULTS.get(chave, "{}")


async def _set_valor(db: AsyncSession, chave: str, valor: str):
    result = await db.execute(select(Configuracao).where(Configuracao.chave == chave))
    config = result.scalar_one_or_none()
    if config:
        config.valor = valor
    else:
        db.add(Configuracao(chave=chave, valor=valor))


async def obter_configuracoes(db: AsyncSession) -> dict:
    return {
        "empresa": json.loads(await _get_valor(db, "empresa")),
        "categorias": json.loads(await _get_valor(db, "categorias")),
        "tipos_banho": json.loads(await _get_valor(db, "tipos_banho")),
        "alerta_estoque": json.loads(await _get_valor(db, "alerta_estoque")),
        "taxas_padrao": json.loads(await _get_valor(db, "taxas_padrao")),
        "pix": json.loads(await _get_valor(db, "pix")),
    }


async def salvar_configuracoes(db: AsyncSession, dados: dict) -> dict:
    if "empresa" in dados and dados["empresa"] is not None:
        await _set_valor(db, "empresa", json.dumps(dados["empresa"]))
    if "categorias" in dados and dados["categorias"] is not None:
        await _set_valor(db, "categorias", json.dumps(dados["categorias"]))
    if "tipos_banho" in dados and dados["tipos_banho"] is not None:
        await _set_valor(db, "tipos_banho", json.dumps(dados["tipos_banho"]))
    if "alerta_estoque" in dados and dados["alerta_estoque"] is not None:
        await _set_valor(db, "alerta_estoque", json.dumps(dados["alerta_estoque"]))
    if "taxas_padrao" in dados and dados["taxas_padrao"] is not None:
        await _set_valor(db, "taxas_padrao", json.dumps(dados["taxas_padrao"]))
    if "pix" in dados and dados["pix"] is not None:
        await _set_valor(db, "pix", json.dumps(dados["pix"]))

    await db.commit()
    return await obter_configuracoes(db)
