import sys
import os
import json
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

# 환경 변수 로드
load_dotenv()

class CompanyService:
    def __init__(self, api_key=None):
        api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY가 설정되지 않았습니다.")
        
        # 최신 모델 사용 (2026년 기준 2.5-flash가 안정적인 최신 데이터 보유)
        # 새로운 google-genai SDK (v1.6.0+) 사용
        self.model_name = "gemini-2.5-flash"
        self.client = genai.Client(api_key=api_key)

    def get_unified_report(self, company_name, job_title):
        sys.stderr.write(f"\n[AI Analysis] '{company_name}' 관련 정보를 분석 중...\n")

        current_date = time.strftime("%Y년 %m월 %d일")
        prompt = f"""
        당신은 취업 지원자를 돕는 기업 분석 전문가입니다. 
        오늘 날짜는 **{current_date}**입니다. 
        
        '{company_name}' 기업과 '{job_title}' 직무에 대한 **현재 시점(2026년 3월)**의 가장 최신 인재상, 기업문화, 그리고 관련 뉴스를 분석하여 리포트를 작성해 주세요.
        
        [분석 요청 사항]
        1. **최신 뉴스 (News)**: 
           - 반드시 **2025년~2026년** 사이에 발생한 정보를 우선하여 최신 주요 뉴스 5개를 선정하세요.
           - {current_date}에 근접한 뉴스를 최우선으로 배치하십시오.
           - 날짜가 2024년 이전인 뉴스는 가급적 제외하십시오.
           - 제목, 요약, URL, 날짜를 정확히 포함하십시오.
        2. **인재상 (Core Values)**: 공식 홈페이지의 2026년 최신 인재상을 3~4가지 추출하세요. (키워드, 상세 설명, 실제 원문 인용, 출처 URL)
        3. **조직문화 (Organization Culture)**: 현재의 사내 문화, 최신 복리후생 정보를 3~4가지 추출하세요. (근거 및 출처 URL 포함)

        [중요 규칙]
        - **최신성 보장**: 2~3년 전의 낡은 정보가 아닌, 현재 시점에서 유효한 정보를 제공하십시오.
        - 만약 특정 정보가 너무 오래되었다면, 차라리 최근의 사업 계획이나 공시 자료를 바탕으로 분석하십시오.
        - 정보가 없는 경우 빈 배열 `[]` 로 표시하십시오.
        - 모든 항목에 대해 가능한 경우 출처 URL을 기재하십시오.
        - 답변은 반드시 아래의 JSON 형식을 엄격히 따르십시오. 추가 텍스트 없이 JSON만 출력하세요.

        [JSON 구조]
        {{
            "news": [
                {{ "title": "...", "description": "...", "url": "...", "pub_date": "..." }},
                ...
            ],
            "analysis": {{
                "인재상": [
                    {{ "키워드": "...", "내용": "...", "근거": "페이지 내 실제 원문 인용", "출처": "URL" }},
                    ...
                ],
                "조직문화": [
                    {{ "키워드": "...", "내용": "...", "근거": "페이지 내 실제 원문 인용", "출처": "URL" }},
                    ...
                ]
            }}
        }}
        """

        try:
            # 호출
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            
            if not response.text:
                raise ValueError("AI로부터 유효한 응답을 받지 못했습니다.")
                
            text = response.text.strip()
            
            # JSON 정제
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            # 유효성 확인
            json.loads(text)
            return text

        except Exception as e:
            sys.stderr.write(f"\n[Error] {str(e)}\n")
            return json.dumps({
                "news": [],
                "analysis": {"인재상": [], "조직문화": []},
                "error": str(e)
            }, ensure_ascii=False)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "회사명이 필요합니다."}))
        return

    company_name = sys.argv[1]
    job_title = sys.argv[2] if len(sys.argv) > 2 else ""

    service = CompanyService()
    print(service.get_unified_report(company_name, job_title))

if __name__ == "__main__":
    main()
