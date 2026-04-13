"""
Gerador de Termo de Retirada PDF — MDA - Mimos de Alice
Produz um termo A4 portrait profissional reutilizando o design do certificado.
"""

from __future__ import annotations

import base64
import io
import os
from datetime import datetime, timezone
from decimal import Decimal

import logging

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

from app.services.pdf_service import (
    ACCENT,
    CARD_BG,
    DARK,
    DARK_GRAY,
    LIGHT_GRAY,
    LOGO_PATH,
    MED_GRAY,
    PRIMARY,
    TEXT_BLACK,
    _card_bg,
    _draw_corner_ornaments,
    _fmt_cep,
    _fmt_cpf,
    _fmt_data,
    _fmt_hora,
    _fmt_tel,
    _fmt_valor,
    _lv,
    _section_title,
)


def _wrap_text(text: str, font: str, size: float, max_width: float, cv) -> list[str]:
    """Quebra texto em linhas que caibam na largura máxima."""
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        if cv.stringWidth(test, font, size) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _build_endereco(
    endereco: str,
    numero: str,
    bairro: str,
    cidade: str,
    uf: str,
    cep: str,
) -> str:
    """Monta endereço completo em uma string."""
    parts = []
    if endereco:
        addr = endereco
        if numero:
            addr += f", {numero}"
        parts.append(addr)
    if bairro:
        parts.append(bairro)
    if cidade and uf:
        parts.append(f"{cidade}/{uf}")
    elif cidade:
        parts.append(cidade)
    if cep:
        parts.append(f"CEP: {_fmt_cep(cep)}")
    return " - ".join(parts) if parts else "Não informado"


def _build_texto_termo(
    cliente_nome: str,
    cliente_cpf: str,
    endereco_completo: str,
    cliente_telefone: str = "",
) -> str:
    """Monta o texto formal do termo de retirada."""
    telefone_part = ""
    if cliente_telefone:
        telefone_part = f", telefone {_fmt_tel(cliente_telefone)}"

    return (
        f"Pelo presente termo, eu, {cliente_nome}, "
        f"portador(a) do CPF nº {_fmt_cpf(cliente_cpf)}"
        f"{telefone_part}, "
        f"residente em {endereco_completo}, "
        f"declaro que compareci à loja MDA - Mimos de Alice Joias e "
        f"realizei a retirada do produto abaixo descrito, o qual se "
        f"encontra em perfeitas condições de uso e conservação.\n\n"
        f"Declaro ainda que recebi todas as orientações necessárias "
        f"quanto ao uso, conservação e cuidados com o produto, bem "
        f"como estou ciente dos termos e condições da garantia "
        f"vinculada a esta aquisição.\n\n"
        f"A retirada foi realizada de forma voluntária e em pleno "
        f"acordo entre as partes."
    )


def _build_texto_terceiro(
    cliente_nome: str,
    cliente_cpf: str,
    cliente_telefone: str,
    terceiro_nome: str,
    terceiro_cpf: str,
    terceiro_rg: str = "",
    terceiro_telefone: str = "",
    terceiro_relacao: str = "",
) -> str:
    """Monta o texto completo do termo de retirada por terceiro autorizado."""
    rg_part = f", RG nº {terceiro_rg}" if terceiro_rg else ""
    tel_part = f", telefone {_fmt_tel(terceiro_telefone)}" if terceiro_telefone else ""

    texto = (
        f"Eu, {terceiro_nome}, portador(a) do CPF nº {_fmt_cpf(terceiro_cpf)}"
        f"{rg_part}{tel_part}, "
        f"declaro que fui devidamente autorizado(a) pelo(a) Sr(a). "
        f"{cliente_nome}, titular da compra, a comparecer à loja "
        f"MDA - Mimos de Alice Joias e realizar a retirada do produto "
        f"abaixo descrito em seu nome.\n\n"
        f"Declaro que o produto se encontra em perfeitas condições de "
        f"uso e conservação, e que recebi todas as orientações necessárias "
        f"quanto ao uso, conservação e cuidados com o mesmo.\n\n"
        f"Assumo total responsabilidade pela guarda e entrega do produto "
        f"ao titular da compra, bem como confirmo que possuo autorização "
        f"expressa para esta retirada.\n\n"
        f"DADOS DO TITULAR DA COMPRA:\n"
        f"Nome: {cliente_nome}\n"
        f"CPF: {_fmt_cpf(cliente_cpf)}\n"
    )
    if cliente_telefone:
        texto += f"Telefone: {_fmt_tel(cliente_telefone)}\n"

    texto += (
        f"\nDADOS DA PESSOA AUTORIZADA:\n"
        f"Nome: {terceiro_nome}\n"
        f"CPF: {_fmt_cpf(terceiro_cpf)}\n"
    )
    if terceiro_rg:
        texto += f"RG: {terceiro_rg}\n"
    if terceiro_telefone:
        texto += f"Telefone: {_fmt_tel(terceiro_telefone)}\n"
    if terceiro_relacao:
        texto += f"Relação com o titular: {terceiro_relacao}\n"

    texto += (
        f"\nA retirada foi realizada de forma voluntária e em pleno "
        f"acordo entre as partes."
    )

    return texto


