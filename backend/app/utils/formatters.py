"""
Helpers de formatação e mascaramento de dados sensíveis.
"""
from __future__ import annotations

import re


def mascarar_cpf(cpf: str | None) -> str:
    """
    Mascara CPF para exibição segura.
    Input: 12345678901 ou 123.456.789-01
    Output: ***.***.789-**
    """
    if not cpf:
        return ""
    # Remove formatação
    cpf_limpo = re.sub(r"\D", "", cpf)
    if len(cpf_limpo) != 11:
        return "***.***.***-**"
    return f"***.***{cpf_limpo[6:9]}.-**"


def mascarar_telefone(telefone: str | None) -> str:
    """
    Mascara telefone para exibição segura.
    Input: 11999998888 ou (11) 99999-8888
    Output: (11) *****-8888
    """
    if not telefone:
        return ""
    # Remove formatação
    tel_limpo = re.sub(r"\D", "", telefone)
    if len(tel_limpo) < 10:
        return "(**) *****-****"
    # Últimos 4 dígitos visíveis
    return f"({tel_limpo[:2]}) *****-{tel_limpo[-4:]}"


def mascarar_email(email: str | None) -> str:
    """
    Mascara email para exibição segura.
    Input: usuario@exemplo.com
    Output: u***o@e***o.com
    """
    if not email or "@" not in email:
        return "***@***.***"
    local, dominio = email.split("@", 1)
    if len(local) <= 2:
        local_masked = local[0] + "***"
    else:
        local_masked = local[0] + "***" + local[-1]

    if "." in dominio:
        nome_dominio, extensao = dominio.rsplit(".", 1)
        if len(nome_dominio) <= 2:
            dominio_masked = nome_dominio[0] + "***." + extensao
        else:
            dominio_masked = nome_dominio[0] + "***" + nome_dominio[-1] + "." + extensao
    else:
        dominio_masked = dominio[0] + "***"

    return f"{local_masked}@{dominio_masked}"


def formatar_cpf(cpf: str | None) -> str:
    """
    Formata CPF para exibição.
    Input: 12345678901
    Output: 123.456.789-01
    """
    if not cpf:
        return ""
    cpf_limpo = re.sub(r"\D", "", cpf)
    if len(cpf_limpo) != 11:
        return cpf
    return f"{cpf_limpo[:3]}.{cpf_limpo[3:6]}.{cpf_limpo[6:9]}-{cpf_limpo[9:]}"


def formatar_telefone(telefone: str | None) -> str:
    """
    Formata telefone para exibição.
    Input: 11999998888
    Output: (11) 99999-8888
    """
    if not telefone:
        return ""
    tel_limpo = re.sub(r"\D", "", telefone)
    if len(tel_limpo) == 11:
        return f"({tel_limpo[:2]}) {tel_limpo[2:7]}-{tel_limpo[7:]}"
    elif len(tel_limpo) == 10:
        return f"({tel_limpo[:2]}) {tel_limpo[2:6]}-{tel_limpo[6:]}"
    return telefone


def formatar_moeda(valor: float | int | None) -> str:
    """
    Formata valor para moeda brasileira.
    Input: 1234.56
    Output: R$ 1.234,56
    """
    if valor is None:
        return "R$ 0,00"
    # Formata com separador de milhar e decimal
    formatado = f"{float(valor):,.2f}"
    # Troca . por X, , por . e X por ,
    formatado = formatado.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatado}"


def limpar_cpf(cpf: str | None) -> str:
    """Remove todos os caracteres não numéricos do CPF."""
    if not cpf:
        return ""
    return re.sub(r"\D", "", cpf)


def limpar_telefone(telefone: str | None) -> str:
    """Remove todos os caracteres não numéricos do telefone."""
    if not telefone:
        return ""
    return re.sub(r"\D", "", telefone)


def formatar_cep(cep: str | None) -> str:
    """
    Formata CEP para exibição.
    Input: 12345678
    Output: 12345-678
    """
    if not cep:
        return ""
    cep_limpo = re.sub(r"\D", "", cep)
    if len(cep_limpo) == 8:
        return f"{cep_limpo[:5]}-{cep_limpo[5:]}"
    return cep


def sanitizar_para_log(dados: dict) -> dict:
    """
    Remove/mascara dados sensíveis de dicionários para logging seguro.
    """
    campos_sensiveis = {
        "senha", "password", "senha_hash", "token", "access_token",
        "secret", "api_key", "authorization", "cpf", "telefone", "email"
    }
    resultado = {}
    for chave, valor in dados.items():
        chave_lower = chave.lower()
        if any(campo in chave_lower for campo in campos_sensiveis):
            if "cpf" in chave_lower and valor:
                resultado[chave] = mascarar_cpf(str(valor))
            elif "email" in chave_lower and valor:
                resultado[chave] = mascarar_email(str(valor))
            elif "telefone" in chave_lower or "phone" in chave_lower and valor:
                resultado[chave] = mascarar_telefone(str(valor))
            else:
                resultado[chave] = "[REDACTED]"
        elif isinstance(valor, dict):
            resultado[chave] = sanitizar_para_log(valor)
        else:
            resultado[chave] = valor
    return resultado
