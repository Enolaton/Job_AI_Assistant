# scripts/generate_company_report_pdf.py
import sys
import os
import json
from datetime import datetime
import re
from xml.sax.saxutils import escape as _xe

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, PageBreak,
    )
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
except ImportError:
    print("reportlab is not installed. Run 'pip install reportlab'")
    sys.exit(1)

# 한국어 폰트 등록
FONT_NAME = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

def _register_korean_font():
    global FONT_NAME, FONT_BOLD
    candidates = [
        (r"C:\Windows\Fonts\malgun.ttf", r"C:\Windows\Fonts\malgunbd.ttf", "MalgunGothic"),
        (r"C:\Windows\Fonts\NanumGothic.ttf", r"C:\Windows\Fonts\NanumGothicBold.ttf", "NanumGothic"),
        ("/Library/Fonts/AppleGothic.ttf", "/Library/Fonts/AppleGothic.ttf", "AppleGothic"),
    ]
    for reg, bold, name in candidates:
        if os.path.exists(reg):
            try:
                pdfmetrics.registerFont(TTFont(name, reg))
                if os.path.exists(bold):
                    pdfmetrics.registerFont(TTFont(f"{name}-Bold", bold))
                    FONT_BOLD = f"{name}-Bold"
                else:
                    FONT_BOLD = name
                FONT_NAME = name
                return True
            except: pass
    return False

# 색상
COLOR_PRIMARY = colors.HexColor("#2C3E50")
COLOR_ACCENT = colors.HexColor("#2980B9")
COLOR_LIGHT = colors.HexColor("#ECF0F1")
COLOR_WARNING = colors.HexColor("#E67E22")
COLOR_HEADER_BG = colors.HexColor("#2C3E50")
COLOR_TEXT = colors.HexColor("#2C3E50")
COLOR_SUBTEXT = colors.HexColor("#7F8C8D")

def _t(text):
    return _xe(str(text or ""))

def _strip_md(text):
    if not text: return ""
    # 마크다운 주요 문법(헤더 #, 볼드/이탤릭 *, 인용 >, 구분선 - 등) 제거 로직 강화
    text = re.sub(r"#{1,6}\s?", "", text) # 헤더 제거
    text = re.sub(r"\*+", "", text)      # 볼드/이탤릭 제거
    text = re.sub(r"^\s*>\s?", "", text, flags=re.MULTILINE) # 인용구 제거
    text = re.sub(r"^-{3,}\s?$", "", text, flags=re.MULTILINE) # 구분선 제거
    return text.strip()

def _build_styles():
    return {
        "title": ParagraphStyle("title", fontName=FONT_BOLD, fontSize=23, textColor=colors.white, spaceAfter=4, leading=30),
        "subtitle": ParagraphStyle("subtitle", fontName=FONT_NAME, fontSize=13, textColor=COLOR_LIGHT, spaceAfter=2, leading=17),
        "h1": ParagraphStyle("h1", fontName=FONT_BOLD, fontSize=15, textColor=COLOR_PRIMARY, spaceBefore=10, spaceAfter=6, leading=19),
        "h2": ParagraphStyle("h2", fontName=FONT_BOLD, fontSize=12, textColor=COLOR_ACCENT, spaceBefore=8, spaceAfter=4, leading=15),
        "body": ParagraphStyle("body", fontName=FONT_NAME, fontSize=10, textColor=COLOR_TEXT, spaceAfter=4, leading=14),
        "body_small": ParagraphStyle("body_small", fontName=FONT_NAME, fontSize=9, textColor=COLOR_SUBTEXT, spaceAfter=3, leading=12),
        "bullet": ParagraphStyle("bullet", fontName=FONT_NAME, fontSize=10, textColor=COLOR_TEXT, spaceAfter=3, leading=14, leftIndent=10),
        "source": ParagraphStyle("source", fontName=FONT_NAME, fontSize=8.5, textColor=COLOR_SUBTEXT, spaceAfter=2, leading=11),
    }

def _page_header(story, styles, page_num, title, company):
    header = [[
        Paragraph(f"<b>{_t(title)}</b>", styles["h1"]),
        Paragraph(f"<font color='#7F8C8D' size='8'>{_t(company)} | p.{page_num}</font>", styles["body_small"]),
    ]]
    t = Table(header, colWidths=[120*mm, 50*mm])
    t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), COLOR_LIGHT), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("ALIGN", (1,0), (1,0), "RIGHT")]))
    story.append(t)
    story.append(Spacer(1, 5*mm))

