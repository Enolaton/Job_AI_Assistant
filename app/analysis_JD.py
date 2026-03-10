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

def _build_chrome_options() -> Options:
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-logging")
    chrome_options.add_argument("--log-level=3")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    return chrome_options

def get_full_page_screenshot(url: str) -> Union[bytes, None]:
    """페이지 전체를 단일 스크린샷으로 찍어 PNG bytes로 반환."""
    chrome_options = _build_chrome_options()
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_page_load_timeout(60)
    try:
        for attempt in range(3):
            try:
                driver.get(url)
                break
            except Exception as e:
                if attempt < 2:
                    time.sleep(3)
                    continue
                raise e
        time.sleep(5)  # 충분한 로딩 대기
        
        # 1. 페이지 전체 너비와 주요 콘텐츠 높이 계산
        total_width = driver.execute_script("return document.body.offsetWidth")
        
        try:
            # 주요 공고 내용이 포함된 엘리먼트를 찾습니다.
            # 사람인의 경우 보통 .jv_view 또는 .user_content 내부에 공고가 있습니다.
            main_element = driver.find_element(By.CSS_SELECTOR, ".jv_view")
            rect = main_element.rect
            # 공고 내용의 끝 지점 + 여유분(100px)만 캡처 범위로 설정
            target_height = int(rect['y'] + rect['height'] + 100)
            print(f"💡 주요 공고 영역 감지 완료 (높이: {target_height}px). 하단 불필요 영역을 제외합니다.")
        except Exception:
            # 감지 실패 시 전체 높이 사용
            target_height = driver.execute_script("return document.body.parentNode.scrollHeight")
            print("⚠️ 주요 영역 감지 실패. 전체 페이지를 캡처합니다.")
        
        # 2. 브라우저 창 크기를 계산된 높이에 맞춤
        driver.set_window_size(total_width, target_height)
        time.sleep(1)
        
        # 3. 스크린샷 캡처
        screenshot = driver.get_screenshot_as_png()
        return screenshot
    except Exception as e:
        print(f"스크린샷 오류: {e}")
        return None
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
        print(f"Google Vision API 연동 오류: {e}")
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
        "Dates should be normalized to YYYY-MM-DD when possible."
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
    # 커맨드라인 인자가 있으면 사용하고, 없으면 사용자 입력을 받음
    if len(sys.argv) > 1:
        url = sys.argv[1].strip()
    else:
        url = input("채용 공고 URL을 입력하세요: ").strip()
        
    if not url:
        print("URL이 비어 있습니다.")
        return

    try:
        print("웹페이지 전체 스크린샷 캡처 중...")
        screenshot_bytes = get_full_page_screenshot(url)
        if not screenshot_bytes:
            print("스크린샷을 생성하지 못했습니다.")
            return
        print("스크린샷 완료, 로컬에 'debug_screenshot.png' 파일로 저장합니다...")
        with open("debug_screenshot.png", "wb") as f:
            f.write(screenshot_bytes)
            
        print("OCR로 텍스트 추출 중 (Google Vision API 사용)...")

        ocr_text = extract_text_with_google_vision(screenshot_bytes)
        if not ocr_text.strip():
            print("이미지에서 텍스트를 추출하지 못했습니다.")
            return

        print(f"OCR 완료 (추출된 텍스트 수: {len(ocr_text)}자). 추출된 원본 텍스트:")
        print("--------------------------------------------------")
        print(ocr_text)
        print("--------------------------------------------------")
        print("공고 요약 중...")
        structured = summarize_with_openai(ocr_text)

        print("\n=== 추출된 채용 정보(JSON) ===")
        print(json.dumps(structured, ensure_ascii=False, indent=2))
        
        # JSON 파일 저장 대신 클라우드 DB로 전송 (요청사항 반영) - 임시 주석 처리
        # save_to_cloud_db(url, ocr_text, structured)
        
    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    main()