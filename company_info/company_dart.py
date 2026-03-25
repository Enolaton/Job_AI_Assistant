import os
import sys
import json
import re
import requests
import zipfile
import io
import pandas as pd
from datetime import datetime, timedelta
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
import urllib3
import warnings
from dotenv import load_dotenv

# 경고 메시지 차단
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

load_dotenv()

# --- 설정 및 경로 ---
# 파일 위치가 company_info/ 폴더이므로 BASE_DIR은 프로젝트 루트가 됨
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, "dart", "dart_corp_codes.csv")
DART_API_KEY = os.getenv("DART_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def clean_company_name(name):
    if not name: return ""
    name = re.sub(r"\( ?주 ?\)|주식회사|㈜|\( ?유 ?\)|유한회사|\( ?사 ?\)|사단법인|\( ?재 ?\)|재단법인|\( ?의 ?\)|의료법인", "", name)
    return name.strip()

import csv

def load_corp_codes():
    if not os.path.exists(CSV_PATH):
        sys.stderr.write(f"경고: 데이터 파일이 없습니다 ({CSV_PATH})\n")
        return {}
    
    corp_codes = {}
    for enc in ['utf-8-sig', 'utf-8', 'cp949']:
        try:
            with open(CSV_PATH, 'r', encoding=enc, newline='') as f:
                reader = csv.reader(f)
                next(reader)
                for row in reader:
                    if len(row) >= 2 and row[0].strip() and row[1].strip():
                        corp_codes[row[1].strip()] = row[0].strip()
            return corp_codes
        except Exception:
            continue
    return {}

def match_phase1_exact(company_name, corp_codes):
    """1차: 원본명 또는 클렌징 후 정확 매칭"""
    if company_name in corp_codes:
        return corp_codes[company_name]
        
    cleaned_target = clean_company_name(company_name)
    for dart_name, code in corp_codes.items():
        if cleaned_target == clean_company_name(dart_name):
            return code
            
    # 포함관계 시도
    for dart_name, code in corp_codes.items():
        if cleaned_target in clean_company_name(dart_name) or clean_company_name(dart_name) in cleaned_target:
            return code
    return None

def match_phase2_gemini(company_name):
    """2차: Gemini LLM으로 법인명 정규화 (Fallback)"""
    if not GOOGLE_API_KEY:
        return None
    try:
        from google import genai
        client = genai.Client(api_key=GOOGLE_API_KEY)
        prompt = f"""다음 기업명을 DART 공식 법인명으로 변환해주세요.
지점/부서명 제거, 접두/접미사((주) 등) 제거.
확신불가 시 null 반환.
입력: {company_name}
출력은 아래 JSON 형식만:
{{"{company_name}": "법인명"}}"""
        response = client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=prompt
        )
        text = response.text.replace('```json', '').replace('```', '').strip()
        result = json.loads(text)
        val = result.get(company_name)
        return None if val == 'null' else val
    except Exception as e:
        sys.stderr.write(f"Gemini 매칭 중 오류: {str(e)}\n")
        return None

def match_phase1(company_name):
    """[DART 단계 1] 통합 매칭 (run_pipeline.py 설계 따름)"""
    corp_codes = load_corp_codes()
    if not corp_codes:
        return None
        
    # 1. Exact / Partial match
    code = match_phase1_exact(company_name, corp_codes)
    if code:
        return code
        
    sys.stderr.write(f"  🤖 1차 매칭 실패. LLM 정규화 시도...\n")
    # 2. Gemini fallback
    llm_name = match_phase2_gemini(company_name)
    if llm_name:
        sys.stderr.write(f"  🤖 LLM 제안: {llm_name}\n")
        code = match_phase1_exact(llm_name, corp_codes)
        if code:
            return code
            
    return None

