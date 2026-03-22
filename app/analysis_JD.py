import os
import sys
import time
import base64
import json
import re
import requests
import zipfile
import io
import pandas as pd
from datetime import datetime, timedelta
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
import urllib3
import warnings
from concurrent.futures import ThreadPoolExecutor

# 경고 메시지 차단
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

from dotenv import load_dotenv
try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.stderr.write("오류: google-genai 라이브러리가 설치되지 않았습니다.\n")

load_dotenv()

# --- 설정 및 경로 ---
# 파일 위치가 app/ 폴더이므로 BASE_DIR은 프로젝트 루트가 됨
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, "dart", "dart_corp_codes.csv")
DART_API_KEY = os.getenv("DART_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# ─────────────────────────────────────────────
# [모듈 1] DART 분석 엔진 (원본 복원 로직)
# ─────────────────────────────────────────────

def clean_company_name(name):
    if not name: return ""
    name = re.sub(r"\(주\)|㈜|주식회사|유한회사|\(유\)", "", name)
    return name.strip()

def match_phase1(company_name):
    if not os.path.exists(CSV_PATH):
        sys.stderr.write(f"경고: 데이터 파일이 없습니다 ({CSV_PATH})\n")
        return None
    try:
        df = pd.read_csv(CSV_PATH, dtype={'corp_code': str})
        cleaned_target = clean_company_name(company_name)
        match = df[df['corp_name'] == cleaned_target]
        if not match.empty: return match.iloc[0]['corp_code']
        match = df[df['corp_name'].str.contains(cleaned_target, na=False)]
        if not match.empty: return match.iloc[0]['corp_code']
    except: pass
    return None

def get_recent_business_report_no(corp_code):
    url = "https://opendart.fss.or.kr/api/list.json"
    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=1095)).strftime('%Y%m%d')
    
    params = {
        'crtfc_key': DART_API_KEY,
        'corp_code': corp_code,
        'bgn_de': start_date,
        'end_de': end_date,
        'page_count': '20' # 더 넓게 탐색
    }
    try:
        res = requests.get(url, params=params, verify=False, timeout=15)
        data = res.json()
        if data.get('status') == '000' and data.get('list'):
            # 우선순위 정의 (사업 > 반기 > 분기 > 감사)
            priorities = ['사업보고서', '반기보고서', '분기보고서', '감사보고서']
            
            for priority in priorities:
                for item in data['list']:
                    report_nm = item.get('report_nm', '')
                    if priority in report_nm:
                        return item['rcept_no'], report_nm.split('(')[0].strip()
    except Exception as e:
        sys.stderr.write(f"DART 조회 에러: {e}\n")
    return None, None

def summarize_with_genai_dart(text, section_type):
    if not text or len(text) < 100: return "분석할 내용이 부족합니다."
    client = genai.Client(api_key=GOOGLE_API_KEY)
    prompts = {
        "business": "취업 준비생을 위한 사업 경쟁력 3줄 요약.",
        "products": "수익 모델과 주요 서비스 3줄 요약.",
        "financial": "재무 건전성과 연도별 실적 3줄 요약."
    }
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{prompts.get(section_type, '핵심 요약')}\n\n내용:\n{text[:15000]}"
        )
        return response.text.strip()
    except: return "요약 생성 오류"

def analyze_dart_integrated(company_name):
    corp_code = match_phase1(company_name)
    if not corp_code: return {"status": "error", "message": "기업 코드를 찾을 수 없습니다."}
    
    rcept_no, report_nm = get_recent_business_report_no(corp_code)
    if not rcept_no: return {"status": "error", "message": "최신 공고 보고서가 없습니다."}
    
    url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={DART_API_KEY}&rcept_no={rcept_no}"
    try:
        res = requests.get(url, verify=False, timeout=30)
        with zipfile.ZipFile(io.BytesIO(res.content)) as z:
            with z.open(z.namelist()[0]) as f:
                soup = BeautifulSoup(f.read(), "html.parser")
                full_text = soup.get_text()
                return {
                    "status": "success",
                    "company_name": company_name,
                    "report_year": report_nm.split(' ')[0] if report_nm else "",
                    "business": summarize_with_genai_dart(full_text, "business"),
                    "products": summarize_with_genai_dart(full_text, "products"),
                    "financial": summarize_with_genai_dart(full_text, "financial")
                }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ─────────────────────────────────────────────
# [모듈 2] JD 분석 엔진 (기본 로직 유지)
# ─────────────────────────────────────────────

