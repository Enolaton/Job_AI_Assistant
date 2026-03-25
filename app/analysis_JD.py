import os
import sys
import time
import base64
import json
import re
import urllib3
import warnings
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from urllib.parse import urlparse

# Selenium & AI Imports
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from google.cloud import vision
from dotenv import load_dotenv

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.stderr.write("오류: google-genai 라이브러리가 설치되지 않았습니다.\n")

# 경고 메시지 차단
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# ─────────────────────────────────────────────
# [모듈 1] JD 분석 엔진 (OCR & AI 분석 전용)
# ─────────────────────────────────────────────

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
        
        # 2. 기초 노이즈 제거
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
 
        if not target_el:
            target_iframe_selectors = ["#iframe_content_0", "iframe[title*='상세']", "iframe#ifr_view"]
            for selector in target_iframe_selectors:
                try:
                    found_iframe = driver.find_element(By.CSS_SELECTOR, selector)
                    if found_iframe:
                        target_el = found_iframe
                        break
                except: continue
 
        if target_el:
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1280, "height": 2000, "deviceScaleFactor": 1, "mobile": False
            })
            time.sleep(1)
 
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
            
            driver.execute_script(f"window.scrollTo(0, {rect['y']});")
            time.sleep(1)
 
            sys.stderr.write(f"[JD 캡처] 본문 정밀 캡처 ({int(rect['width'])} x {int(rect['height'])})\n")
            
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1280, "height": int(rect['y'] + rect['height'] + 1000), "deviceScaleFactor": 1, "mobile": False
            })
            
            result = driver.execute_cdp_cmd("Page.captureScreenshot", {
                "format": "png", 
                "fromSurface": True, 
                "captureBeyondViewport": True,
                "clip": {
                    "x": max(0, rect['x'] - 5),
                    "y": rect['y'],
                    "width": rect['width'] + 10,
                    "height": rect['height'],
                    "scale": 1
                }
            })

            return base64.b64decode(result['data']), top_text, driver.current_url
 
        # 폴백
        layout = driver.execute_cdp_cmd("Page.getLayoutMetrics", {})
        driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
            "width": 1280, "height": min(layout['contentSize']['height'], 15000), "deviceScaleFactor": 1, "mobile": False
        })
        time.sleep(2)
        result = driver.execute_cdp_cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True, "captureBeyondViewport": True})

        return base64.b64decode(result['data']), top_text, driver.current_url
 
    except Exception as e:
        sys.stderr.write(f"[JD 캡처] 오류: {e}\n")
        return None, "", url
    finally:
        driver.quit()
 
def extract_text_with_google_vision(image_bytes):
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    response = client.document_text_detection(image=image)
    ocr_text = response.text_annotations[0].description if response.text_annotations else ""
    # [DEBUG] OCR 텍스트 일부 출력
    sys.stderr.write(f"[DEBUG] OCR 추출 텍스트 (앞 500자): {ocr_text[:500]}...\n")
    return ocr_text
 
def get_job_roles_and_metadata(ocr_text: str) -> dict:
    client = genai.Client(api_key=GOOGLE_API_KEY)
    
    system_prompt = (
        "당신은 한국의 채용 공고(JD)를 정밀하게 분석하는 전문 리크루팅 애널리스트입니다.\n"
        "입력된 텍스트는 공고 캡처 이미지에서 추출된 OCR 데이터입니다. 여기에는 글자 깨짐, 열 어긋남, "
        "반복되는 헤더/푸터, 내비게이션 텍스트 또는 광고 노이즈가 포함되어 있을 수 있습니다. "
        "이러한 노이즈를 지능적으로 필터링하고 핵심 정보만 추출해야 합니다.\n\n"
        
        "수행 과제:\n"
        "1. 회사명 식별: 'OO주식회사', 'OO그룹' 등의 패턴을 찾으세요. 국문명과 영문명이 병기된 경우 공식 국문명을 우선시합니다.\n"
        "2. 채용 기간 추출: '접수기간', '모집기간', '시작일', '마감일' 등의 키워드를 찾으세요. "
        "모든 날짜를 YYYY-MM-DD 형식으로 정규화하세요. 상대적 날짜(예: '채용시 마감')는 있는 그대로 작성하세요.\n"
        "3. 모든 개별 직무 나열: 공고에 포함된 모든 직무를 각각 추출하고, 각 직무의 '앵커 문장(anchor_sentence)'을 식별하세요. "
        "앵커 문장은 해당 직무의 상세 내용이 시작되는 OCR 텍스트 내의 **정확한 문자열**이어야 합니다 "
        "(예: '[모집부문] 백엔드 개발'이 직무의 시작이라면 해당 텍스트를 그대로 사용).\n"
        "4. 공통 섹션 앵커 식별: 모든 직무에 공통으로 적용되는 정보(전형절차, 복리후생 등)가 시작되는 정확한 텍스트를 찾으세요.\n\n"
        
        "준수 사항:\n"
        "- anchor_sentence는 반드시 입력 텍스트 내에 존재하는 유일하고 글자 하나 틀리지 않은 리터럴 문자열이어야 합니다.\n"
        "- 직무에 하위 카테고리가 있는 경우 각각을 별도의 직무로 취급하세요.\n\n"
        "출력 형식: JSON 객체 (회사명(company_name), 시작일(start_date), 마감일(end_date), 직무 상세 목록(role_details), 공통 섹션 앵커(common_section_anchor))"
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
        model="gemini-2.0-flash",
        contents=f"{system_prompt}\n\nTEXT:\n{ocr_text}",
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=schema, temperature=0.0)
    )
    return json.loads(response.text)
 
