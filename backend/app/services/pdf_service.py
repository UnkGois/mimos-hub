"""
Gerador de Certificado PDF — MDA - Mimos de Alice
Produz um certificado A4 portrait profissional usando reportlab.
"""

from __future__ import annotations

import io
import math
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

# Timezone de Brasília
TZ_BRASILIA = ZoneInfo("America/Sao_Paulo")

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Logo path
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
LOGO_PATH = os.path.join(_ASSETS_DIR, "logo_rosa.png")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Brand Colors
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIMARY = HexColor("#E05297")
ACCENT = HexColor("#FF85A1")
DARK = HexColor("#212121")
DARK_GRAY = HexColor("#444444")
MED_GRAY = HexColor("#888888")
LIGHT_GRAY = HexColor("#BBBBBB")
TEXT_BLACK = HexColor("#222222")
CARD_BG = HexColor("#FFF5F7")
GARANTIA_BG = HexColor("#FFF0F3")
CHECK_GREEN = HexColor("#2D8B4E")
CROSS_RED = HexColor("#C0392B")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Coberturas por Categoria
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COBERTURAS_POR_CATEGORIA: dict[str, dict[str, list[str]]] = {
    "Joias": {
        "cobre": [
            "Defeitos de fabricação em soldas, fechos e engastes (07 dias)",
            "Problemas no banho de ouro, prata ou ródio aplicado de fábrica",
            "Pedras que se soltam devido a falha no engaste original (07 dias)",
            "Deformações estruturais não causadas por impacto externo (07 dias)",
            "Oxidação anormal do metal dentro do período de garantia",
        ],
        "nao_cobre": [
            "Desgaste natural do banho por uso contínuo (perfumes, cremes, suor)",
            "Riscos, amassados ou deformações causadas por impacto",
            "Perda ou roubo da peça",
            "Alterações feitas por ourives ou joalheiros não autorizados",
            "Manchas causadas por contato com produtos químicos",
            "Redimensionamento ou ajuste de tamanho feito por terceiros",
        ],
    },
    "Eletrônicos": {
        "cobre": [
            "Defeitos de fabricação em componentes eletrônicos",
            "Mau funcionamento sob condições normais de uso",
            "Falhas em tela, bateria ou placa-mãe de origem fabril",
            "Problemas de software pré-instalado de fábrica",
            "Vícios ocultos que comprometam o funcionamento",
        ],
        "nao_cobre": [
            "Danos causados por mau uso, quedas ou líquidos",
            "Desgaste natural da bateria ao longo do tempo",
            "Instalação de software não autorizado ou modificações",
            "Danos por variação de energia sem uso de proteção adequada",
            "Telas trincadas ou quebradas por impacto",
            "Uso do aparelho em desacordo com o manual",
        ],
    },
    "Eletrodomésticos": {
        "cobre": [
            "Defeitos de fabricação em materiais e componentes",
            "Mau funcionamento sob condições normais de uso",
            "Falhas no motor, compressor ou sistema elétrico de fábrica",
            "Peças internas com defeito prematuro",
            "Problemas elétricos de origem fabril",
        ],
        "nao_cobre": [
            "Danos causados por mau uso ou negligência",
            "Desgaste natural de peças consumíveis (filtros, borrachas, lâmpadas)",
            "Danos por variação de energia sem proteção",
            "Instalação inadequada ou fora das especificações",
            "Modificações ou reparos feitos por técnicos não autorizados",
            "Uso em voltagem incorreta",
        ],
    },
    "Móveis": {
        "cobre": [
            "Defeitos de fabricação em estrutura, acabamento e mecanismos",
            "Problemas em dobradiças, trilhos e sistemas retráteis de fábrica",
            "Descolamento de revestimento por falha na fabricação",
            "Peças que apresentam trincas sem causa externa",
            "Vícios ocultos na estrutura interna",
        ],
        "nao_cobre": [
            "Desgaste natural do estofado, tecido ou couro pelo uso",
            "Manchas causadas por líquidos, alimentos ou produtos químicos",
            "Danos por exposição direta ao sol ou umidade excessiva",
            "Riscos ou marcas causadas por objetos ou animais",
            "Danos por montagem incorreta ou feita por terceiros",
            "Alterações de cor naturais dos materiais ao longo do tempo",
        ],
    },
    "Informática": {
        "cobre": [
            "Defeitos de fabricação em hardware e componentes",
            "Falhas em processador, memória, disco ou placa-mãe de fábrica",
            "Mau funcionamento de teclado, trackpad ou portas de conexão",
            "Problemas no sistema operacional original de fábrica",
            "Pixels mortos acima do limite aceitável pelo fabricante",
        ],
        "nao_cobre": [
            "Danos por vírus, malware ou software instalado pelo usuário",
            "Danos físicos por quedas, líquidos ou impacto",
            "Desgaste natural da bateria",
            "Perda de dados armazenados no equipamento",
            "Modificações de hardware não autorizadas",
            "Uso em condições ambientais inadequadas",
        ],
    },
    "Celulares": {
        "cobre": [
            "Defeitos de fabricação em tela, bateria e placa principal",
            "Mau funcionamento de câmera, alto-falante ou microfone",
            "Falhas no sistema operacional original de fábrica",
            "Problemas de conectividade (Wi-Fi, Bluetooth) de origem",
            "Botões físicos com defeito de fabricação",
        ],
        "nao_cobre": [
            "Tela trincada ou quebrada por queda ou impacto",
            "Danos por contato com líquidos",
            "Desgaste natural da bateria com o tempo",
            "Problemas causados por root, jailbreak ou ROMs customizadas",
            "Danos por uso de carregadores não originais",
            "Riscos e desgaste estético do uso normal",
        ],
    },
}