from urllib.parse import urlparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from google.cloud import vision

# --- 공고 사이트별 정밀 셀렉터 설정 ---
SITE_SELECTORS = {
    "linkareer.com": [
        "div[class*='ActivityDetailContent']",
        ".activity-detail-content",
        "#activity-detail-section",
        "section.content"
    ],
    "saramin.co.kr": [
        "#iframe_content_0",
        ".user_content",
        ".template_area",
        "#template_view",
        ".view_con"
    ],
    "jobkorea.co.kr": [
        "#details-section",
        ".view_con",
        ".template_area",
        "#gi-template-container"
    ],
    "wanted.co.kr": [
        "section[class*='JobDetail_content']",
        "div.JobDescription_JobDescription",
        "section.p6u8p7a"
    ],
    "jumpit.co.kr": [
        "section[class*='JobDetail_description']",
        ".cont_box"
    ]
}

def get_full_page_screenshot(url):
    """사이트별 정밀 셀렉터를 활용하여 공고 본문 영역만 타겟팅하여 캡처."""
    sys.stderr.write(f"[JD 캡처] URL 접속 중: {url}\n")
    
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        driver.get(url)
        time.sleep(5) # 동적 콘텐츠 로딩을 위해 대기 시간 약간 증가
        
        domain = urlparse(url).netloc.replace("www.", "")
        
        # 1. 초기 텍스트 메타데이터 확보
        top_text = ""
        try:
            top_text = driver.find_element(By.TAG_NAME, "body").text[:1000]
        except Exception: pass
        
        # 2. 기초 노이즈 제거 (사이트 공통 및 사람인/잡코리아 특화)
        cleanup_js = """
        const noises = [
            'header', 'footer', 'nav', 'aside', '.gnb', '.popup', '.dimmed', '.jview_floating', 
            '.recommend_wrap', '#common_header', '#common_footer', '.jv_footer', '.jv_header',
            '.jv_side', '.jv_cont_related', '.jv_cont_recommend', '.jv_qna', '.jv_review',
            '#related_jobs', '.tpl_footer', '.job_related', '.social_btns', '.share_btns',
            '.banner', 'iframe[id*="google"]', '.ad_section', '.jv_job_rec'
        ];
        noises.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.style.display = 'none';
                el.style.height = '0';
            });
        });
        
        // 특정 마커(공고 끝) 이후의 모든 형제 요소 숨기기
        const endMarkers = [
            '.jv_qna', '.jv_review', '.jv_cont_related', '#related_jobs', 
            '#jv_howto', '#application-section', '#company-section', '.j_detail_btm'
        ];
        endMarkers.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) {
                let sibling = el;
                while (sibling) {
                    if (typeof sibling.style !== 'undefined') {
                        sibling.style.display = 'none';
                        sibling.style.height = '0';
                    }
                    sibling = sibling.nextElementSibling;
                }
            }
        });
        """
        driver.execute_script(cleanup_js)

        # 2. 사이트별 정밀 영역 찾기
        target_selectors = []
        for key in SITE_SELECTORS:
            if key in domain:
                target_selectors = SITE_SELECTORS[key]
                break
        
        target_el = None
        for sel in target_selectors:
            try:
                el = driver.find_element(By.CSS_SELECTOR, sel)
                if el.is_displayed() and el.size['height'] > 200:
                    target_el = el
                    sys.stderr.write(f"[JD 캡처] 정밀 영역 감지 성공: {sel}\n")
                    break
            except: continue

        # 3. Iframe (공고 본문) 처리 - 정밀 영역 못 찾았을 때의 폴백
        if not target_el:
            target_iframe_selectors = [
                "#iframe_content_0", 
                "iframe[title*='상세']", 
                "iframe[src*='GI_Read']", 
                "iframe[title='채용상세']",
                "iframe#ifr_view",
                "iframe[src*='saramin']"
            ]
            for selector in target_iframe_selectors:
                try:
                    found_iframe = driver.find_element(By.CSS_SELECTOR, selector)
                    if found_iframe:
                        sys.stderr.write("[JD 캡처] 본문 Iframe 감지.\n")
                        target_el = found_iframe # Iframe을 타겟으로 설정
                        break
                except: continue

        # 4. 타겟 영역 이미지 로딩 및 크기 측정
        if target_el:
            # 4-1. 먼저 뷰포트 크기를 고정하여 레이아웃을 안정화 (가로 1280 기준)
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1280, "height": 2000, "deviceScaleFactor": 1, "mobile": False
            })
            time.sleep(1) # 레이아웃 재배치 대기

            # 4-2. 고정된 가로 너비(1280) 상태에서 정확한 좌표 측정
            rect = driver.execute_script("""
                const el = arguments[0];
                el.scrollIntoView();
                const rect = el.getBoundingClientRect();
                return {
                    x: rect.left + window.scrollX,
                    y: rect.top + window.scrollY,
                    width: rect.width,
                    height: Math.min(rect.height, 15000)
                };
            """, target_el)
            
            # 4-3. 긴 이미지 대비 점진적 스크롤 (이미지 로딩 유도)
            curr = rect['y']
            limit = rect['y'] + rect['height']
            while curr < limit:
                driver.execute_script(f"window.scrollTo(0, {curr});")
                curr += 1200
                time.sleep(0.3)
            
            # 다시 타겟 상단으로
            driver.execute_script(f"window.scrollTo(0, {rect['y']});")
            time.sleep(1)

            # 5. CDP 정밀 캡처 (클리핑)
            sys.stderr.write(f"[JD 캡처] 본문 정밀 캡처 ([X:{int(rect['x'])}] {int(rect['width'])} x {int(rect['height'])})\n")
            
            # 최종 높이에 맞춰 다시 한번 메트릭 설정 (잘림 방지)
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1280, "height": int(rect['y'] + rect['height'] + 1000), "deviceScaleFactor": 1, "mobile": False
            })
            
            # 캡처 시 좌우 여백을 아주 조금 더 줌 (안정성 위함)
            capture_x = max(0, rect['x'] - 5)
            capture_w = rect['width'] + 10
            
            result = driver.execute_cdp_cmd("Page.captureScreenshot", {
                "format": "png", 
                "fromSurface": True, 
                "captureBeyondViewport": True,
                "clip": {
                    "x": capture_x,
                    "y": rect['y'],
                    "width": capture_w,
                    "height": rect['height'],
                    "scale": 1
                }
            })
            return base64.b64decode(result['data']), top_text, driver.current_url

        # --- 정밀 영역을 못 찾은 경우의 기존 폴백 로직 ---
        sys.stderr.write("[JD 캡처] 정밀 영역 탐색 실패, 전체 페이지 폴백 실행\n")
        total_h = driver.execute_script("return document.documentElement.scrollHeight")
        curr_h = 0
        while curr_h < total_h:
            driver.execute_script(f"window.scrollTo(0, {curr_h});")
            curr_h += 1500
            time.sleep(0.1)
        
        layout = driver.execute_cdp_cmd("Page.getLayoutMetrics", {})
        width = 1280
        height = min(layout['contentSize']['height'], 15000)
        
        driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": height, "deviceScaleFactor": 1, "mobile": False
        })
        time.sleep(2)
        
        result = driver.execute_cdp_cmd("Page.captureScreenshot", {
            "format": "png", "fromSurface": True, "captureBeyondViewport": True
        })
        return base64.b64decode(result['data']), top_text, driver.current_url

    except Exception as e:
        sys.stderr.write(f"[JD 캡처] 캡처 중 오류: {e}\n")
        return None, "", url
    finally:
        driver.quit()