def get_candidate_reports(corp_code):
    """[DART 단계 2] 고유번호로 우선순위에 따른 모든 후보 사업보고서 목록 조회"""
    url = "https://opendart.fss.or.kr/api/list.json"
    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=1095)).strftime('%Y%m%d')
    
    params = {
        'crtfc_key': DART_API_KEY,
        'corp_code': corp_code,
        'bgn_de': start_date,
        'end_de': end_date,
        'page_count': '30'  # 넉넉히 가져와서 우선순위 필터링을 수행
    }
    candidates = []
    try:
        res = requests.get(url, params=params, verify=False, timeout=15)
        data = res.json()
        
        status = data.get('status')
        message = data.get('message', 'No message')
        sys.stderr.write(f"[DART] API 응답 코드: {status}, 메시지: {message}\n")

        if status == '000' and data.get('list'):
            # 우선순위 정의 (사업 > 반기 > 분기 > 감사)
            priorities = ['사업보고서', '반기보고서', '분기보고서', '감사보고서']
            
            for priority in priorities:
                for item in data['list']:
                    report_nm = item.get('report_nm', '')
                    # 해당 키워드가 포함된 보고서 매칭
                    if priority in report_nm:
                        candidates.append({
                            'rcept_no': item['rcept_no'],
                            'report_nm': report_nm.split('(')[0].strip(),
                            'priority': priority
                        })
            
            # 중복 제거 (동일 rcept_no) 및 순서 유지
            seen_rcept = set()
            unique_candidates = []
            for c in candidates:
                if c['rcept_no'] not in seen_rcept:
                    unique_candidates.append(c)
                    seen_rcept.add(c['rcept_no'])
            
            sys.stderr.write(f"[DART] 찾은 보고서 후보 수: {len(unique_candidates)}\n")
            return unique_candidates
        else:
            sys.stderr.write(f"[DART] 보고서 목록이 비어있거나 API 오류 발생\n")
            
    except Exception as e:
        sys.stderr.write(f"보고서 목록 조회 중 오류: {str(e)}\n")
    return candidates

def summarize_with_genai_dart(text, section_type):
    """[DART 단계 4] 추출된 텍스트 AI 요약 (run_pipeline.py 설계 참조)"""
    if not text or len(text) < 100: return "분석할 내용이 부족합니다."
    
    try:
        from google import genai
        client = genai.Client(api_key=GOOGLE_API_KEY)
        prompts = {
            "business": "다음은 기업의 '사업의 개요' 내용입니다. 이 회사에 지원하려는 취업 준비생 입장에서 꼭 알아야 할 회사의 주요 사업 분야, 산업 내 위치, 핵심 경쟁력 및 미래 비전을 3~4문장으로 알기 쉽게 핵심만 요약해주세요.",
            "products": "다음은 기업의 '주요 제품 및 서비스' 내용입니다. 이 회사가 실제로 돈을 버는 핵심 주력 제품이나 서비스가 무엇인지, 주요 비즈니스 모델이 어떤 것인지 취업 준비생이 직관적으로 이해할 수 있도록 3~4문장으로 요약해주세요.",
            "financial": "다음은 기업의 '요약 재무정보'입니다. 최근 3개년의 매출액, 영업이익, 당기순이익 등의 추이를 바탕으로 회사의 성장성과 재무적 안정성(흑자/적자 추세 등)을 취업 준비생이 회사의 분위기를 파악할 수 있게 가독성 좋고 명확하게 3~4문장으로 요약해주세요."
        }
        
        system_prompt = prompts.get(section_type, "주어진 기업 정보를 취업 준비생이 이해하기 쉽게 핵심만 요약해주세요.")
        
        response = client.models.generate_content(
            model="gemini-2.0-flash", 
            contents=f"{system_prompt}\n\n[원본 내용]\n{text[:20000]}"
        )
        return response.text.strip()
    except Exception as e:
        sys.stderr.write(f"Gemini 요약 중 오류: {str(e)}\n")
        return "요약 생성 오류"