_COBERTURA_GENERICA: dict[str, list[str]] = {
    "cobre": [
        "Defeitos de fabricação em materiais e componentes",
        "Mau funcionamento sob condições normais de uso",
        "Peças e componentes com falha prematura",
        "Problemas elétricos ou mecânicos de origem fabril",
        "Vícios ocultos que comprometam o funcionamento",
    ],
    "nao_cobre": [
        "Danos causados por mau uso, negligência ou acidentes",
        "Desgaste natural decorrente do uso regular",
        "Modificações ou reparos feitos por terceiros não autorizados",
        "Danos por fenômenos da natureza (enchentes, raios, etc.)",
        "Uso do produto em desacordo com o manual de instruções",
        "Danos estéticos como riscos, manchas ou amassados",
    ],
}


def _obter_coberturas(categoria: str) -> dict[str, list[str]]:
    """Retorna cobre/nao_cobre para a categoria. Fallback genérico."""
    return COBERTURAS_POR_CATEGORIA.get(categoria, _COBERTURA_GENERICA)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Formatters
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _fmt_cpf(cpf: str) -> str:
    d = (cpf or "").replace(".", "").replace("-", "").replace(" ", "")
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}" if len(d) == 11 else cpf or "—"


def _fmt_tel(tel: str) -> str:
    d = (tel or "").replace("(", "").replace(")", "").replace("-", "").replace(" ", "")
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return tel or "—"


def _fmt_cep(cep: str) -> str:
    d = (cep or "").replace("-", "").replace(" ", "")
    return f"{d[:5]}-{d[5:]}" if len(d) == 8 else cep or ""


def _to_brasilia(dt: datetime) -> datetime:
    """Converte datetime para horário de Brasília."""
    if dt.tzinfo is None:
        # Naive datetime — assume que é UTC
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TZ_BRASILIA)


def _fmt_data(d) -> str:
    if isinstance(d, datetime):
        d = _to_brasilia(d)
        return d.strftime("%d/%m/%Y")
    if isinstance(d, date):
        return d.strftime("%d/%m/%Y")
    return str(d) if d else "—"


def _fmt_hora(dt) -> str:
    if isinstance(dt, datetime):
        dt = _to_brasilia(dt)
        return dt.strftime("%H:%M")
    return ""


def _fmt_valor(v) -> str:
    try:
        val = float(v or 0)
        s = f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return f"R$ {s}"
    except (ValueError, TypeError):
        return f"R$ {v}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Drawing Helpers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _draw_corner_ornaments(cv, outer, inner, W, H):
    """Decorative crossed lines (X) at 4 corners, between the two borders."""
    cv.saveState()
    cv.setStrokeColor(PRIMARY)
    cv.setLineWidth(1.2)
    arm = 10
    mid = (outer + inner) / 2
    for cx, cy in [
        (mid, H - mid),
        (W - mid, H - mid),
        (mid, mid),
        (W - mid, mid),
    ]:
        cv.line(cx - arm, cy - arm, cx + arm, cy + arm)
        cv.line(cx - arm, cy + arm, cx + arm, cy - arm)
    cv.restoreState()


def _section_title(cv, title, x, y):
    """Section title with a small pink accent line beside it. Returns new y."""
    cv.setFont("Helvetica-Bold", 10)
    cv.setFillColor(DARK)
    cv.drawString(x, y, title)
    tw = cv.stringWidth(title, "Helvetica-Bold", 10)
    cv.setStrokeColor(PRIMARY)
    cv.setLineWidth(0.8)
    cv.line(x + tw + 8, y + 4, x + tw + 48, y + 4)
    return y - 16


