import os
import sys
import time
import base64
import json
import psycopg2  # type: ignore
from urllib.parse import urlparse
from typing import Union
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv  # type: ignore
from selenium import webdriver  # type: ignore
from selenium.webdriver.chrome.options import Options  # type: ignore
from selenium.webdriver.common.by import By  # type: ignore
from google import genai  # type: ignore
from google.genai import types  # type: ignore
from google.cloud import vision  # type: ignore

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

def get_full_page_screenshot(url: str) -> tuple[Union[bytes, None], str, str]:
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
                        print(f"   📦 본문 Iframe 감지.", file=sys.stderr)
                        target_el = found_iframe # Iframe을 타겟으로 설정
                        break
                except: continue

        # 5. 타겟 영역 이미지 로딩 및 크기 측정
        if target_el:
            # 5-1. 먼저 뷰포트 크기를 고정하여 레이아웃을 안정화 (가로 1280 기준)
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1280, "height": 2000, "deviceScaleFactor": 1, "mobile": False
            })
            time.sleep(1) # 레이아웃 재배치 대기

            # 5-2. 고정된 가로 너비(1280) 상태에서 정확한 좌표 측정
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
            
            # 5-3. 긴 이미지 대비 점진적 스크롤 (이미지 로딩 유도)
            curr = rect['y']
            limit = rect['y'] + rect['height']
            while curr < limit:
                driver.execute_script(f"window.scrollTo(0, {curr});")
                curr += 1200
                time.sleep(0.3)
            
            # 다시 타겟 상단으로
            driver.execute_script(f"window.scrollTo(0, {rect['y']});")
            time.sleep(1)

            # 6. CDP 정밀 캡처 (클리핑)
            print(f"📸 본문 정밀 캡처 ([X:{int(rect['x'])}] {int(rect['width'])} x {int(rect['height'])})", file=sys.stderr)
            
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
    return None, "", url

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

def get_job_roles_and_metadata(ocr_text: str) -> dict:
    """공고에서 전체 공통 사항(회사명, 기간)과 직무 목록을 먼저 추출."""
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    
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
            response_schema=schema
        )
    )
    return json.loads(response.text)

def slice_job_text(ocr_text: str, current_role: dict, next_role_anchor: str, common_anchor: str, search_from: int = 0) -> tuple[str, int]:
    """OCR 텍스트에서 해당 직무에 해당하는 부분만 물리적으로 잘라냄.
    search_from을 통해 이전 직무 이후부터 검색하여 중복 앵커 문제 해결."""
    start_anchor = current_role['anchor_sentence']
    
    # 시작점 찾기 (search_from 이후부터)
    start_idx = ocr_text.find(start_anchor, search_from)
    if start_idx == -1:
        return ocr_text, search_from # 못 찾으면 전체 반환
        
    # 끝점 후보 (다음 직무 시작점 또는 공통 영역 시작점)
    end_indices = []
    if next_role_anchor:
        idx = ocr_text.find(next_role_anchor, start_idx + len(start_anchor))
        if idx != -1: end_indices.append(idx)
    
    if common_anchor:
        idx = ocr_text.find(common_anchor, start_idx + len(start_anchor))
        if idx != -1: end_indices.append(idx)
        
    # 가장 먼저 나오는 끝점 선택
    end_idx = min(end_indices) if end_indices else len(ocr_text)
    
    # 해당 직무 텍스트 + 공통 영역(있다면) 결합
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
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    
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
        "   CRITICAL: Regarding education, ONLY include it if it explicitly requires '석사 이상' (Master's or higher) or a specific major like '~전공 또는 그에 준하는 전공자' (Major in ... or equivalent). "
        "   If it says '학력무관' (Education irrelevant), '대졸' (Bachelor's), or lacks specialized major requirements, EXCLUDE the education-related bullet point. "
        "   Be EXHAUSTIVE for other requirements. Every single bullet point matters.\n"
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
            response_schema=schema
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
        # Step 1: 직무 목록 및 앵커 정보 추출
        meta_data = get_job_roles_and_metadata(ocr_text)
        roles_info = meta_data.get("role_details", [])
        common_anchor = meta_data.get("common_section_anchor", "")
        
        if not roles_info:
            return []

        # Step 2: 각 직무별 물리적 슬라이싱 및 병렬 분석 실행
        results = []
        current_pos = 0
        with ThreadPoolExecutor() as executor:
            temp_tasks = []
            for i, role in enumerate(roles_info):
                next_anchor = roles_info[i+1]['anchor_sentence'] if i+1 < len(roles_info) else ""
                
                # 텍스트 물리적 커팅 및 다음 검색 시작 위치 갱신
                sliced_text, next_pos = slice_job_text(ocr_text, role, next_anchor, common_anchor, current_pos)
                current_pos = next_pos
                
                temp_tasks.append((sliced_text, role['title']))
                
            futures = [executor.submit(analyze_individual_job, t[0], t[1], meta_data, roles_info) for t in temp_tasks]  # type: ignore
            results = [f.result() for f in futures]
            
        # 빈 결과 필터링
        return [r for r in results if r]
    except Exception as e:
        print(f"AI 분석 중 오류: {e}", file=sys.stderr)
        return []

def main() -> None:
    if sys.stdout.encoding.lower() != 'utf-8':
        reconf = getattr(sys.stdout, 'reconfigure', None)
        if reconf:
            reconf(encoding='utf-8')
        
    if len(sys.argv) < 2: sys.exit(1)
    url = sys.argv[1].strip()
    
    try:
        screenshot_bytes, top_text, final_url = get_full_page_screenshot(url)
        if screenshot_bytes is None or not isinstance(screenshot_bytes, bytes):
            sys.exit(1)
        
        
        ocr_text = extract_text_with_google_vision(screenshot_bytes)  # type: ignore
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