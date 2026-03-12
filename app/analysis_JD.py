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

def get_full_page_screenshot(url: str) -> Union[bytes, None]:
    """DOM 청소 및 아이프레임 처리를 포함하여 페이지 전체 스크린샷 캡처."""
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
        
        domain = urlparse(url).netloc
        
        # 1. 초기 텍스트 메타데이터 확보
        top_text = ""
        try:
            top_text = driver.find_element(By.TAG_NAME, "body").text[:1000]
        except Exception: pass

        # 2. 기초 노이즈 제거
        cleanup_js = """
        const noises = ['header', 'footer', 'nav', 'aside', '.gnb', '.popup', '.dimmed', '.jview_floating', '.recommend_wrap'];
        noises.forEach(sel => document.querySelectorAll(sel).forEach(el => el.style.display = 'none'));
        """
        driver.execute_script(cleanup_js)

        # 3. Iframe (공고 본문) 정밀 처리
        target_iframe_selectors = ["#iframe_content_0", "iframe[title*='상세']", "iframe[src*='GI_Read']", "iframe[title='채용상세']"]
        found_iframe = None
        for selector in target_iframe_selectors:
            try:
                found_iframe = driver.find_element(By.CSS_SELECTOR, selector)
                if found_iframe: break
            except: continue
        
        inner_height = 0
        if found_iframe:
            print(f"   📦 본문 Iframe 감지. 내부 스크롤 및 렌더링 중...", file=sys.stderr)
            try:
                driver.switch_to.frame(found_iframe)
                inner_height = driver.execute_script("return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 1000);")
                
                curr = 0
                while curr < inner_height:
                    driver.execute_script(f"window.scrollTo(0, {curr});")
                    curr += 1500
                    time.sleep(0.3)
                driver.execute_script("window.scrollTo(0, 0);")
                time.sleep(1)
                
                driver.switch_to.default_content()
                
                driver.execute_script(f"""
                    const f = document.querySelector("{selector}");
                    if (f) {{
                        f.style.height = '{inner_height}px';
                        f.style.maxHeight = 'none';
                        f.style.display = 'block';
                        f.style.visibility = 'visible';
                        let p = f.parentElement;
                        while(p && p !== document.body) {{
                            p.style.height = 'auto';
                            p.style.overflow = 'visible';
                            p.style.display = 'block';
                            p = p.parentElement;
                        }}
                    }}
                """)
                time.sleep(2)
            except Exception as e:
                print(f"   ⚠️ Iframe 처리 실패: {e}", file=sys.stderr)
                driver.switch_to.default_content()

        # 4. 전체 페이지 스크롤
        print("▶ 지연 로딩 요소 활성화를 위해 스크롤 중...", file=sys.stderr)
        total_h = driver.execute_script("return document.documentElement.scrollHeight")
        if "saramin.co.kr" in domain and "pop-view" not in url:
            total_h = min(total_h, 8000) 
            
        curr_h = 0
        while curr_h < total_h:
            driver.execute_script(f"window.scrollTo(0, {curr_h});")
            curr_h += 1500
            time.sleep(0.1)
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(2)

        # 5. CDP 기반 고해상도 전체 캡처
        layout = driver.execute_cdp_cmd("Page.getLayoutMetrics", {})
        width = max(layout['contentSize']['width'], 1200)
        height = max(layout['contentSize']['height'], inner_height + 500)
        final_height = min(height, 15000)
        
        print(f"📸 CDP 전체 페이지 캡처 ({width} x {final_height})", file=sys.stderr)
        driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": final_height, "deviceScaleFactor": 1, "mobile": False
        })
        time.sleep(3) # 충분한 렌더링 대기
        
        result = driver.execute_cdp_cmd("Page.captureScreenshot", {
            "format": "png", "fromSurface": True, "captureBeyondViewport": True
        })
        
        # screenshot_bytes = base64.b64decode(result['data'])
        screenshot_bytes = base64.b64decode(result['data'])
        
        return screenshot_bytes, top_text

    except Exception as e:
        print(f"❌ 캡처 중 오류: {e}", file=sys.stderr)
        return None, ""
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

def summarize_with_openai(ocr_text: str) -> list:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key: raise RuntimeError("OPENAI_API_KEY가 없습니다.")
    client = OpenAI(api_key=api_key)
    
    fields_mapping = {
        "company_name": "회사명", "recruitment_field": "모집부문", "job_title": "모집직무",
        "main_tasks": "주요업무", "requirements": "자격요건", "preferred_qualifications": "우대사항",
        "location": "근무지", "start_date": "채용시작일", "end_date": "채용마감일", "brief_summary": "공고요약"
    }

    system_prompt = (
        "You are an expert recruiting analyst. Your task is to extract job details from OCR text into a structured JSON format. "
        "The text may contain multiple job roles or recruitment sections. Extract EACH role as a separate object in the 'jobs' array.\n\n"
        "RULES:\n"
        "1. Be EXTREMELY detailed. Do not summarize bullet points. Extract every requirement and task exactly as described.\n"
        "2. For 'main_tasks', 'requirements', and 'preferred_qualifications', use a dash-prefixed bullet list format (- Item 1\\n- Item 2).\n"
        "3. Set missing fields to an empty string \"\". Do not guess.\n"
        "4. Add a 'brief_summary' (공고요약): Provide a clear, human-like 2-3 line summary in Korean for each role.\n"
        "5. Normalize dates to YYYY-MM-DD if possible.\n"
        "6. If the job posting is a table, carefully associate columns like 'Job Title', 'Responsibility', and 'Qualifications' for each row."
    )
    
    user_prompt = f"다음은 채용공고의 OCR 텍스트입니다. 모든 직무 정보를 상세히 추출하여 jobs 배열로 응답해주세요:\n\n{ocr_text}"

    schema = {
        "name": "job_summary_list",
        "schema": {
            "type": "object",
            "properties": {
                "jobs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {f: {"type": "string"} for f in fields_mapping.keys()},
                        "required": list(fields_mapping.keys()),
                        "additionalProperties": False
                    }
                }
            },
            "required": ["jobs"], "additionalProperties": False
        },
        "strict": True
    }

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_schema", "json_schema": schema},
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
    )
    
    raw = completion.choices[0].message.content or "{\"jobs\": []}"
    try:
        obj = json.loads(raw)
        jobs_list = obj.get("jobs", [])
    except:
        jobs_list = []
        
    return [{fields_mapping[k]: str(job.get(k, "") or "") for k in fields_mapping.keys()} for job in jobs_list]

def main() -> None:
    if sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
        
    if len(sys.argv) < 2: sys.exit(1)
    url = sys.argv[1].strip()
    
    try:
        screenshot_bytes, top_text = get_full_page_screenshot(url)
        if not screenshot_bytes: sys.exit(1)
        
        ocr_text = extract_text_with_google_vision(screenshot_bytes)
        if not ocr_text.strip(): sys.exit(1)
        
        combined_text = f"META:\n{top_text}\n\nBODY:\n{ocr_text}"
        structured = summarize_with_openai(combined_text)
        
        print(json.dumps({"raw_text": ocr_text, "structured": structured}, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()