def analyze_individual_job(sliced_text: str, job_title: str, common_meta: dict, all_roles: list = []) -> dict:
    client = genai.Client(api_key=GOOGLE_API_KEY)
    
    fields_mapping = {
        "company_name": "회사명", "recruitment_field": "모집부문", "job_title": "모집직무",
        "main_tasks": "주요업무", "requirements": "자격요건", "preferred_qualifications": "우대사항",
        "location": "근무지", "start_date": "채용시작일", "end_date": "채용마감일", "brief_summary": "공고요약"
    }
 
    system_prompt = (
        f"당신은 전문 채용 분석가입니다. 당신의 유일한 과제는 제공된 OCR 텍스트에서 「{job_title}」 직무에 대한 상세 정보를 추출하는 것입니다.\n\n"
        
        "맥락 정보:\n"
        f"- 대상 기업: {common_meta.get('company_name', '(알 수 없음)')}\n"
        f"- 추출 대상 직무: 「{job_title}」\n"
        f"- 전체 공고 내 직무 목록: {', '.join([r.get('title', '') for r in all_roles])}\n"
        "- 입력된 텍스트는 해당 직무와 관련된 조각입니다. 타 직무의 내용이 섞여 있다면 엄격히 배제하세요.\n\n"
        
        "필드별 추출 가이드:\n"
        "1. 회사명: 위 제공된 회사명을 사용하세요.\n"
        "2. 모집부문: 해당 직무가 속한 상위 카테고리 (예: '기술직', '경영지원').\n"
        "3. 모집직무: 공고상의 정확한 직무 명칭.\n"
        "4. 주요업무: 언급된 모든 업무를 나열하세요. 반드시 각 항목을 '- '로 시작하는 새 줄로 작성하세요.\n"
        "5. 자격요건: 모든 필수 요건을 나열하세요. 지능적으로 노이즈를 걸러내고, 각 항목을 '- '로 시작하는 새 줄로 작성하세요.\n"
        "6. 우대사항: 모든 우대/선택 요건을 나열하세요. 각 항목을 '- '로 시작하는 새 줄로 작성하세요.\n"
        "7. 근무지: 상세 주소 또는 지역명.\n"
        "8. 공고요약: 핵심 역할과 역량을 중심으로 자연스러운 한 문장의 요약문을 작성하세요.\n\n"
        
        "준수 사항:\n"
        "- 절대 허위 정보를 지어내지 마세요. 필드를 찾을 수 없으면 빈 문자열 \"\"을 반환하세요.\n"
        "- 모든 리스트 항목은 반드시 '- '와 개행으로 구분되어야 합니다.\n\n"
        "출력 형식: JSON 객체 (영어 키 사용: company_name, recruitment_field, job_title, main_tasks, requirements, preferred_qualifications, location, start_date, end_date, brief_summary)"
    )
 
    schema = {
        "type": "OBJECT",
        "properties": {f: {"type": "STRING"} for f in fields_mapping.keys()},
        "required": list(fields_mapping.keys())
    }
 
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"{system_prompt}\n\nTEXT:\n{sliced_text}",
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=schema, temperature=0.0)
    )
    
    text = response.text.strip()
    if "```json" in text: text = text.split("```json")[-1].split("```")[0].strip()
    
    try:
        raw_job = json.loads(text)
        return {fields_mapping[k]: (raw_job.get(k, "") or "") for k in fields_mapping.keys() if k in raw_job}
    except:
        return {}

def main():
    if len(sys.argv) < 2: sys.exit(1)
    url = sys.argv[1].strip()
    
    try:
        # JD 분석 모드만 유지
        screenshot, top_text, final_url = get_full_page_screenshot(url)
        if screenshot is None: raise Exception("캡처 실패")

        ocr_text = extract_text_with_google_vision(screenshot)
        combined_text = f"URL: {final_url}\nMETA:\n{top_text}\n\nBODY:\n{ocr_text}"
        
        meta = get_job_roles_and_metadata(combined_text)
        roles = meta.get("role_details", [])
        common_anchor = meta.get("common_section_anchor", "")
        
        results = []
        curr_pos = 0
        with ThreadPoolExecutor() as executor:
            tasks = []
            for i, role in enumerate(roles):
                next_a = roles[i+1]['anchor_sentence'] if i+1 < len(roles) else ""
                # 간소화된 슬라이싱
                start_idx = combined_text.find(role['anchor_sentence'], curr_pos)
                end_idx = combined_text.find(next_a, start_idx + 1) if next_a else len(combined_text)
                if common_anchor:
                    c_idx = combined_text.find(common_anchor, start_idx + 1)
                    if c_idx != -1: end_idx = min(end_idx, c_idx)
                
                sliced = combined_text[start_idx:end_idx] + (combined_text[combined_text.find(common_anchor):] if common_anchor else "")
                tasks.append(executor.submit(analyze_individual_job, sliced, role['title'], meta, roles))
                curr_pos = start_idx + len(role['anchor_sentence'])
            
            results = [f.result() for f in tasks]
            
        print(json.dumps({
            "raw_text": ocr_text,
            "structured": [r for r in results if r],
            "company_name": meta.get('company_name', '알 수 없음'),
            "dart": None # DART는 이제 다른 스크립트에서 처리
        }, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()