def extract_text_with_google_vision(image_bytes):
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    response = client.document_text_detection(image=image)
    return response.text_annotations[0].description if response.text_annotations else ""

# ─────────────────────────────────────────────
# [모듈 3] 고도화 병렬 분석 엔진 (old_analysis_JD 이식)
# ─────────────────────────────────────────────

def get_job_roles_and_metadata(ocr_text: str) -> dict:
    """공고에서 전체 공통 사항(회사명, 기간)과 직무 목록을 먼저 추출."""
    client = genai.Client(api_key=GOOGLE_API_KEY)
    
    system_prompt = (
        "You are a senior Korean recruitment analyst specializing in parsing job postings (채용공고).\n"
        "The input text was extracted via OCR from a screenshot of a Korean job posting website. "
        "It may contain OCR artifacts such as broken characters, misaligned columns, repeated headers/footers, "
        "navigation text, or advertisement noise. You must intelligently filter these out.\n\n"
        
        "YOUR TASK:\n"
        "1. Identify the company name (회사명). Look for patterns like 'OO주식회사', 'OO그룹', etc. "
        "If an English name and Korean name both appear, prefer the official Korean name.\n"
        "2. Extract the recruitment period. Look for keywords: '접수기간', '모집기간', '지원기간', '시작일', '마감일', '채용기간'. "
        "Normalize all dates to YYYY-MM-DD format. If only relative dates exist (e.g., '채용시 마감'), write them as-is.\n"
        "3. List ALL distinct job roles. For EACH role, identify an 'anchor_sentence'. "
        "   The anchor_sentence MUST be the EXACT text from the OCR where that job's specific section starts "
        "   (e.g., if '백엔드 개발' starts with '[모집부문] 백엔드 개발', use that exact string).\n"
        "4. Identify a 'common_section_anchor'. This is the EXACT text where the common info for all roles starts "
        "   (e.g., '전형절차', '복리후생', '공통 자격요건'). If none exists, use an empty string.\n\n"
        
        "CRITICAL RULES:\n"
        "- The anchor_sentence must be a unique, literal substring found in the input text.\n"
        "- If a role has sub-categories, treat each as a separate role with its own anchor.\n\n"
        "OUTPUT FORMAT: Return a JSON object with: company_name, start_date, end_date, "
        "role_details (array of objects with 'title' and 'anchor_sentence'), and common_section_anchor (string)."
    )

    schema = {
        "type": "OBJECT",
        "properties": {
            "company_name": {"type": "STRING"},
            "start_date": {"type": "STRING"},
            "end_date": {"type": "STRING"},
            "role_details": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "title": {"type": "STRING"},
                        "anchor_sentence": {"type": "STRING"}
                    },
                    "required": ["title", "anchor_sentence"]
                }
            },
            "common_section_anchor": {"type": "STRING"}
        },
        "required": ["company_name", "start_date", "end_date", "role_details", "common_section_anchor"]
    }

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"{system_prompt}\n\nUSER INPUT OCR TEXT:\n{ocr_text}",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.0
        )
    )
    return json.loads(response.text)

