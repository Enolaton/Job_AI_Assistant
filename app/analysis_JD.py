import os
import sys
import time
import base64
import json
import psycopg2
from urllib.parse import urlparse
from typing import Union

from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from openai import OpenAI
from google.cloud import vision

load_dotenv()

# --- 공고 사이트별 정밀 셀렉터 설정 ---
SITE_SELECTORS = {
    "linkareer.com": [
        "div[class*='ActivityDetailContent']",
        ".activity-detail-content",
        "#activity-detail-section",
        "section.content"
    ],
    "saramin.co.kr": [
        ".user_content",
        ".template_area",
        "#template_view",
        ".view_con"
    ],
    "jobkorea.co.kr": [
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

def get_full_page_screenshot(url: str) -> Union[bytes, None]:
    """사이트별 정밀 셀렉터를 활용하여 공고 본문 영역만 타겟팅하여 캡처."""
    print(f"▶ URL 접속 중: {url}", file=sys.stderr)
    
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
        time.sleep(4)
        
        domain = urlparse(url).netloc.replace("www.", "")
        
        # 1. 초기 텍스트 메타데이터 확보
        top_text = ""
        try:
            top_text = driver.find_element(By.TAG_NAME, "body").text[:1000]
        except Exception: pass

        # 2. 기초 노이즈 제거 (사이트 공통)
        cleanup_js = """
        const noises = ['header', 'footer', 'nav', 'aside', '.gnb', '.popup', '.dimmed', '.jview_floating', '.recommend_wrap', '#common_header', '#common_footer'];
        noises.forEach(sel => document.querySelectorAll(sel).forEach(el => el.style.display = 'none'));
        """
        driver.execute_script(cleanup_js)

        # 3. 사이트별 정밀 영역 찾기
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
                    print(f"   🎯 정밀 영역 감지 성공: {sel}", file=sys.stderr)
                    break
            except: continue

        # 4. Iframe (공고 본문) 처리 - 정밀 영역 못 찾았을 때의 폴백
        if not target_el:
            target_iframe_selectors = ["#iframe_content_0", "iframe[title*='상세']", "iframe[src*='GI_Read']", "iframe[title='채용상세']"]
            for selector in target_iframe_selectors:
                try:
                    found_iframe = driver.find_element(By.CSS_SELECTOR, selector)
                    if found_iframe:
                        print(f"   📦 본문 Iframe 감지.", file=sys.stderr)
                        target_el = found_iframe # Iframe을 타겟으로 설정
                        break
                except: continue

        # 5. 타겟 영역 이미지 로딩 및 크기 측정
        if target_el:
            # 5-1. 해당 영역으로 스크롤하여 이미지 로딩 강제
            rect = driver.execute_script("""
                const el = arguments[0];
                el.scrollIntoView();
                const rect = el.getBoundingClientRect();
                return {
                    x: rect.left + window.scrollX,
                    y: rect.top + window.scrollY,
                    width: rect.width,
                    height: rect.height
                };
            """, target_el)
            
            # 5-2. 긴 이미지 대비 점진적 스크롤
            curr = rect['y']
            limit = rect['y'] + rect['height']
            while curr < limit:
                driver.execute_script(f"window.scrollTo(0, {curr});")
                curr += 1000
                time.sleep(0.3)
            
            # 다시 상단으로
            driver.execute_script(f"window.scrollTo(0, {rect['y']});")
            time.sleep(1)

            # 6. CDP 정밀 캡처 (클리핑)
            print(f"📸 본문 정밀 캡처 ({int(rect['width'])} x {int(rect['height'])})", file=sys.stderr)
            
            # 페이지 전체 높이 조정 (잘림 방지)
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1280, "height": int(rect['y'] + rect['height'] + 500), "deviceScaleFactor": 1, "mobile": False
            })
            
            result = driver.execute_cdp_cmd("Page.captureScreenshot", {
                "format": "png", 
                "fromSurface": True, 
                "captureBeyondViewport": True,
                "clip": {
                    "x": rect['x'],
                    "y": rect['y'],
                    "width": rect['width'],
                    "height": rect['height'],
                    "scale": 1
                }
            })
            return base64.b64decode(result['data']), top_text, driver.current_url

        # --- 정밀 영역을 못 찾은 경우의 기존 폴백 로직 ---
        print("⚠️ 정밀 영역 탐색 실패, 전체 페이지 폴백 실행", file=sys.stderr)
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
        print(f"❌ 캡처 중 오류: {e}", file=sys.stderr)
        return None, "", url
    finally:
        driver.quit()

