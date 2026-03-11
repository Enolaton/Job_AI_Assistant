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
    """DOM 청소 및 지연 로딩 우회 처리를 포함하여 페이지 전체 스크린샷 캡처."""
    print(f"▶ URL 접속 중: {url}", file=sys.stderr)
    
    # 브라우저 옵션 설정 (Headless 및 봇 탐지 우회)
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-logging")
    chrome_options.add_argument("--log-level=3")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled") # 봇 탐지 우회
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(options=chrome_options)
    
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"
    })
    
    try:
        driver.get(url)
        time.sleep(3)
        
        domain = urlparse(url).netloc
        
        # 메인 프레임의 텍스트 일부 추출 (근무지, 채용일자 등 메타데이터 확보 목적)
        # 토큰 절약을 위해 상단 1000자만 추출 (일반적으로 메타데이터는 500자 이내에 존재함)
        top_text = ""
        try:
            top_text = driver.find_element(By.TAG_NAME, "body").text[:1000]
        except Exception:
            pass
            
        # 최상단 광역 DOM 청소
        print("▶ 화면 노이즈 제거(팝업, 배너, 하단 섹션 등) 진행 중...", file=sys.stderr)
        clear_all_noise_js = """
        const allNoises = [
            'header', 'nav', 'footer', 'dialog', 'aside',
            '[class*="header"]', '[class*="nav"]', '[class*="footer"]', '[class*="aside"]',
            '[class*="popup"]', '[id*="popup"]', '.layer_wrap', '.dimmed', '[class*="modal"]', '[id*="modal"]',
            '.recommend_wrap', '.review_wrap', '#rec_recommend', '.company_info_wrap',
            '[id*="gnb"]', '[class*="gnb"]',
            '[class*="floating"]', '[id*="floating"]',
            '[style*="position: fixed"]', '[style*="position: sticky"]', '[style*="position: absolute"]',
            '[data-sentry-component="StrategyWrapper"]', '.related-tags', '#recommended-section',
            '[data-sentry-component="Notice"]', '[data-sentry-component="AIRecommendList"]',
            '[data-sentry-component="Aside"]', '[data-sentry-component="Banner"]', '.side-area', '.side-banner',
            '[class*="ChipTag"]', '.artReadTag', '[class*="keyword"]', '[class*="banner"]',
            'iframe[title*="광고"]', 'iframe[id*="google_ads"]'
        ];
        allNoises.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => { 
                el.style.setProperty('display', 'none', 'important'); 
            });
        });

        const targetComponents = ["StrategyWrapper", "BenefitCard", "CorpInformation", "ApplyBox"];
        for (const compName of targetComponents) {
            const startEl = document.querySelector(`[data-sentry-component="${compName}"]`);
            if (startEl && compName === "StrategyWrapper") {
                let next = startEl;
                while(next) {
                    next.style.setProperty('display', 'none', 'important');
                    next = next.nextElementSibling;
                }
                break; 
            } else if (startEl) {
                let next = startEl.nextElementSibling;
                while(next) {
                    next.style.setProperty('display', 'none', 'important');
                    next = next.nextElementSibling;
                }
            }
        }
        
        document.querySelectorAll('div[style*="list-content"]').forEach(el => el.remove());
        """
        driver.execute_script(clear_all_noise_js)
        time.sleep(1)

        # iframe 타겟팅
        if "saramin" in domain:
            print("▶ 사람인 도메인 감지. iframe 내부 본문 진입을 시도합니다.", file=sys.stderr)
            try:
                iframe = driver.find_element(By.ID, "iframe_content_0")
                driver.switch_to.frame(iframe)
                print("   ✅ 사람인 iframe 진입 성공", file=sys.stderr)
                time.sleep(1)
            except Exception:
                print("   ⚠️ iframe을 찾을 수 없습니다. 기본 페이지 캡처를 진행합니다.", file=sys.stderr)
                
        elif "catch.co.kr" in domain:
            print("▶ 캐치 도메인 감지. 채용상세 iframe 내부 진입을 시도합니다.", file=sys.stderr)
            try:
                iframe = driver.find_element(By.XPATH, '//iframe[@title="채용상세"]')
                driver.switch_to.frame(iframe)
                print("   ✅ 캐치 iframe 진입 성공", file=sys.stderr)
                time.sleep(1)
            except Exception:
                print("   ⚠️ iframe을 찾을 수 없습니다. 기본 페이지 캡처를 진행합니다.", file=sys.stderr)

        # 고속 스크롤 (지연 로딩 이미지 렌더링)
        print("▶ 지연 로딩 이미지 렌더링을 위해 스크롤 중...", file=sys.stderr)
        last_height = driver.execute_script("return document.body.scrollHeight")
        max_scroll_attempts = 15
        attempts = 0
        current_position = 0
        
        while attempts < max_scroll_attempts:
            attempts += 1
            step_limit = min(last_height, 15000)
            
            while current_position < step_limit:
                driver.execute_script(f"window.scrollTo(0, {current_position});")
                current_position += 800
                time.sleep(0.1)
            
            time.sleep(1.0)
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height or current_position >= 15000:
                break
            last_height = new_height

        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(1)
        
        print("▶ 지연 로딩된 노이즈 요소 추가 제거 중...", file=sys.stderr)
        driver.execute_script(clear_all_noise_js)
        time.sleep(1)
        
        required_width = driver.execute_script('return document.documentElement.scrollWidth')
        required_height = driver.execute_script('return document.body.scrollHeight')
        
        required_height += 150
        required_height = min(required_height, 20000)
        
        print(f"▶ 창 크기 세팅 및 전체 캡처 진행 중... (예상 해상도: {required_width} x {required_height})", file=sys.stderr)
        driver.set_window_size(required_width, required_height)
        time.sleep(2)
        
        # 전체 화면 캡처 저장 후 bytes로 반환
        body = driver.find_element(By.TAG_NAME, "body")
        screenshot = body.screenshot_as_png
        print("✅ 최적화된 스크린샷 캡처 완료!", file=sys.stderr)
        
        return screenshot, top_text
        
    except Exception as e:
        print(f"❌ 캡처 중 오류 발생: {e}", file=sys.stderr)
        return None, ""
    finally:
        driver.quit()