def slice_job_text(ocr_text: str, current_role: dict, next_role_anchor: str, common_anchor: str, search_from: int = 0) -> tuple[str, int]:
    """OCR 텍스트에서 해당 직무에 해당하는 부분만 물리적으로 잘라냄."""
    start_anchor = current_role['anchor_sentence']
    
    start_idx = ocr_text.find(start_anchor, search_from)
    if start_idx == -1:
        return ocr_text, search_from
        
    end_indices = []
    if next_role_anchor:
        idx = ocr_text.find(next_role_anchor, start_idx + len(start_anchor))
        if idx != -1: end_indices.append(idx)
    
    if common_anchor:
        idx = ocr_text.find(common_anchor, start_idx + len(start_anchor))
        if idx != -1: end_indices.append(idx)
        
    end_idx = min(end_indices) if end_indices else len(ocr_text)
    
    s_idx = int(start_idx)
    e_idx = int(end_idx)
    sliced_main = ocr_text[s_idx:e_idx]  # type: ignore
    common_part = ""
    if common_anchor:
        c_idx = ocr_text.find(common_anchor)
        if c_idx != -1:
            common_part = "\n\n[COMMON SECTION]\n" + ocr_text[int(c_idx):]  # type: ignore
            
    return sliced_main + common_part, start_idx + len(start_anchor)