def extract_text_with_google_vision(image_bytes: bytes) -> str:
    """스크린샷 이미지를 Google Cloud Vision API로 OCR하여 텍스트 추출."""
    try:
        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.document_text_detection(image=image)
        if response.error.message: raise Exception(f"{response.error.message}")
        if response.text_annotations: 
            return response.text_annotations[0].description
        return ""
    except Exception as e:
        print(f"OCR 오류: {e}", file=sys.stderr)
        return ""

from concurrent.futures import ThreadPoolExecutor

def get_job_roles_and_metadata(ocr_text: str) -> dict:
    """공고에서 전체 공통 사항(회사명, 기간)과 직무 목록을 먼저 추출."""
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
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
        "3. List ALL distinct job roles/positions. In Korean JDs, roles may appear as:\n"
        "   - Section headers like '[모집부문]', '모집직무', '채용분야'\n"
        "   - Table rows with columns like '부문 | 직무 | 자격요건'\n"
        "   - Numbered lists like '① 마케팅 ② 개발 ③ 디자인'\n"
        "   - Image-based sections where each role has its own visual block\n"
        "   - Combined formats like '경영지원/인사' should be split into separate roles if they have different requirements.\n"
        "   - If only ONE role exists, return it as a single-item array.\n\n"
        
        "CRITICAL RULES:\n"
        "- Do NOT include navigation text, ad text, or unrelated website UI elements.\n"
        "- If the company name is unclear, look for the largest/boldest text or the first mention.\n"
        "- For dates, '상시채용' or '채용시 마감' are valid values.\n"
        "- Each role name should be concise but descriptive (e.g., '백엔드 개발자', not just '개발').\n"
        "- If a role has sub-categories (e.g., '개발 - 프론트엔드, 백엔드'), list each sub-category as a separate role."
    )
    
    schema = {
        "name": "jd_metadata",
        "schema": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string"},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"},
                "job_roles": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["company_name", "start_date", "end_date", "job_roles"],
            "additionalProperties": False
        },
        "strict": True
    }

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_schema", "json_schema": schema},
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": ocr_text}]
    )
    return json.loads(completion.choices[0].message.content)

