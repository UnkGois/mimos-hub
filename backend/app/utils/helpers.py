import secrets
import string


def gerar_numero_certificado(ano: int, sequencial: int) -> str:
    """Gera número do certificado: MDA-{ANO}-{SEQ 6 dígitos}"""
    return f"MDA-{ano}-{str(sequencial).zfill(6)}"


def gerar_codigo_cupom() -> str:
    """Gera código do cupom: MDA-DESC-{6 chars alfanuméricos}"""
    chars = string.ascii_uppercase + string.digits
    code = "".join(secrets.choice(chars) for _ in range(6))
    return f"MDA-DESC-{code}"


def calcular_desconto(total_compras: int) -> int:
    """
    Retorna percentual de desconto baseado no total de compras.
    2ª compra: 5%, 3ª: 8%, 4ª: 10%, 5ª+: 12%
    """
    if total_compras < 2:
        return 0
    if total_compras == 2:
        return 5
    if total_compras == 3:
        return 8
    if total_compras == 4:
        return 10
    return 12