def extract_text_with_google_vision(image_bytes: bytes) -> str:
    """스크린샷 이미지를 Google Cloud Vision API로 OCR하여 텍스트 추출."""
    try:
        # GOOGLE_APPLICATION_CREDENTIALS 환경 변수가 지정되어 있어야 작동합니다.
        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        
        # 텍스트(문서) 감지 모범 사례인 document_text_detection 사용
        response = client.document_text_detection(image=image)
        
        if response.error.message:
            raise Exception(f"{response.error.message}")
            
        # 추출된 전체 텍스트 반환
        if response.text_annotations:
            return response.text_annotations[0].description
        return ""
    except Exception as e:
        print(f"Google Vision API 연동 오류: {e}", file=sys.stderr)
        return ""

def summarize_with_openai(ocr_text: str) -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY 환경 변수가 설정되어 있지 않습니다.")

    client = OpenAI(api_key=api_key)

    # OpenAPI JSON Schema 제한사항(알파벳/숫자/_ 만 허용 등) 회피 및 정확도를 위해 영문 키 사용
    fields_mapping = {
        "company_name": "회사명",
        "recruitment_field": "모집부문",
        "job_title": "모집직무",
        "main_tasks": "주요업무",
        "requirements": "자격요건",
        "preferred_qualifications": "우대사항",
        "location": "근무지",
        "start_date": "채용시작일",
        "end_date": "채용마감일"
    }

    system_prompt = (
        "You are an assistant that extracts structured recruiting information "
        "from the text. The input text may contain MULTIPLE job listings or roles. "
        "Extract ALL valid job roles into an array of objects. "
        "IGNORE recommended or similar jobs at the very bottom, but capture all main roles. "
        "You MUST NOT hallucinate. If a field is not explicitly mentioned, set it to an empty string \"\". "
        "Dates should be normalized to YYYY-MM-DD when possible.\n"
        "IMPORTANT: For '주요업무' (main_tasks), '자격요건' (requirements), and '우대사항' (preferred_qualifications), "
        "DO NOT use a single long paragraph. Instead, summarize them into concise bullet points using dashes (e.g., '- First point\\n- Second point'). "
        "Keep the summary brief, readable, and well-structured."
    )

    user_prompt = (
        "다음은 채용 공고의 OCR 결과 텍스트입니다.\n"
        "아래 텍스트를 바탕으로 모든 채용 직무 정보를 추출하여 배열(리스트) 형태의 JSON으로 제공해주세요.\n"
        "텍스트에 명시적으로 없는 정보는 절대로 추측하지 말고, 그 필드는 빈 문자열(\"\")로 두세요.\n"
        "=== OCR TEXT START ===\n"
        f"{ocr_text}\n"
        "=== OCR TEXT END ==="
    )

    schema = {
        "name": "job_posting_summary_list",
        "schema": {
            "type": "object",
            "properties": {
                "jobs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            field: {"type": "string"} for field in fields_mapping.keys()
                        },
                        "required": list(fields_mapping.keys()),
                        "additionalProperties": False,
                    }
                }
            },
            "required": ["jobs"],
            "additionalProperties": False,
        },
        "strict": True,
    }

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={
            "type": "json_schema",
            "json_schema": schema,
        },
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    raw = completion.choices[0].message.content or "{\"jobs\": []}"

    try:
        obj = json.loads(raw)
        jobs_list = obj.get("jobs", [])
    except json.JSONDecodeError:
        jobs_list = []

    # 결과를 한글 키로 다시 변환하며, null 이거나 없는 값은 빈 문자열로 처리
    normalized_list = [
        {fields_mapping[k]: str(job.get(k, "") or "") for k in fields_mapping.keys()}
        for job in jobs_list
    ]
    return normalized_list

