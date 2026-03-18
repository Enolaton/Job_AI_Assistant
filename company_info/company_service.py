import sys
import os
import json
import time
import requests # type: ignore # 네이버 뉴스 API 호출을 위한 라이브러리 추가
from email.utils import parsedate_to_datetime # RFC 822 날짜 파싱 용도
from datetime import datetime
from dotenv import load_dotenv # type: ignore # 환경 변수 로드
from google import genai # type: ignore
from google.genai import types # type: ignore

# 환경 변수(Environment Variables) 로딩
load_dotenv()

class CompanyService:
    def __init__(self, api_key=None):
        api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY가 설정되지 않았습니다.")
        
        # 모델 설정(Model Setup): 가성비와 성능이 뛰어난 gemini-2.0-flash 사용
        self.model_name = "gemini-2.0-flash" 
        self.client = genai.Client(api_key=api_key)
        
        # 네이버 API 설정(Naver API Configuration)
        self.naver_id = os.getenv("NAVER_CLIENT_ID")
        self.naver_secret = os.getenv("NAVER_CLIENT_SECRET")

    def get_naver_news(self, company_name, job_title):
        """네이버 검색 API(Naver Search API)를 호출(Invoke)하여 최신순(Recent) 뉴스를 다중 쿼리로 수집합니다."""
        url = "https://openapi.naver.com/v1/search/news.json"
        headers = {
            "X-Naver-Client-Id": self.naver_id,
            "X-Naver-Client-Secret": self.naver_secret
        }
        
        # 다중 쿼리 전략(Multi-query Strategy)
        queries = [
            f"{company_name} (채용 | 신사업 | 전략 | 전망)",
            f"{company_name} {job_title}"
        ]
        
        all_news_items = []
        seen_urls = set()

        for query in queries:
            # 뉴스 품질 향상을 위해 연도 키워드 추가 및 관련도순(sim)으로 복구
            params = { 
                "query": f"{query} 2025", 
                "display": 10, 
                "sort": "sim" # 최신성과 정확도의 균형을 위해 관련도순으로 복합 적용
            }
            try:
                response = requests.get(url, headers=headers, params=params, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    for item in data.get('items', []):
                        if item['link'] not in seen_urls and "news.naver.com" in item['link']:
                            title = item['title'].replace("<b>", "").replace("</b>", "").replace("&quot;", "\"")
                            description = item['description'].replace("<b>", "").replace("</b>", "").replace("&quot;", "\"")
                            # 날짜 형식 변환 (Convert Date Format): 'Wed, 18 Mar 2026...' -> '2026년 03월 18일'
                            pub_date = item.get('pubDate', '')
                            try:
                                dt = parsedate_to_datetime(pub_date)
                                # 파싱 결과가 None이 아닌지 확인하여 안정성 강화 (Safety Check)
                                if dt:
                                    formatted_date = dt.strftime("%Y년 %m월 %d일")
                                else:
                                    formatted_date = pub_date
                            except:
                                formatted_date = pub_date # 파싱 실패 시 원본 유지 (Keep Original if Failed)

                            all_news_items.append({
                                "title": title, "description": description,
                                "url": item['link'], "pub_date": formatted_date
                            })
                            seen_urls.add(item['link'])
            except Exception as e:
                sys.stderr.write(f"\n[Naver API Error] {str(e)}\n")

        return all_news_items[:5] # type: ignore

    def get_company_analysis(self, company_name, job_title):
        """기업의 인재상(Ideal Candidate) 및 조직문화(Culture)를 개별 키워드 중심으로 심층 분석합니다."""
        analysis_prompt = f"""
        당신은 전문 채용 컨설턴트입니다. '{company_name}' 기업의 '{job_title}' 직무를 위해 아래 정보를 **개별 특징별로 분절하여** 분석하세요.
        
        1. 인재상: 기업이 추구하는 핵심 가치와 인재의 모습 (최소 2개 이상의 키워드).
        2. 조직문화: 일하는 방식, 소통 환경, 의사결정 구조 등 내적 문화 (최소 2개 이상의 키워드). 
           **주의: 식비, 보험, 휴가 등 '복지 혜택' 관련 내용은 절대 포함하지 마세요.**

        반드시 각 항목을 명확한 키워드와 그에 따른 상세 내용으로 구분하여 JSON으로 출력하세요.
        """
        try:
            # 1단계: 검색 기반 기초 분석(Initial Analysis)
            # 최신 SDK 규격에 맞춰 구글 검색 도구 선언 방식을 수정합니다 (Fix Type Mismatch)
            raw_analysis = self.client.models.generate_content(
                model=self.model_name,
                contents=analysis_prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())]
                )
            )
            
            # 2단계: 복지 데이터 제거 및 출력 규격 강제(Validation & Refinement)
            validation_prompt = f"""
            당신은 데이터 정제 전문가입니다. 아래 데이터를 정제하여 '{company_name}'의 최종 리포트를 작성하세요.
            
            [원천 데이터(Raw Data)]:
            {raw_analysis.text}

            [작성 규칙(Strict Rules)]:
            1. **계층 구조**: 반드시 '인재상'과 '조직문화' 각각에 대해 2개 이상의 별도 항목(Object)을 만드세요.
            2. **내용 집중**: 조직문화 섹션에서 단순 복지(식사, 연차 등)는 **모두 삭제**하고, 조직 고유의 '협업 방식'이나 '소통 철학'만 남기세요.
            3. **문단 금지**: 전체 내용을 하나의 긴 문단으로 작성하지 말고, 반드시 '키워드'와 '내용'으로 분리된 리스트 형식을 유지하세요.
            
            [응답 구조(JSON Format)]:
            {{
                "analysis": {{
                    "인재상": [
                        {{ "키워드": "핵심가치1", "내용": "분석 내용" }},
                        {{ "키워드": "핵심가치2", "내용": "분석 내용" }}
                    ],
                    "조직문화": [
                        {{ "키워드": "문화특징1", "내용": "분석 내용" }},
                        {{ "키워드": "문화특징2", "내용": "분석 내용" }}
                    ]
                }}
            }}
            """
            final_response = self.client.models.generate_content(
                model=self.model_name,
                contents=validation_prompt
            )
            text = final_response.text.strip()
            
            # JSON 추출 및 정제 로직 강화 (Robust Parsing)
            if "```json" in text: text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text: text = text.split("```")[1].split("```")[0].strip()
            
            parsed_data = json.loads(text)
            
            # 계층 구조 보장 (Layer Normalization)
            if "analysis" in parsed_data:
                return parsed_data["analysis"]
            return parsed_data
        except Exception as e:
            sys.stderr.write(f"\n[Analysis Error] {str(e)}\n")
            return {"인재상": [], "조직문화": []}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "회사명이 필요합니다."}))
        return

    company_name = sys.argv[1]
    job_title = sys.argv[2] if len(sys.argv) > 2 else ""
    mode = sys.argv[3] if len(sys.argv) > 3 else "all" # all, news, analysis

    service = CompanyService()
    
    result = {}
    if mode in ["all", "news"]:
        result["news"] = service.get_naver_news(company_name, job_title)
    if mode in ["all", "analysis"]:
        result["analysis"] = service.get_company_analysis(company_name, job_title)
    
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