def _card_bg(cv, x, y, w, h, color, border_color=None):
    """Filled rounded rectangle for card background."""
    cv.setFillColor(color)
    if border_color:
        cv.setStrokeColor(border_color)
        cv.setLineWidth(0.8)
        cv.roundRect(x, y, w, h, 6, fill=1, stroke=1)
    else:
        cv.roundRect(x, y, w, h, 6, fill=1, stroke=0)


def _lv(cv, label, value, x, y):
    """Label (bold dark gray) + value (regular black)."""
    cv.setFont("Helvetica-Bold", 9)
    cv.setFillColor(DARK_GRAY)
    cv.drawString(x, y, label)
    lw = cv.stringWidth(label, "Helvetica-Bold", 9)
    cv.setFont("Helvetica", 9)
    cv.setFillColor(TEXT_BLACK)
    cv.drawString(x + lw + 4, y, str(value) if value else "—")


def _draw_check(cv, x, y):
    """Draw a check mark at (x, y) using green stroked path."""
    cv.saveState()
    cv.setStrokeColor(CHECK_GREEN)
    cv.setLineWidth(1.6)
    cv.setLineCap(1)
    p = cv.beginPath()
    p.moveTo(x, y + 3)
    p.lineTo(x + 3, y)
    p.lineTo(x + 8, y + 6)
    cv.drawPath(p, stroke=1, fill=0)
    cv.restoreState()


def _draw_cross(cv, x, y):
    """Draw a cross mark at (x, y) using red stroked lines."""
    cv.saveState()
    cv.setStrokeColor(CROSS_RED)
    cv.setLineWidth(1.6)
    cv.setLineCap(1)
    cv.line(x, y, x + 7, y + 7)
    cv.line(x, y + 7, x + 7, y)
    cv.restoreState()