def save_to_cloud_db(url: str, ocr_text: str, structured: dict):
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL 환경 변수가 없습니다. 저장을 생략합니다.")
        return

    try:
        # psycopg2는 URL 파라미터(예: ?pgbouncer=true)를 지원하지 않는 경우가 많으므로 제거 후 연결
        clean_db_url = db_url.split("?")[0] if "?" in db_url else db_url
        conn = psycopg2.connect(clean_db_url)
        cursor = conn.cursor()
        
        # 첫 번째 사용자 ID 가져오기 (테스트 환경)
        # 서비스 연동 시에는 Next.js API를 통해 전달받은 세션의 user_id를 사용해야 합니다.
        cursor.execute("SELECT id FROM users LIMIT 1")
        user_row = cursor.fetchone()
        
        # 만약 연결된 DB에 유저가 아직 없다면 테스트 유저를 생성합니다.
        if user_row:
            user_id = user_row[0]
        else:
            cursor.execute("""
                INSERT INTO users (id, email, password, name, \"updatedAt\") 
                VALUES ('python-test-id', 'test@test.com', 'test', 'TestUser', NOW()) 
                RETURNING id
            """)
            user_id = cursor.fetchone()[0]

        company_name = structured.get("회사명", "알수없음")
        job_title = structured.get("모집직무", "직무 미상")
        analysis_result = json.dumps(structured, ensure_ascii=False)
        
        cursor.execute("""
            INSERT INTO job_analyses (user_id, company_name, job_title, jd_url, jd_raw_text, analysis_result, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (user_id, company_name, job_title, url, ocr_text, analysis_result))
        
        conn.commit()
        cursor.close()
        conn.close()
        print(f"💡 분석 결과가 클라우드 DB(job_analyses 테이블)에 성공적으로 저장되었습니다.")
        
    except Exception as e:
        print(f"클라우드 DB 저장 중 오류 발생: {e}")

def main() -> None:
    # 윈도우 환경 등에서 출력 인코딩 깨짐을 방지하기 위해 UTF-8 강제 설정
    if sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
        
    # 커맨드라인 인자가 있으면 사용하고, 없으면 사용자 입력을 받음
    if len(sys.argv) > 1:
        url = sys.argv[1].strip()
    else:
        print("URL 인자가 없습니다.", file=sys.stderr)
        sys.exit(1)
        
    if not url:
        print("URL이 비어 있습니다.", file=sys.stderr)
        sys.exit(1)

    try:
        print("웹페이지 전체 스크린샷 캡처 중...", file=sys.stderr)
        screenshot_bytes, top_text = get_full_page_screenshot(url)
        if not screenshot_bytes:
            print("스크린샷을 생성하지 못했습니다.", file=sys.stderr)
            sys.exit(1)
            
        print("스크린샷 완료! (메모리에서 바로 처리합니다...)", file=sys.stderr)
            
        print("OCR로 텍스트 추출 중 (Google Vision API 사용)...", file=sys.stderr)

        ocr_text = extract_text_with_google_vision(screenshot_bytes)
        if not ocr_text.strip():
            print("이미지에서 텍스트를 추출하지 못했습니다.", file=sys.stderr)
            sys.exit(1)

        print(f"OCR 완료 (추출된 텍스트 수: {len(ocr_text)}자).", file=sys.stderr)
        print("공고 요약 중...", file=sys.stderr)
        
        combined_text = f"=== 상단 메타데이터(근무지, 마감일 등) ===\n{top_text}\n\n=== 상세 본문 영역(OCR) ===\n{ocr_text}"
        structured = summarize_with_openai(combined_text)

        # JSON 형식으로 결과만 표준출력(stdout)으로 전송 (Next.js 가 파싱하기 위함)
        ans = {
            "raw_text": ocr_text,
            "structured": structured
        }
        print(json.dumps(ans, ensure_ascii=False))
        
    except Exception as e:
        print(f"오류 발생: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()