def analyze_individual_job(ocr_text: str, job_title: str, common_meta: dict) -> dict:
    """특정 한 직무에 대해서만 OCR 텍스트에서 상세 정보를 추출."""
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
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
        f"- Recruitment Period: {common_meta.get('start_date', '')} ~ {common_meta.get('end_date', '')}\n"
        "- The text was extracted via OCR and may contain noise, broken characters, or misaligned data.\n\n"
        
        "FIELD-BY-FIELD EXTRACTION GUIDE:\n"
        "1. company_name: Use the company name provided above. If the text shows a different subsidiary or brand, use that instead.\n"
        "2. recruitment_field (모집부문): The broader category this role belongs to (e.g., '기술직', '경영지원', '마케팅본부'). "
        "   Look for section headers like '[모집부문]' or department names.\n"
        "3. job_title (모집직무): The specific position title. Use the exact title from the posting. "
        "   Examples: '백엔드 개발자', '브랜드 마케터', '인사담당자'\n"
        "4. main_tasks (주요업무): List EVERY task and responsibility mentioned for this role. "
        "   Use dash-prefixed bullet format: '- Task 1\\n- Task 2\\n- Task 3'. "
        "   Look for keywords: '담당업무', '주요업무', '업무내용', '직무내용', 'What you will do'. "
        "   Be EXHAUSTIVE. Do NOT summarize or paraphrase. Copy the exact wording from the text.\n"
        "5. requirements (자격요건): List ALL mandatory qualifications. "
        "   Use dash-prefixed bullet format. Look for: '자격요건', '필수요건', '지원자격', 'Requirements'. "
        "   Include education level, years of experience, certifications, technical skills, etc. "
        "   Be EXHAUSTIVE. Every single bullet point matters.\n"
        "6. preferred_qualifications (우대사항): List ALL preferred/optional qualifications. "
        "   Use dash-prefixed bullet format. Look for: '우대사항', '우대조건', '우대요건', 'Preferred', '가산점'. "
        "   Include certifications, additional skills, personality traits mentioned.\n"
        "7. location (근무지): The work location. Look for: '근무지', '근무장소', '근무지역', '본사', '사업장'. "
        "   Include full address if available. If '재택근무' or 'Remote' is mentioned, include it.\n"
        "8. start_date (채용시작일): Use the date from context above unless a role-specific date exists. Format: YYYY-MM-DD.\n"
        "9. end_date (채용마감일): Use the date from context above unless a role-specific deadline exists. "
        "   '상시채용', '채용시 마감', '수시' are valid values.\n"
        "10. brief_summary (공고요약): Write a natural, human-readable 2-3 line summary IN KOREAN. "
        "    It should describe: what the role does, key qualifications, and why someone might want to apply. "
        "    Example: '삼성전자에서 클라우드 인프라를 설계하고 운영할 백엔드 개발자를 모집합니다. "
        "    3년 이상의 경험과 AWS/GCP 활용 능력이 필요하며, MSA 경험자를 우대합니다.'\n\n"
        
        "CRITICAL RULES:\n"
        "- Extract information ONLY relevant to 「{job_title}」. Ignore data for other roles.\n"
        "- If a section applies to ALL roles (공통 자격요건), include it in this role's output too.\n"
        "- NEVER fabricate information. If a field genuinely cannot be found, use an empty string \"\".\n"
        "- For bullet lists, each item MUST start with '- ' and be separated by '\\n'.\n"
        "- OCR may have broken Korean characters. Use context to infer the correct word "
        "(e.g., '개발' might appear as '개 발' or '개발').\n"
        "- Tables in OCR text may appear as misaligned columns. Match columns carefully by position."
    )
    
    schema = {
        "name": "single_job_analysis",
        "schema": {
            "type": "object",
            "properties": {f: {"type": "string"} for f in fields_mapping.keys()},
            "required": list(fields_mapping.keys()),
            "additionalProperties": False
        },
        "strict": True
    }

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_schema", "json_schema": schema},
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": ocr_text}]
    )
    
    raw_job = json.loads(completion.choices[0].message.content)
    # 한글 키로 변환하여 반환
    return {fields_mapping[k]: (raw_job.get(k, "") or "") for k in fields_mapping.keys()}


def summarize_with_openai(ocr_text: str) -> list:
    """메타데이터 추출 후 모든 직무를 병렬로 상세 분석함."""
    try:
        # Step 1: 직무 목록 및 공통 정보 추출
        meta_data = get_job_roles_and_metadata(ocr_text)
        roles = meta_data.get("job_roles", [])
        
        if not roles:
            return []

        # Step 2: 각 직무별 병렬 분석 실행
        # 직무 제한 없이 모든 직무에 대해 병렬 처리 진행
        with ThreadPoolExecutor() as executor:
            futures = [executor.submit(analyze_individual_job, ocr_text, role, meta_data) for role in roles]
            results = [f.result() for f in futures]
            
        return results
    except Exception as e:
        print(f"AI 분석 중 오류: {e}", file=sys.stderr)
        return []

def main() -> None:
    if sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
        
    if len(sys.argv) < 2: sys.exit(1)
    url = sys.argv[1].strip()
    
    try:
        # 단일 URL 분석으로 단순화 (시퀀스 1 시도 안 함)
        screenshot_bytes, top_text, final_url = get_full_page_screenshot(url)
        if not screenshot_bytes:
            sys.exit(1)
        
        ocr_text = extract_text_with_google_vision(screenshot_bytes)
        if not ocr_text.strip():
            sys.exit(1)
        
        combined_text = f"URL: {final_url}\nMETA:\n{top_text}\n\nBODY:\n{ocr_text}"
        structured = summarize_with_openai(combined_text)
        
        print(json.dumps({"raw_text": ocr_text, "structured": structured}, ensure_ascii=False))

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()