def _draw_star(cv, cx, cy, r=4.5):
    """Draw a filled 5-pointed star in primary color."""
    cv.saveState()
    cv.setFillColor(PRIMARY)
    p = cv.beginPath()
    for i in range(10):
        angle = math.radians(90 + i * 36)
        radius = r if i % 2 == 0 else r * 0.4
        sx = cx + radius * math.cos(angle)
        sy = cy + radius * math.sin(angle)
        if i == 0:
            p.moveTo(sx, sy)
        else:
            p.lineTo(sx, sy)
    p.close()
    cv.drawPath(p, fill=1, stroke=0)
    cv.restoreState()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main Generator
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def gerar_certificado_pdf(
    certificado: str,
    # Cliente
    cliente_nome: str,
    cliente_cpf: str,
    cliente_nascimento: date | None = None,
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
    produto_loja: str = "",
    data_compra: date | None = None,
    # Garantia
    tipo_garantia: str = "Universal",
    periodo_meses: int = 0,
    data_inicio: date | None = None,
    data_termino: date | None = None,
    # Meta
    operador_nome: str = "",
    data_emissao: datetime | None = None,
) -> bytes:
    """Gera certificado de garantia MDA em PDF A4 portrait. Retorna bytes."""

    buf = io.BytesIO()
    cv = canvas.Canvas(buf, pagesize=A4)
    W, H = A4  # 595.27, 841.89
    cv.setTitle(f"Certificado {certificado}")
    MID = W / 2

    # Layout constants
    OUT = 20              # outer border margin
    INN = OUT + 8         # inner border margin
    CL = INN + 15         # content left
    CR = W - INN - 15     # content right
    CW = CR - CL          # content width
    COL2 = MID + 10       # second column start
    ROW_H = 15            # row spacing inside cards

    # ─────────────────────────────────────
    # BORDERS
    # ─────────────────────────────────────
    cv.setStrokeColor(PRIMARY)
    cv.setLineWidth(2.5)
    cv.rect(OUT, OUT, W - 2 * OUT, H - 2 * OUT)

    cv.setStrokeColor(ACCENT)
    cv.setLineWidth(0.5)
    cv.rect(INN, INN, W - 2 * INN, H - 2 * INN)

    _draw_corner_ornaments(cv, OUT, INN, W, H)

    # ─────────────────────────────────────
    # HEADER — Logo image + título
    # ─────────────────────────────────────
    y = H - INN - 10

    # Draw real logo image (centered)
    if os.path.exists(LOGO_PATH):
        logo_img = ImageReader(LOGO_PATH)
        iw, ih = logo_img.getSize()  # 600x316 original
        logo_w = 180  # display width in points
        logo_h = logo_w * ih / iw
        logo_x = MID - logo_w / 2
        logo_y = y - logo_h
        cv.drawImage(LOGO_PATH, logo_x, logo_y, width=logo_w, height=logo_h, mask="auto")
        y = logo_y - 10
    else:
        # Fallback: text header
        cv.setFont("Helvetica-Bold", 36)
        cv.setFillColor(PRIMARY)
        cv.drawCentredString(MID, y - 40, "MDA")
        y -= 60

    # Decorative pink line
    cv.setStrokeColor(PRIMARY)
    cv.setLineWidth(2)
    cv.line(MID - 90, y, MID + 90, y)

    # "CERTIFICADO DE GARANTIA"
    y -= 26
    cv.setFillColor(DARK)
    cv.setFont("Helvetica-Bold", 18)
    cv.drawCentredString(MID, y, "CERTIFICADO DE GARANTIA")

    # Thin gray separator
    y -= 12
    cv.setStrokeColor(LIGHT_GRAY)
    cv.setLineWidth(0.5)
    cv.line(CL + 40, y, CR - 40, y)

    # ─────────────────────────────────────
    # MENSAGEM DE AGRADECIMENTO
    # ─────────────────────────────────────
    y -= 20
    agradecimento = [
        "Agradecemos imensamente por ter escolhido nossos serviços!",
        "É com muito carinho e dedicação que emitimos este certificado",
        "de garantia, reafirmando nosso compromisso com a qualidade",
        "e a sua total satisfação. Tenha a certeza de que estamos",
        "aqui para cuidar de você e do seu produto.",
    ]
    cv.setFont("Helvetica-Oblique", 10)
    cv.setFillColor(DARK_GRAY)
    for ln in agradecimento:
        cv.drawCentredString(MID, y, ln)
        y -= 14.5

    # ─────────────────────────────────────
    # DADOS DO CLIENTE
    # ─────────────────────────────────────
    y -= 8
    y = _section_title(cv, "DADOS DO CLIENTE", CL, y)

    card_top = y + 4
    card_h = 72
    card_y = card_top - card_h
    _card_bg(cv, CL - 8, card_y, CW + 16, card_h, CARD_BG)

    ry = card_top - 14
    _lv(cv, "Nome:", cliente_nome, CL, ry)
    _lv(cv, "E-mail:", cliente_email or "Não informado", COL2, ry)
    ry -= ROW_H
    _lv(cv, "CPF:", _fmt_cpf(cliente_cpf), CL, ry)
    end_txt = f"{cliente_endereco}, Nº {cliente_numero}" if cliente_endereco else "Não informado"
    _lv(cv, "Endereço:", end_txt, COL2, ry)
    ry -= ROW_H
    _lv(cv, "Data de Nascimento:", _fmt_data(cliente_nascimento), CL, ry)
    _lv(cv, "Bairro:", cliente_bairro or "Não informado", COL2, ry)
    ry -= ROW_H
    _lv(cv, "Telefone:", _fmt_tel(cliente_telefone), CL, ry)
    cidade_uf = ""
    if cliente_cidade:
        cidade_uf = f"{cliente_cidade}/{cliente_uf}" if cliente_uf else cliente_cidade
        if cliente_cep:
            cidade_uf += f" - CEP: {_fmt_cep(cliente_cep)}"
    _lv(cv, "Cidade/UF:", cidade_uf or "Não informado", COL2, ry)

    y = card_y - 12

    # ─────────────────────────────────────
    # DADOS DO PRODUTO
    # ─────────────────────────────────────
    y = _section_title(cv, "DADOS DO PRODUTO", CL, y)

    card_top = y + 4
    card_h = 58
    card_y = card_top - card_h
    _card_bg(cv, CL - 8, card_y, CW + 16, card_h, CARD_BG)

    ry = card_top - 14
    _lv(cv, "Produto:", produto_nome, CL, ry)
    _lv(cv, "Valor:", _fmt_valor(produto_valor), COL2, ry)
    ry -= ROW_H
    _lv(cv, "Categoria:", produto_categoria, CL, ry)
    _lv(cv, "Local de Compra:", produto_loja, COL2, ry)
    ry -= ROW_H
    _lv(cv, "Nº de Série:", produto_serie or "Não informado", CL, ry)
    _lv(cv, "Data da Compra:", _fmt_data(data_compra), COL2, ry)

    y = card_y - 12

    # ─────────────────────────────────────
    # DADOS DA GARANTIA (destaque)
    # ─────────────────────────────────────
    y = _section_title(cv, "DADOS DA GARANTIA", CL, y)

    card_top = y + 4
    card_h = 62
    card_y = card_top - card_h
    _card_bg(cv, CL - 8, card_y, CW + 16, card_h, GARANTIA_BG, border_color=PRIMARY)

    # Certificate number centered
    ry = card_top - 18
    cv.setFillColor(DARK)
    cv.setFont("Helvetica-Bold", 14)
    cv.drawCentredString(MID, ry, f"Nº {certificado}")

    # 3-column grid
    ry -= 24
    col_w = CW / 3
    cols = [CL, CL + col_w, CL + 2 * col_w]

    # Col 1 — Tipo (with star)
    cv.setFont("Helvetica", 8)
    cv.setFillColor(MED_GRAY)
    cv.drawCentredString(cols[0] + col_w / 2, ry + 12, "Tipo")
    tipo_txt = tipo_garantia
    tipo_w = cv.stringWidth(tipo_txt, "Helvetica-Bold", 10)
    tipo_x = cols[0] + col_w / 2 - tipo_w / 2
    _draw_star(cv, tipo_x - 8, ry + 4, r=4)
    cv.setFillColor(DARK)
    cv.setFont("Helvetica-Bold", 10)
    cv.drawString(tipo_x, ry, tipo_txt)

    # Col 2 — Período
    cv.setFont("Helvetica", 8)
    cv.setFillColor(MED_GRAY)
    cv.drawCentredString(cols[1] + col_w / 2, ry + 12, "Período")
    cv.setFont("Helvetica-Bold", 10)
    cv.setFillColor(DARK)
    cv.drawCentredString(cols[1] + col_w / 2, ry, f"{periodo_meses} meses")

    # Col 3 — Vigência
    cv.setFont("Helvetica", 8)
    cv.setFillColor(MED_GRAY)
    cv.drawCentredString(cols[2] + col_w / 2, ry + 12, "Vigência")
    cv.setFont("Helvetica-Bold", 10)
    cv.setFillColor(DARK)
    cv.drawCentredString(
        cols[2] + col_w / 2, ry,
        f"{_fmt_data(data_inicio)} a {_fmt_data(data_termino)}",
    )

    y = card_y - 14

    # ─────────────────────────────────────
    # O QUE ESTA GARANTIA COBRE / NÃO COBRE
    # (dinâmico por categoria do produto)
    # ─────────────────────────────────────
    coberturas = _obter_coberturas(produto_categoria)

    y = _section_title(cv, "O QUE ESTA GARANTIA COBRE", CL, y)
    y -= 2
    for item in coberturas["cobre"]:
        _draw_check(cv, CL, y - 1)
        cv.setFont("Helvetica", 9)
        cv.setFillColor(DARK_GRAY)
        cv.drawString(CL + 14, y, item)
        y -= 13

    y -= 6

    y = _section_title(cv, "O QUE ESTA GARANTIA NÃO COBRE", CL, y)
    y -= 2
    for item in coberturas["nao_cobre"]:
        _draw_cross(cv, CL, y - 1)
        cv.setFont("Helvetica", 9)
        cv.setFillColor(DARK_GRAY)
        cv.drawString(CL + 14, y, item)
        y -= 13

    y -= 8

    # ─────────────────────────────────────
    # FOOTER
    # ─────────────────────────────────────
    # Pink separator
    cv.setStrokeColor(PRIMARY)
    cv.setLineWidth(1)
    cv.line(CL, y, CR, y)

    y -= 14
    emissao = data_emissao or datetime.now(timezone.utc)
    cv.setFont("Helvetica", 8)
    cv.setFillColor(MED_GRAY)
    cv.drawString(CL, y, f"Emitido em: {_fmt_data(emissao)} às {_fmt_hora(emissao)}")
    if operador_nome:
        cv.drawRightString(CR, y, f"Operador: {operador_nome}")

    y -= 20
    disclaimer = [
        "Este documento é um certificado oficial de garantia emitido pelo sistema MDA - Mimos de Alice.",
        "Para validação, consulte o número do certificado em nosso sistema ou entre em contato conosco.",
    ]
    cv.setFont("Helvetica-Oblique", 7)
    cv.setFillColor(LIGHT_GRAY)
    for ln in disclaimer:
        cv.drawCentredString(MID, y, ln)
        y -= 10

    y -= 6
    cv.setFont("Helvetica-Bold", 8)
    cv.setFillColor(DARK)
    cv.drawCentredString(MID, y, "MDA - Mimos de Alice Joias")

    y -= 12
    cv.setFont("Helvetica", 8)
    cv.setFillColor(PRIMARY)
    cv.drawCentredString(MID, y, "www.mimosdealicejoias.com.br")

    # Finalize
    cv.save()
    buf.seek(0)
    return buf.read()
