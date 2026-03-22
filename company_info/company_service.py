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
        """네이버 검색 API를 호출하며, 유사도순 기사 중 '네이버 뉴스(In-link)' 페이지만 수집합니다."""
        url = "https://openapi.naver.com/v1/search/news.json"
        headers = {
            "X-Naver-Client-Id": self.naver_id,
            "X-Naver-Client-Secret": self.naver_secret
        }
        
        # 쿼리 전략: 기업명 단독 검색 (사용자 요청)
        queries = [company_name]
        
        all_news_items = []
        seen_urls = set()

        for query in queries:
            params = { 
                "query": query, 
                "display": 50, # 인링크 기사 확률을 높이기 위해 검색량을 50개로 유지
                "sort": "sim" # 유사도순 정렬 (원복)
            }
            try:
                response = requests.get(url, headers=headers, params=params, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    for item in data.get('items', []):
                        # 네이버 뉴스(news.naver.com) 인링크 기사만 선별
                        if item['link'] not in seen_urls and "news.naver.com" in item['link']:
                            title = item['title'].replace("<b>", "").replace("</b>", "").replace("&quot;", "\"").replace("&amp;", "&")
                            description = item['description'].replace("<b>", "").replace("</b>", "").replace("&quot;", "\"").replace("&amp;", "&")
                            
                            pub_date = item.get('pubDate', '')
                            dt = datetime.min
                            try:
                                dt = parsedate_to_datetime(pub_date)
                                formatted_date = dt.strftime("%Y년 %m월 %d일") if dt else pub_date
                            except Exception:
                                formatted_date = pub_date

                            all_news_items.append({
                                "title": title, "description": description,
                                "url": item['link'], "pub_date": formatted_date,
                                "_raw_date": dt or datetime.min  # 정렬용 (파싱 실패시 최소값)
                            })
                            seen_urls.add(item['link'])
                else:
                    sys.stderr.write(f"\n[Naver API Error] Status: {response.status_code}\n")
            except Exception as e:
                sys.stderr.write(f"\n[Naver API Request Error] {str(e)}\n")

        # 1. 50개의 유사도순(관련도 1순위) 기사 중
        # 2. 날짜 최신순(2순위)으로 재정렬하여 최종 5개 반환
        all_news_items.sort(key=lambda x: x["_raw_date"], reverse=True)
        
        # 반환 전 불필요한 _raw_date 키 제거
        for item in all_news_items:
            item.pop("_raw_date", None)

        return all_news_items[:5]  # type: ignore

    def get_company_analysis(self, company_name, job_title):
        """기업의 인재상(Ideal Candidate) 및 조직문화(Culture)를 개별 키워드 중심으로 심층 분석합니다."""
        analysis_prompt = f"""
        당신은 전문 채용 컨설턴트 및 기업 분석가입니다. 구직자가 '{company_name}'에 '{job_title}' 직무로 지원하려고 합니다.
        
        당신의 임무는 구글 검색 기능을 사용하여 **해당 공고(직무 내용)가 아닌, '{company_name}' 기업 전체의 '공식적인 핵심 가치', '전사적 인재상', '고유의 조직문화'**를 조사하는 것입니다.
        회사의 공식 홈페이지, 채용 페이지(Careers), 혹은 기업 인터뷰 기사 등을 검색하여 아래 2가지 항목을 '절대 겹치지 않게' 엄격히 구분하여 추출해 주세요.
        
        1. 인재상 (사람 중심): '{company_name}'이 직원 개인에게 요구하는 '가치관', '성향', '태도', '마인드셋' (최대 4개까지만 요약).
           - 예시: "주도적인 실행력", "데이터 기반의 사고", "끊임없는 학습" (개인이 갖춰야 할 특성)
        2. 조직문화 (환경/시스템 중심): '{company_name}'이라는 조직 전체가 일하는 방식, 팀워크, 의사결정 프로세스, 사내 분위기 (최대 4개까지만 요약). 
           - 예시: "수평적인 소통", "애자일 기반의 스프린트", "실패를 용인하는 문화" (조직의 환경적 특성)
           **주의: 식비, 보험, 휴가 등 '단순 복지 혜택' 관련 내용은 절대 포함하지 마세요.**

        검색된 실제 기업 공식 자료를 바탕으로, 두 항목의 내용이 중복되지 않도록 명확한 키워드와 그에 따른 상세 내용으로 구분하여 JSON 형태로 정리해 주세요.
        """
        try:
            # 1단계: 검색 기반 기초 분석(Initial Analysis)
            raw_analysis = self.client.models.generate_content(
                model='gemini-2.5-flash',
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
            1. **계층 구조**: 반드시 '인재상'과 '조직문화' 각각에 대해 2~4개의 별도 항목(Object)을 만드세요 (절대 4개를 초과하지 않도록 엄격히 제한).
            2. **명확한 분장 (가장 중요)**: 
               - '인재상'에는 '개인(사람)의 성향/태도'만 남기세요. 
               - '조직문화'에는 '회사(팀) 일하는 방식/소통/시스템'만 남기세요. 둘의 내용이 절대 비슷하거나 겹치지 않게 완전히 분리하세요.
            3. **복지 삭제**: 조직문화 섹션에서 단순 복지(식사, 연차 등)는 **모두 삭제**하세요.
            4. **문단 금지**: 전체 내용을 하나의 긴 문단으로 작성하지 말고, 반드시 '키워드'와 '내용'으로 분리된 리스트 형식을 유지하세요.
            
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
            
            # 계층 구조 보장 및 각 항목 최대 4개 강제 절단 (Layer Normalization & Slicing)
            if "analysis" in parsed_data:
                if isinstance(parsed_data["analysis"].get("인재상"), list):
                    parsed_data["analysis"]["인재상"] = parsed_data["analysis"]["인재상"][:4]
                if isinstance(parsed_data["analysis"].get("조직문화"), list):
                    parsed_data["analysis"]["조직문화"] = parsed_data["analysis"]["조직문화"][:4]
                return parsed_data["analysis"]
                
            if isinstance(parsed_data.get("인재상"), list):
                parsed_data["인재상"] = parsed_data["인재상"][:4]
            if isinstance(parsed_data.get("조직문화"), list):
                parsed_data["조직문화"] = parsed_data["조직문화"][:4]
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
