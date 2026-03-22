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
    print(json.dumps({"error": "google-genai 모듈이 설치되지 않았습니다.", "is_valid_resume": False}))
    sys.exit(1)

def extract_pdf_text(pdf_path):
    """PyMuPDF를 사용하여 PDF 파일에서 텍스트를 추출합니다."""
    text = ""
    try:
        doc = fitz.open(pdf_path)
        # 분석을 위해 처음 15페이지 정도를 충분히 읽음
        for i, page in enumerate(doc):
            if i > 15: break 
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        return None

def process_resume(pdf_text, api_key, mode="full"):
    """
    google.genai를 사용하여 문서 유효성 판별 및 핵심 영역 구조화 수행
    CoT(Chain-of-Thought) 기법을 활용하여 판별의 정밀도를 극대화 (논문, 기사 등 차단)
    """
    client = genai.Client(api_key=api_key)
    
    # 토큰 제한 및 효율성을 위해 텍스트 자르기
    truncated_text = pdf_text[:15000]

    # 모드에 따른 작업 지시문 설정 (CoT 기반 설계)
    is_detection_only = (mode == "detection")
    
    prompt = f"""
    당신은 채용 시스템의 수문장이자 정밀 데이터 분석 전문가입니다.
    사용자가 업로드한 문서가 실제 채용 목적의 '이력서/포트폴리오'인지, 아니면 시스템 리소스를 낭비하는 '무관한 문서(논문, 기사, 계약서, 매뉴얼 등)'인지 판별해야 합니다.

    [문서 원문 텍스트]
    {truncated_text}

    ---
    [단계 1: 데이터 강제 추출 시도 (CoT)]
    문서가 무관한 임의의 문서일지라도, 일단 이력서의 7가지 핵심 영역(Skills, Experience, Projects_Activities, Higher_Education, Research_and_Thesis, Other_Training, Certifications_Languages)에 맞게 정보를 억지로라도 정리해 보세요.
    ※ 해당되는 내용이 전혀 없는 필드는 빈 배열 "[]"로 둡니다.

    [단계 2: 추출 데이터 기반 유효성 판별 (Judgement)] 
    단계 1에서 정리된 데이터를 바탕으로 원본 문서가 실제 고용팀이 읽어야 할 '구직용 역량 증명서'인지 최종 판단하세요.
    - 데이터 충실도: 핵심 필드에 유의미한 개인의 '역량 증명(채용용)' 데이터가 실재하는가?
    - 목적성 대조: 화자가 '자신의 경험과 성과'를 세일즈하는 이력서/포트폴리오 형식인가, 아니면 객관적 사실 보도(기사)나 학술적 증명(논문)인가? 
    ※ 학술 논문(Abstract, Methodology 등 포함), 기술 매뉴얼, 계약서 등은 반드시 'is_valid_resume': false로 처리하세요.

    [출력 포맷: 반드시 아래 구조의 순수 JSON만 응답]
    {{
        "is_valid_resume": boolean,
        "extracted_data": {{
            "Skills": ["strings"],
            "Experience": ["strings"],
            "Projects_Activities": ["strings"],
            "Higher_Education": ["strings"],
            "Research_and_Thesis": ["strings"],
            "Other_Training": ["strings"],
            "Certifications_Languages": ["strings"]
        }}
    }}
    ※ "```json" 표식 없이 순수한 JSON 텍스트만 출력하세요.
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=prompt
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
        return {"is_valid_resume": False, "error": str(e)}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "full"

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(base_dir, ".env"))
    
    api_key = os.getenv("GOOGLE_API_KEY")
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    text = extract_pdf_text(pdf_path)
    if not text:
        print(json.dumps({"is_valid_resume": False, "reason": "PDF 텍스트 추출에 실패했습니다."}))
        return

    result = process_resume(text, api_key, mode)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