def analyze_individual_job(sliced_text: str, job_title: str, common_meta: dict, all_roles: list = []) -> dict:
    """물리적으로 잘려진 텍스트 조각에서 상세 정보를 추출."""
    client = genai.Client(api_key=GOOGLE_API_KEY)
    
    fields_mapping = {
        "company_name": "회사명", "recruitment_field": "모집부문", "job_title": "모집직무",
        "main_tasks": "주요업무", "requirements": "자격요건", "preferred_qualifications": "우대사항",
        "location": "근무지", "start_date": "채용시작일", "end_date": "채용마감일", "brief_summary": "공고요약"
    }

    system_prompt = (
        f"You are a specialist recruitment analyst. Your ONLY task is to extract detailed information "
        f"for the specific role: 「{job_title}」 from the provided OCR text of a Korean job posting.\n\n"
        
        "CONTEXT:\n"
        f"- Company: {common_meta.get('company_name', '(unknown)')}\n"
        f"- TARGET Role to extract EXACTLY: 「{job_title}」\n"
        f"- All roles listed in this JD (for boundary reference): {', '.join([r.get('title', '') for r in all_roles])}\n"
        "- You are given a PRE-SLICED portion of the JD. If you suspect it contains text from ANOTHER role, strictly ignore the parts that don't belong to the target role.\n"
        f"- Recruitment Period: {common_meta.get('start_date', '')} ~ {common_meta.get('end_date', '')}\n"
        "- The text was extracted via OCR and may contain noise, broken characters, or misaligned data.\n\n"
        
        "FIELD-BY-FIELD EXTRACTION GUIDE:\n"
        "1. company_name: Use the company name provided above. If the text shows a different subsidiary or brand, use that instead.\n"
        "2. recruitment_field (모집부문): The broader category this role belongs to (e.g., '기술직', '경영지원', '마케팅본부'). "
        "   Look for section headers like '[모집부문]' or department names.\n"
        "3. job_title (모집직무): The specific position title. Use the exact title from the posting. "
        "   Examples: '백엔드 개발자', '브랜드 마케터', '인사담당자'\n"
        "4. main_tasks (주요업무): List EVERY task and responsibility mentioned for this role. "
        "   **CRITICAL: Each task MUST be on a NEW line starting with '- '.** "
        "   Use dash-prefixed bullet format: '- Task 1\\n- Task 2\\n- Task 3'. "
        "   Look for keywords: '담당업무', '주요업무', '업무내용', '직무내용', 'What you will do'. "
        "   Be EXHAUSTIVE. Do NOT summarize or paraphrase. Copy the exact wording from the text.\n"
        "5. requirements (자격요건): List ALL mandatory qualifications. "
        "   **CRITICAL: DO NOT merge conditions into one line. Each condition MUST be on its own NEW line starting with '- '.** "
        "   Look for: '자격요건', '필수요건', '지원자격', 'Requirements'. "
        "   Include years of experience, certifications, technical skills, etc. "
        "   CRITICAL 1: Regarding education, ONLY include it if it explicitly requires '석사 이상' (Master's or higher) or a specific major like '~전공 또는 그에 준하는 전공자' (Major in ... or equivalent). "
        "   If it says '학력무관' (Education irrelevant), '대졸' (Bachelor's), or lacks specialized major requirements, EXCLUDE the education-related bullet point. "
        "   CRITICAL 2: Regarding experience, if it says '경력무관' or '신입/경력무관' (Experience irrelevant), entirely EXCLUDE the experience-related bullet points. Only include explicitly stated required experience (e.g., '3년 이상'). "
        "   Be EXHAUSTIVE for other actual requirements. Every single bullet point matters.\n"
        "6. preferred_qualifications (우대사항): List ALL preferred/optional qualifications. "
        "   **CRITICAL: Each item MUST be on a NEW line starting with '- '.** "
        "   Look for: '우대사항', '우대조건', '우대요건', 'Preferred', '가산점'. "
        "   Include certifications, additional skills, personality traits mentioned.\n"
        "7. location (근무지): The work location. Look for: '근무지', '근무장소', '근무지역', '본사', '사업장'. "
        "   Include full address if available. If '재택근무' or 'Remote' is mentioned, include it.\n"
        "8. start_date (채용시작일): Use the date from context above unless a role-specific date exists. Format: YYYY-MM-DD.\n"
        "9. end_date (채용마감일): Use the date from context above unless a role-specific deadline exists. "
        "   '상시채용', '채용시 마감', '수시' are valid values.\n"
        "10. brief_summary (공고요약): 사용자가 직무를 선택하기 전 확인하는 요약문입니다. "
        "    해당 직무의 모집 부문과 핵심 역할을 중심으로 한 줄로 명확하게 요약하세요. "
        "    단, '[주요업무]', '[자격요건]' 같은 라벨이나 말머리는 절대 사용하지 말고, "
        "    읽기 자연스러운 문장으로 작성하십시오. (예: '서비스의 백엔드 아키텍처를 설계하고 운영하며, Java 3년 이상의 경력과 기본적인 인프라 운영 지식이 필요합니다.')\n\n"
        
        "CRITICAL RULES:\n"
        f"- Extract information ONLY relevant to 「{job_title}」. "
        "- If the text contains headers for other positions, stop extracting and ignore that text.\n"
        "- If a section applies to ALL roles (공통 자격요건), include it in this role's output too.\n"
        "- NEVER fabricate information. If a field genuinely cannot be found, use an empty string \"\".\n"
        "- For bullet lists, each item MUST start with '- ' and be separated by '\\n'.\n"
        "- OCR may have broken Korean characters. Use context to infer the correct word.\n\n"
        "OUTPUT FORMAT: You MUST return a JSON object using the following English keys:\n"
        "  - company_name, recruitment_field, job_title, main_tasks, requirements, preferred_qualifications, location, start_date, end_date, brief_summary\n"
        "  - Do not use Korean keys in the JSON itself. The system will map them."
    )

    schema = {
        "type": "OBJECT",
        "properties": {f: {"type": "STRING"} for f in fields_mapping.keys()},
        "required": list(fields_mapping.keys())
    }

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"{system_prompt}\n\nUSER INPUT OCR TEXT:\n{sliced_text}",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.0
        )
    )
    
    text = response.text.strip()
    if "```json" in text:
        text = text.split("```json")[-1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[-1].split("```")[0].strip()
        
    try:
        raw_job = json.loads(text)
    except Exception:
        return {}
        
    # 한글 키로 변환하여 반환
    return {fields_mapping[k]: (raw_job.get(k, "") or "") for k in fields_mapping.keys() if k in raw_job}


def summarize_with_openai(ocr_text: str) -> list:
    """메타데이터 추출 후 모든 직무를 병렬로 상세 분석함."""
    try:
        sys.stderr.write("[JD 분석] 공고 내 직무 목록 앵커 검출 중...\n")
        meta_data = get_job_roles_and_metadata(ocr_text)
        roles_info = meta_data.get("role_details", [])
        common_anchor = meta_data.get("common_section_anchor", "")
        
        if not roles_info:
            return []

        results = []
        current_pos = 0
        sys.stderr.write(f"[JD 분석] {len(roles_info)}개의 직무 텍스트 물리적 분할 및 병렬 분석 시작...\n")
        with ThreadPoolExecutor() as executor:
            temp_tasks = []
            for i, role in enumerate(roles_info):
                next_anchor = roles_info[i+1]['anchor_sentence'] if i+1 < len(roles_info) else ""
                sliced_text, next_pos = slice_job_text(ocr_text, role, next_anchor, common_anchor, current_pos)
                current_pos = next_pos
                temp_tasks.append((sliced_text, role['title']))
                
            futures = [executor.submit(analyze_individual_job, t[0], t[1], meta_data, roles_info) for t in temp_tasks]  # type: ignore
            results = [f.result() for f in futures]
            
        return [r for r in results if r]
    except Exception as e:
        sys.stderr.write(f"[오류] AI 병렬 분석 중 오류 발생: {e}\n")
        return []

# ─────────────────────────────────────────────
# [메인 엔진] 통합 처리 로직
# ─────────────────────────────────────────────

def main():
    if len(sys.argv) < 2: sys.exit(1)
    input_value = sys.argv[1].strip()
    
    # 입력값이 URL인지 기업명인지 판단
    is_url = input_value.startswith("http")
    
    try:
        if is_url:
            # [CASE 1] 채용공고 URL 분석 모드
            sys.stderr.write(f"[JD 분석] 공고 페이지 접속 중... ({input_value})\n")
            screenshot, top_text, final_url = get_full_page_screenshot(input_value)  # type: ignore
            
            if screenshot is None:
                sys.stderr.write("[오류] 스크린샷 캡처 실패\n")
                raise Exception("스크린샷 캡처 실패")

            sys.stderr.write("[JD 분석] 이미지 텍스트 추출 중(OCR)...\n")
            ocr_text = extract_text_with_google_vision(screenshot)
            
            # 고도화된 물리적 절단 및 스레드 병렬 분석 프로세스로 교체
            combined_text = f"URL: {final_url}\nMETA:\n{top_text}\n\nBODY:\n{ocr_text}"
            structured_roles = summarize_with_openai(combined_text)
            company_name = structured_roles[0].get('회사명', '알 수 없음') if structured_roles else '알 수 없음'

            sys.stderr.write(f"[JD 분석] DART 기업 정보 연동 중... ({company_name})\n")
            # DART 분석 수행
            dart_result = analyze_dart_integrated(company_name)
            
            sys.stderr.write("[JD 분석] 모든 분석 완료. 결과 출력 중...\n")
            # 백엔드(route.ts)가 기대하는 규격(raw_text, structured)으로 출력 보정
            print(json.dumps({
                "raw_text": ocr_text,
                "structured": structured_roles,
                "company_name": company_name,
                "dart": dart_result
            }, ensure_ascii=False))
            
        else:
            # [CASE 2] 순수 기업 분석 모드 (DART 전용)
            dart_result = analyze_dart_integrated(input_value)
            print(json.dumps(dart_result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()