def gerar_termo_retirada_pdf(
    certificado: str,
    # Cliente
    cliente_nome: str,
    cliente_cpf: str,
    cliente_telefone: str = "",
    cliente_email: str = "",
    cliente_endereco: str = "",
    cliente_numero: str = "",
    cliente_bairro: str = "",
    cliente_cidade: str = "",
    cliente_uf: str = "",
    cliente_cep: str = "",
    # Produto
    produto_nome: str = "",
    produto_categoria: str = "",
    produto_serie: str = "",
    produto_valor: Decimal | float = 0,
    data_compra=None,
    # Retirada
    local_retirada: str = "MDA - Mimos de Alice Joias - Loja Física",
    data_retirada: datetime | None = None,
    operador_nome: str = "",
    # Assinaturas (base64 PNG, sem prefixo data:)
    assinatura_cliente_b64: str | None = None,
    assinatura_operador_b64: str | None = None,
    # Terceiro
    terceiro_nome: str | None = None,
    terceiro_cpf: str | None = None,
    terceiro_rg: str | None = None,
    terceiro_telefone: str | None = None,
    terceiro_relacao: str | None = None,
) -> bytes:
    """Gera Termo de Retirada MDA em PDF A4 portrait. Retorna bytes."""

    is_terceiro = bool(terceiro_nome and terceiro_cpf)

    buf = io.BytesIO()
    cv = canvas.Canvas(buf, pagesize=A4)
    W, H = A4  # 595.27, 841.89
    cv.setTitle(f"Termo de Retirada - {certificado}")
    MID = W / 2

    # Layout constants (mesmos do certificado)
    OUT = 20
    INN = OUT + 8
    CL = INN + 15
    CR = W - INN - 15
    CW = CR - CL
    COL2 = MID + 10
    ROW_H = 15

    now = data_retirada or datetime.now(timezone.utc)

    endereco_completo = _build_endereco(
        cliente_endereco, cliente_numero, cliente_bairro,
        cliente_cidade, cliente_uf, cliente_cep,
    )

    # ─── BORDERS ───
    cv.setStrokeColor(PRIMARY)
    cv.setLineWidth(2.5)
    cv.rect(OUT, OUT, W - 2 * OUT, H - 2 * OUT)

    cv.setStrokeColor(ACCENT)
    cv.setLineWidth(0.5)
    cv.rect(INN, INN, W - 2 * INN, H - 2 * INN)

    _draw_corner_ornaments(cv, OUT, INN, W, H)

    # ─── HEADER ───
    y = H - INN - 10

    if os.path.exists(LOGO_PATH):
        logo_img = ImageReader(LOGO_PATH)
        iw, ih = logo_img.getSize()
        logo_w = 140
        logo_h = logo_w * ih / iw
        logo_x = MID - logo_w / 2
        logo_y = y - logo_h
        cv.drawImage(LOGO_PATH, logo_x, logo_y, width=logo_w, height=logo_h, mask="auto")
        y = logo_y - 6
    else:
        cv.setFont("Helvetica-Bold", 28)
        cv.setFillColor(PRIMARY)
        cv.drawCentredString(MID, y - 30, "MDA")
        y -= 50

    # Subheader
    cv.setFont("Helvetica", 7)
    cv.setFillColor(MED_GRAY)
    cv.drawCentredString(MID, y, "www.mimosdealicejoias.com.br")
    y -= 14

    # Pink line
    cv.setStrokeColor(PRIMARY)
    cv.setLineWidth(2)
    cv.line(MID - 80, y, MID + 80, y)

    # Title
    y -= 22
    cv.setFillColor(DARK)
    cv.setFont("Helvetica-Bold", 16)
    if is_terceiro:
        cv.setFont("Helvetica-Bold", 13)
        cv.drawCentredString(MID, y, "TERMO DE RETIRADA DE PRODUTO")
        y -= 16
        cv.setFont("Helvetica-Bold", 11)
        cv.setFillColor(HexColor("#B45309"))
        cv.drawCentredString(MID, y, "POR TERCEIRO AUTORIZADO")
        cv.setFillColor(DARK)
    else:
        cv.drawCentredString(MID, y, "TERMO DE RETIRADA DE PRODUTO")

    y -= 10
    cv.setStrokeColor(LIGHT_GRAY)
    cv.setLineWidth(0.5)
    cv.line(CL + 30, y, CR - 30, y)

    # ─── TEXTO DO TERMO ───
    y -= 18
    if is_terceiro:
        texto = _build_texto_terceiro(
            cliente_nome,
            cliente_cpf,
            cliente_telefone,
            terceiro_nome,
            terceiro_cpf,
            terceiro_rg or "",
            terceiro_telefone or "",
            terceiro_relacao or "",
        )
    else:
        texto = _build_texto_termo(
            cliente_nome, cliente_cpf, endereco_completo, cliente_telefone,
        )

    cv.setFont("Helvetica", 8.5)
    cv.setFillColor(TEXT_BLACK)

    for paragrafo in texto.split("\n\n"):
        for sub_line in paragrafo.strip().split("\n"):
            # Render section headers in bold
            if sub_line.startswith("DADOS DO TITULAR") or sub_line.startswith("DADOS DA PESSOA"):
                cv.setFont("Helvetica-Bold", 8.5)
                cv.setFillColor(DARK)
                cv.drawString(CL, y, sub_line)
                cv.setFont("Helvetica", 8.5)
                cv.setFillColor(TEXT_BLACK)
                y -= 13
            else:
                lines = _wrap_text(sub_line.strip(), "Helvetica", 8.5, CW, cv)
                for line in lines:
                    cv.drawString(CL, y, line)
                    y -= 12
        y -= 4  # espaço entre parágrafos

    # ─── DADOS DO PRODUTO ───
    y -= 6
    y = _section_title(cv, "DADOS DO PRODUTO", CL, y)

    card_h = 4 * ROW_H + 10
    _card_bg(cv, CL, y - card_h, CW, card_h, CARD_BG)

    row_y = y - 14
    _lv(cv, "Produto: ", produto_nome, CL + 8, row_y)
    _lv(cv, "Categoria: ", produto_categoria, COL2, row_y)
    row_y -= ROW_H
    _lv(cv, "Nº de Série: ", produto_serie or "N/A", CL + 8, row_y)
    _lv(cv, "Valor: ", _fmt_valor(produto_valor), COL2, row_y)
    row_y -= ROW_H
    _lv(cv, "Data da Compra: ", _fmt_data(data_compra), CL + 8, row_y)
    _lv(cv, "Nº Certificado: ", certificado, COL2, row_y)

    y = y - card_h - 10

    # ─── DADOS DA RETIRADA ───
    y = _section_title(cv, "DADOS DA RETIRADA", CL, y)

    card_h = 3 * ROW_H + 6
    _card_bg(cv, CL, y - card_h, CW, card_h, CARD_BG)

    row_y = y - 14
    _lv(cv, "Data: ", _fmt_data(now), CL + 8, row_y)
    _lv(cv, "Horário: ", _fmt_hora(now), COL2, row_y)
    row_y -= ROW_H
    _lv(cv, "Local: ", local_retirada, CL + 8, row_y)

    y = y - card_h - 14

    # ─── ASSINATURAS ───
    y = _section_title(cv, "ASSINATURAS", CL, y)

    sig_w = (CW - 30) / 2
    sig_h = 70
    sig_left_x = CL
    sig_right_x = CL + sig_w + 30

    # Background boxes
    SIG_BG = HexColor("#FAFAFA")
    _card_bg(cv, sig_left_x, y - sig_h - 40, sig_w, sig_h + 40, SIG_BG)
    _card_bg(cv, sig_right_x, y - sig_h - 40, sig_w, sig_h + 40, SIG_BG)

    # Assinatura lado esquerdo (cliente ou terceiro)
    sig_img_y = y - sig_h - 4
    if assinatura_cliente_b64:
        try:
            sig_bytes = base64.b64decode(assinatura_cliente_b64)
            sig_reader = ImageReader(io.BytesIO(sig_bytes))
            cv.drawImage(
                sig_reader,
                sig_left_x + 10,
                sig_img_y + 4,
                width=sig_w - 20,
                height=sig_h - 8,
                mask="auto",
                preserveAspectRatio=True,
                anchor="c",
            )
        except Exception:
            logger.warning("Erro ao desenhar assinatura do cliente no PDF", exc_info=True)

    # Linha e nome (cliente ou terceiro)
    line_y = sig_img_y - 4
    cv.setStrokeColor(DARK_GRAY)
    cv.setLineWidth(0.6)
    cv.line(sig_left_x + 10, line_y, sig_left_x + sig_w - 10, line_y)

    cv.setFont("Helvetica-Bold", 8)
    cv.setFillColor(DARK)
    left_signer_name = terceiro_nome if is_terceiro else cliente_nome
    cv.drawCentredString(sig_left_x + sig_w / 2, line_y - 12, left_signer_name)

    cv.setFont("Helvetica", 7)
    cv.setFillColor(MED_GRAY)
    if is_terceiro:
        cv.drawCentredString(
            sig_left_x + sig_w / 2, line_y - 22,
            f"CPF: {_fmt_cpf(terceiro_cpf)}",
        )
        cv.drawCentredString(
            sig_left_x + sig_w / 2, line_y - 31,
            "(Pessoa Autorizada)",
        )
    else:
        cv.drawCentredString(
            sig_left_x + sig_w / 2, line_y - 22,
            f"CPF: {_fmt_cpf(cliente_cpf)}",
        )

    # Assinatura do operador
    if assinatura_operador_b64:
        try:
            sig_bytes = base64.b64decode(assinatura_operador_b64)
            sig_reader = ImageReader(io.BytesIO(sig_bytes))
            cv.drawImage(
                sig_reader,
                sig_right_x + 10,
                sig_img_y + 4,
                width=sig_w - 20,
                height=sig_h - 8,
                mask="auto",
                preserveAspectRatio=True,
                anchor="c",
            )
        except Exception:
            logger.warning("Erro ao desenhar assinatura do operador no PDF", exc_info=True)

    # Linha e nome do operador
    cv.setStrokeColor(DARK_GRAY)
    cv.setLineWidth(0.6)
    cv.line(sig_right_x + 10, line_y, sig_right_x + sig_w - 10, line_y)

    cv.setFont("Helvetica-Bold", 8)
    cv.setFillColor(DARK)
    cv.drawCentredString(
        sig_right_x + sig_w / 2, line_y - 12, operador_nome or "Operador(a) Responsável"
    )

    cv.setFont("Helvetica", 7)
    cv.setFillColor(MED_GRAY)
    cv.drawCentredString(
        sig_right_x + sig_w / 2, line_y - 22, "MDA - Mimos de Alice Joias"
    )

    y = y - sig_h - 40 - 14

    # ─── FOOTER ───
    footer_y = OUT + 12

    # Pink separator
    cv.setStrokeColor(PRIMARY)
    cv.setLineWidth(1)
    cv.line(CL, footer_y + 44, CR, footer_y + 44)

    # Disclaimer
    cv.setFont("Helvetica", 6.5)
    cv.setFillColor(MED_GRAY)
    cv.drawCentredString(
        MID,
        footer_y + 32,
        "Este documento é parte integrante do processo de venda e retirada de produto da MDA - Mimos de Alice Joias.",
    )
    cv.drawCentredString(
        MID,
        footer_y + 22,
        f"Documento gerado eletronicamente em {_fmt_data(now)} às {_fmt_hora(now)}.",
    )

    # Brand
    cv.setFont("Helvetica-Bold", 7)
    cv.setFillColor(PRIMARY)
    cv.drawCentredString(MID, footer_y + 8, "MDA - Mimos de Alice Joias")

    cv.setFont("Helvetica", 6.5)
    cv.setFillColor(LIGHT_GRAY)
    cv.drawCentredString(MID, footer_y, "www.mimosdealicejoias.com.br")

    # ─── SAVE ───
    cv.showPage()
    cv.save()
    return buf.getvalue()