def _section_title(story, styles, text):
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_ACCENT))
    story.append(Paragraph(_t(text), styles["h2"]))

def _render_lines(story, text, style):
    for line in (text or "").split("\n"):
        line = _strip_md(line.strip())
        if line: story.append(Paragraph(_t(line), style))

def create_pdf(json_path, out_path):
    _register_korean_font()
    styles = _build_styles()
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    companyName = data.get("companyName", "알 수 없는 기업")
    jobTitle = data.get("jobTitle", "직무 미지정")
    analysis = data.get("analysis") or {}
    dart = data.get("dart") or {}
    news = data.get("news", [])
    
    doc = SimpleDocTemplate(out_path, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=15*mm, bottomMargin=15*mm)
    story = []
    
    # --- 1P: 표지 및 개요 ---
    cover_data = [
        [Paragraph(_t(companyName), styles["title"])],
        [Paragraph(f"{_t(jobTitle)} 분석 리포트", styles["subtitle"])],
        [Paragraph(f"생성일: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles["body_small"])]
    ]
    cover = Table(cover_data, colWidths=[170*mm])
    cover.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), COLOR_HEADER_BG), ("TOPPADDING", (0,0), (-1,-1), 10), ("BOTTOMPADDING", (0,0), (-1,-1), 10), ("LEFTPADDING", (0,0), (-1,-1), 12)]))
    story.append(cover)
    story.append(Spacer(1, 10*mm))
    
    # 기업 핵심 가치 & 인재상
    ideal = analysis.get("인재상", [])
    if ideal:
        _section_title(story, styles, "👤 인재상 및 핵심 가치")
        for item in ideal:
            story.append(Paragraph(f"<b>{_t(item.get('키워드',''))}</b>: {_t(item.get('내용',''))}", styles["bullet"]))
        story.append(Spacer(1, 5*mm))
        
    culture = analysis.get("조직문화", [])
    if culture:
        _section_title(story, styles, "🏢 조직 문화")
        for item in culture:
            story.append(Paragraph(f"<b>{_t(item.get('키워드',''))}</b>: {_t(item.get('내용',''))}", styles["bullet"]))
        story.append(Spacer(1, 5*mm))
    
    # --- 2P: 기업/재무 (DART) ---
    if dart:
        story.append(PageBreak())
        _page_header(story, styles, 2, "💰 재무 및 기업 현황", companyName)
        
        year_label = f" ({dart.get('reportYear')}년 기준)" if dart.get('reportYear') else ""
        if dart.get("business"):
            _section_title(story, styles, f"🏢 사업 개요{year_label}")
            _render_lines(story, dart["business"], styles["body"])
            story.append(Spacer(1, 5*mm))
            
        if dart.get("products"):
            _section_title(story, styles, "📦 주요 제품 / 서비스")
            _render_lines(story, dart["products"], styles["body"])
            story.append(Spacer(1, 5*mm))
            
        if dart.get("financial"):
            _section_title(story, styles, "📈 재무 건전성 및 실적")
            _render_lines(story, dart["financial"], styles["body"])
            story.append(Spacer(1, 5*mm))
            
    # --- 3P: 최신 뉴스 동향 ---
    if news:
        story.append(PageBreak())
        _page_header(story, styles, 3, "📰 최근 동향 (뉴스)", companyName)
        
        _section_title(story, styles, "최신 기업 및 직무 관련 뉴스")
        for idx, n in enumerate(news[:5]):
            story.append(Paragraph(f"<b>[{idx+1}] {_t(_strip_md(n.get('title','')))}</b>", styles["body"]))
            desc = _strip_md(n.get('description',''))
            if desc: story.append(Paragraph(_t(desc), styles["body"]))
            story.append(Paragraph(f"📅 {_t(n.get('pub_date',''))} | 🔗 {_t(n.get('url',''))}", styles["source"]))
            story.append(Spacer(1, 4*mm))
            
    doc.build(story)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generate_company_report_pdf.py <input.json> <output.pdf>")
        sys.exit(1)
        
    in_json = sys.argv[1]
    out_pdf = sys.argv[2]
    create_pdf(in_json, out_pdf)