def _find_section_by_title(soup, keywords, **kwargs):
    titles = soup.find_all(['TITLE', 'title'])
    target_sections = []
    
    for title_tag in titles:
        title_text = title_tag.get_text(strip=True).replace(' ', '')
        if any(kw in title_text for kw in keywords):
            parent_section = title_tag.parent
            if parent_section not in target_sections:
                target_sections.append(parent_section)
                
    if not target_sections:
        return None
        
    all_result_lines = []
    for section in target_sections:
        text = section.get_text(separator='\n', strip=True)
        if text:
            all_result_lines.append(text)
    
    if not all_result_lines:
        return None
    return '\n\n'.join(all_result_lines)

def _clean_financial_text(text):
    if not text:
        return ""
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            stripped = re.sub(r'\(\s*주\s*[^)]+\)', '', stripped)
            cleaned.append(stripped)
    return '\n'.join(cleaned)

def analyze_dart_integrated(company_name):
    """[DART 통합 인터페이스]"""
    corp_code = match_phase1(company_name)
    if not corp_code: return {"status": "error", "message": "기업 코드를 찾을 수 없습니다."}
    
    candidates = get_candidate_reports(corp_code)
    if not candidates: 
        return {"status": "error", "message": "조건에 맞는 공고 보고서가 없습니다."}
    
    for candidate in candidates:
        rcept_no = candidate['rcept_no']
        report_nm = candidate['report_nm']
        
        sys.stderr.write(f"[DART] 시도 중인 보고서: {report_nm} (번호: {rcept_no})\n")
        
        url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={DART_API_KEY}&rcept_no={rcept_no}"
        try:
            res = requests.get(url, verify=False, timeout=30)
            
            is_zip = res.content.startswith(b'PK')
            if not is_zip:
                status_msg = "ZIP 아님"
                try:
                    if b'<message>' in res.content:
                        status_msg = res.content.split(b'<message>')[1].split(b'</message>')[0].decode('utf-8')
                except: pass
                sys.stderr.write(f"[DART] 해당 보고서({rcept_no}) 건너뜀: {status_msg}\n")
                continue

            with zipfile.ZipFile(io.BytesIO(res.content)) as z:
                xml_files = [f for f in z.namelist() if f.endswith('.xml')]
                if not xml_files:
                    continue
                
                target_xml = f"{rcept_no}.xml"
                main_xml = target_xml if target_xml in xml_files else max(xml_files, key=lambda f: z.getinfo(f).file_size)
                
                content = z.read(main_xml).decode('utf-8', errors='ignore')
                soup = BeautifulSoup(content, "html.parser")
                
                b_text = _find_section_by_title(soup, ['사업의개요'])
                p_text = _find_section_by_title(soup, ['주요제품', '주요서비스'])
                f_text = _find_section_by_title(soup, ['요약재무', '재무정보요약', '요약연결'])
                
                if not b_text and not p_text and not f_text:
                    sys.stderr.write(f"[DART] 해당 사업분석 섹션 없음({report_nm}), 다음 보고서 탐색\n")
                    continue

                sys.stderr.write(f"[DART] 분석 성공 ({report_nm})\n")
                
                # Extract year from report_nm: e.g. "사업보고서 (2023.12)" -> "2023"
                year_match = re.search(r'\((20\d{2})\.', report_nm)
                extracted_year = year_match.group(1) if year_match else report_nm.split(' ')[0]
                
                return {
                    "status": "success",
                    "company_name": company_name,
                    "report_year": extracted_year,
                    "business": summarize_with_genai_dart(b_text, "business") if b_text else "사업정보 없음",
                    "products": summarize_with_genai_dart(p_text, "products") if p_text else "제품정보 없음",
                    "financial": summarize_with_genai_dart(_clean_financial_text(f_text), "financial") if f_text else "재무정보 없음"
                }
        except Exception as e:
            sys.stderr.write(f"[DART] 처리 실패({rcept_no}): {str(e)}\n")
            continue
            
    return {
        "status": "error", 
        "message": "사용 가능한 보고서를 찾지 못했습니다. (조회된 후보 {0}개 모두 실패)".format(len(candidates))
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "기업명이 필요합니다."}))
        return

    company_name = sys.argv[1].strip()
    result = analyze_dart_integrated(company_name)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
