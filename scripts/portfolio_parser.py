import json
import os
import sys
import io
import fitz  # PyMuPDF
from dotenv import load_dotenv

# Windows 환경에서 한글 깨짐 방지를 위한 표준 출력 인코딩 강제 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

try:
    from google import genai
    from google.genai import types
except ImportError:
    print(json.dumps({"error": "google-genai 모듈이 설치되지 않았습니다.", "is_valid_portfolio": False}))
    sys.exit(1)

def extract_pdf_text(pdf_path):
    """PyMuPDF를 사용하여 PDF 파일에서 텍스트를 추출합니다."""
    text = ""
    try:
        doc = fitz.open(pdf_path)
        # 포트폴리오는 이미지가 많으므로 충분한 페이지를 읽음
        for i, page in enumerate(doc):
            if i > 20: break 
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        return None

def process_portfolio(pdf_text, api_key):
    """
    google.genai를 사용하여 포트폴리오 유효성 판별 및 프로젝트 데이터 구조화 수행
    CoT(Chain-of-Thought) 기법을 활용하여 포트폴리오의 전문성 검증
    """
    client = genai.Client(api_key=api_key)
    
    # 토큰 제한 및 효율성을 위해 텍스트 자르기
    truncated_text = pdf_text[:15000]

    prompt = f"""
    당신은 채용 시스템의 전문 포트폴리오 판독 에이전트입니다.
    사용자가 업로드한 문서 내에 포함된 여러 프로젝트들을 식별하고, 각 프로젝트의 기술적 깊이와 기여도를 정밀 분석해야 합니다.

    [문서 원문 텍스트]
    {truncated_text}

    ---
    [단계 1: 프로젝트 식별 (CoT)]
    문서 전체에서 언급된 주요 프로젝트들의 명칭을 모두 찾아내세요.

    [단계 2: 프로젝트별 상세 분석 (CoT)]
    식별된 각 프로젝트에 대해 다음 항목들을 개별적으로 정리하세요. 
    (Project_Name, Project_Content, Contribution, Summary_of_Results)
    ※ 데이터가 없는 필드는 빈 문자열 ""로 둡니다.

    [단계 3: 추출 데이터 기반 유효성 판별 (Judgement)]
    위 데이터를 바탕으로 원본 문서가 실제 고용팀이 검토할 가치가 있는 '전문 포트폴리오'인지 판단하세요.
    - 변별력: 개별 프로젝트들에 대해 '구체적인 기술적 서술'과 '본인의 역할'이 충분히 드러나는가?
    - 전문성: 단순 이미지 나열이 아닌, 프로젝트의 과정과 성과가 논리적으로 기술되어 있는가?
    ※ 기술적 실체가 부족하거나 단순 과제 수준의 나열만 있다면 'is_valid_portfolio': false로 처리하세요.

    [출력 포맷: 반드시 아래 구조의 순수 JSON만 응답]
    {{
        "is_valid_portfolio": boolean,
        "extracted_data": [
            {{
                "Project_Name": "프로젝트 이름",
                "Project_Content": "내용 요약",
                "Contribution": "기여도 및 역할",
                "Summary_of_Results": "성과 요약"
            }}
        ]
    }}
    ※ "```json" 표식 없이 순수한 JSON 텍스트만 출력하세요.
    """

    try:
        # 결정론적 응답을 위해 0도(Strict) 설정
        config = types.GenerateContentConfig(temperature=0.0)
        
        response = client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=prompt,
            config=config
        )
        
        clean_text = response.text.strip()
        # 마크다운 가드레일
        if clean_text.startswith("```"):
            lines = clean_text.splitlines()
            if lines[0].startswith("```json"):
                clean_text = "\n".join(lines[1:-1])
            else:
                clean_text = "\n".join(lines[1:-1])
        
        return json.loads(clean_text)
    except Exception as e:
        return {"is_valid_portfolio": False, "error": str(e)}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    pdf_path = sys.argv[1]

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(base_dir, ".env"))
    
    api_key = os.getenv("GOOGLE_API_KEY")
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    text = extract_pdf_text(pdf_path)
    if not text:
        print(json.dumps({"is_valid_portfolio": False, "reason": "PDF 텍스트 추출에 실패했습니다."}))
        return

    result = process_portfolio(text, api_key)
    # Backend 호환성을 위해 is_valid_resume 키도 추가 (옵션 또는 필드 통합 용이성)
    if "is_valid_portfolio" in result:
        result["is_valid_resume"] = result["is_valid_portfolio"]

    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
