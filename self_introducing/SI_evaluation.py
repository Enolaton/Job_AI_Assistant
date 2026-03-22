# -*- coding: utf-8 -*-
import json
import os
import time
import google.generativeai as genai
import re
import statistics

# [설정] 실행 시간 측정 여부 (필요 없을 시 False로 변경하거나 이 관련 코드 삭제 가능)
MEASURE_TIME = True

def load_json(file_path):
    """로컬 JSON 파일 로드"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_manager_evaluation_si_prompt(jd_data, app_data):
    """지점장(기술) 평가 프롬프트 생성"""
    job_title = jd_data.get("모집직무", "해당 직무")
    jd_for_hardskills = {
        "주요업무": jd_data.get("주요업무", ""),
        "자격요건": jd_data.get("자격요건", ""),
        "우대사항": jd_data.get("우대사항", ""),
        "상세내용": jd_data.get("상세내용", "")
    }
    jd_for_projects = {
        "주요업무": jd_data.get("주요업무", ""),
        "상세내용": jd_data.get("상세내용", "")
    }
    qna_list = app_data.get("qna", [])
    formatted_answers = ""
    for i, item in enumerate(qna_list, 1):
        question = item.get("question", "")
        answer = item.get("answer", "")
        formatted_answers += f"[문항 {i}] {question}\n[답변 {i}] {answer}\n\n"

    return f"""
    당신은 {job_title} 분야의 10년 차 채용 전문가이자 팩트 추출 전문가입니다.
    현재 지원자의 [자기소개서 답변]과 회사의 [JD 정보]가 주어집니다.
    반드시 다음 '두 가지 단계(Step)'를 순서대로 수행하여 객관적인 결과를 하나의 통합된 JSON 형태로 출력하세요.

    [지원자 자기소개서 내용]
    {formatted_answers}

    [입력 데이터 (JD 정보)]
    - JD 하드스킬 필터링: {json.dumps(jd_for_hardskills, ensure_ascii=False)}
    - JD 프로젝트 필터링: {json.dumps(jd_for_projects, ensure_ascii=False)}

    [수행 지침]
    1. 첫 번째로, [지원자 자기소개서 내용]만을 읽고 명시된 '하드 스킬'과 '수행한 프로젝트' 정보를 추출하여 "extracted_facts" 스키마에 정리하세요. (단, 없는 내용은 지어내지 마세요.)
       - **주의사항**: 하드스킬을 추출할 때, 단순한 '입사 후 포부', '관심 분야', '의지'의 형태로 서술된 키워드는 절대 추출하지 마십시오. 지원자가 과거 학과정, 연구, 프로젝트, 실무 경험 등을 통해 **직접 다루어보았거나 실체가 입증된(실제로 보유한) 하드스킬**만 엄격하게 분리하여 "hard_skills" 리스트에 담으십시오.
    2. 두 번째로, 방금 1단계에서 본인이 직접 추출한 스킬 및 프로젝트 정보와 제공된 [입력 데이터 (JD 정보)]를 대조하여 5점 만점으로 "evaluation_results" 스키마에 점수와 근거를 기입하세요.
       - extracted_facts에 입력된 지원자의 하드스킬들이 JD 하드스킬 필터링 내용에 제시된 자격요건을 만족시키고 업무를 수행할 때 필요한 스킬셋인지 판단하여 점수를 매깁니다.
       - extracted_facts에 입력된 지원자의 프로젝트들이 JD 프로젝트 필터링 내용에 제시된 업무와 관련된 프로젝트들인지 판단하여 점수를 매깁니다.
       - **기술적 추론(Technical Inference)**: 지원자가 AI 모델(ResNet, YOLO 등)이나 고급 라이브러리 사용 경험을 명시했다면, 이를 바탕으로 해당 모델을 구현/활용하는 데 필수적인 프로그래밍 역량(예: Python 프로그래밍, 개발 경험 등)이 내재되어 있음을 논리적으로 추론하십시오. 자소서에 'Python 사용기재'나 '개발 경험'이라는 표면적인 단어가 명시되지 않았다는 이유만으로 역량이 부족하다고 오판하여 약점(weaknesses)으로 삼아서는 절대 안 됩니다.
       - **주의사항**: 자기소개서 특성상 '학위', '영어성적', '자격증' 관련 내용은 자소서에 따로 언급되어 있지 않다고 해서 절대로 약점(weaknesses)으로 간주하거나 감점 요인으로 평가하지 마십시오. 단, 자소서에 해당 내용이 언급되어 있고 JD의 우대사항/자격요건과 일치한다면, 이를 강점(strengths)으로 평가에 긍정적으로 반영하십시오.

    [반드시 지켜야 할 응답 형식 (JSON)]
    {{
        "extracted_facts": {{
            "hard_skills": ["스킬1", "스킬2", ...],
            "projects": [
                {{
                    "프로젝트명": "프로젝트 이름",
                    "프로젝트 내용": "수행 내용",
                    "문제와 해결": "직면한 난관과 극복 과정",
                    "성과 수치 및 수상 등 입증가능한 성과 유무": "구체적 성과",
                    "직무 연관성": "직무와의 연관성",
                    "활용 스킬": ["스킬A", "스킬B"]
                }}
            ]
        }},
        "evaluation_results": {{
            "hard_skill_evaluation": {{
                "base_jd_requirements": "참조한 JD 내용 요약",
                "reasoning": {{
                    "strengths": ["강점1", "강점2", ...],
                    "weaknesses": ["약점1", "약점2", ...]
                }},
                "score": 0.0
            }},
            "project_evaluation": {{
                "base_jd_responsibilities": "참조한 JD 내용 요약",
                "reasoning": {{
                    "strengths": ["강점1", "강점2", ...],
                    "weaknesses": ["약점1", "약점2", ...]
                }},
                "score": 0.0
            }}
        }}
    }}
    """

def run_manager_evaluation_si(jd_data, app_data, api_key, return_prompt=False):
    """
    [CoT 기반 단일 평가 에이전트]
    핵심 평가 로직
    """
    print(f"    - [통합 평가 모델] 팩트 추출 및 채점 동시 진행 중...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"temperature": 0.0, "response_mime_type": "application/json"})

    prompt = get_manager_evaluation_si_prompt(jd_data, app_data)
    response = model.generate_content(prompt)
    text = response.text.strip()

    
    # JSON 파싱 (에러 발생 시 백업 처리 고려)
    if "```" in text:
        text = re.sub(r'```(?:json)?', '', text).strip()
    
    try:
        # 텍스트 내의 실제 JSON 부분만 추출 시도 (가장 바깥쪽 { } 찾기)
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != 0:
            text = text[start:end]
        parsed_data = json.loads(text)
    except Exception as e:
        print(f"    [통합 평가 모델] 파싱 에러 발생: {e}")
        parsed_data = {
            "extracted_facts": {"hard_skills": [], "projects": []},
            "evaluation_results": {
                "hard_skill_evaluation": {"score": 0.0, "reasoning": {"strengths": [], "weaknesses": ["에러 발생"]}},
                "project_evaluation": {"score": 0.0, "reasoning": {"strengths": [], "weaknesses": ["에러 발생"]}}
            }
        }
    
    # 최종 점수 계산
    hard_score = float(parsed_data.get("evaluation_results", {}).get("hard_skill_evaluation", {}).get("score", 0))
    proj_score = float(parsed_data.get("evaluation_results", {}).get("project_evaluation", {}).get("score", 0))
    final_score = round((hard_score + proj_score) / 2, 2)
    
    result = {
        "extracted_facts": parsed_data.get("extracted_facts", {}),
        "evaluation_results": parsed_data.get("evaluation_results", {}),
        "summary": {"final_score": final_score}
    }
    if return_prompt:
        result["prompt"] = prompt
    return result


def calculate_sentence_length_cv(text):
    """
    텍스트 내 문장 길이의 구조적 정형성(균일성) 지표인 
    문장 길이 변동계수(CV = 표준편차 / 평균)를 계산합니다.
    """
    # 마침표(.)나 줄바꿈(\n) 등을 기준으로 문장 분리
    sentences = re.split(r'[.\n]+', text)
    # 공백 문자열 제거 및 양쪽 공백 제거
    lengths = [len(s.strip()) for s in sentences if len(s.strip()) > 0]
    
    if len(lengths) < 2:
        return 0.0  # 문장이 1개 이하거나 없으면 CV 계산 불가
    
    mean_len = statistics.mean(lengths)
    stdev_len = statistics.stdev(lengths)
    
    if mean_len == 0:
        return 0.0
        
    return round(stdev_len / mean_len, 4)


def get_hr_evaluation_si_prompt(jd_data, app_data):
    """인사담당자 평가 프롬프트 생성"""
    job_title = jd_data.get("모집직무", "해당 직무")
    job_responsibilities = jd_data.get("주요업무", "")
    core_values = jd_data.get("인재상", "")
    if not core_values:
         core_values = "책임감, 소통능력, 성실함"
    jd_hr_context = {
        "모집직무": job_title,
        "주요업무": job_responsibilities,
        "인재상": core_values
    }
    qna_list = app_data.get("qna", [])
    formatted_answers = ""
    for i, item in enumerate(qna_list, 1):
        question = item.get("question", "")
        answer = item.get("answer", "")
        formatted_answers += f"[문항 {i}] {question}\n[답변 {i}] {answer}\n\n"

    return f"""
    당신은 {job_title} 분야의 지원자를 채용하는 10년 차 인사(HR) 전문가입니다.
    현재 지원자의 [자기소개서 답변]과 회사의 [JD 정보]가 주어집니다.
    반드시 다음 단계들을 순서대로 수행하여 객관적인 평가 결과를 JSON 형태로 출력하세요.

    [지원자 자기소개서 내용]
    {formatted_answers}

    [입력 데이터 (HR 기준 JD 정보)]
    {json.dumps(jd_hr_context, ensure_ascii=False)}

    [수행 지침]
    1. [1단계: 평가 기준 설정 및 정형화] 자기소개서를 분석하여 각 평가 항목에 대한 기준 데이터를 JSON 형태로 추출하세요. 
       - "star_structure": 지원자의 경험과 이에 해당하는 S(Situation), T(Task), A(Action), R(Result) 요소를 명시하세요.
       - "job_insight": 직무 경험과 이에 대한 지원자의 인사이트를 명시하세요.
       - "core_value_fit": 각 인재상별로 가장 알맞은 자소서 내용(경험, 태도 등)을 매칭하세요. 지원서 기반의 구체적인 사실만 기입하세요.
    
    2. [2단계: 평가 산출] 1단계에서 만들어진 JSON 요약 데이터를 바탕으로, 다음 4개 항목에 대한 5점 만점 기준 점수와 구체적인 근거를 제시하세요.
       (1) "question_relevance": 질문의 의도에 맞는 답변을 썼으며 알고자 하는 역량을 잘 어필했는가?
       (2) "star_structure": 경험 설명 시 STAR 형태가 적절하게 반영되었는가?
       (3) "job_insight": 모집직무, 주요업무와 연관짓는 인사이트가 돋보이는가?
       (4) "core_value_fit": 지원서에 나타난 소프트스킬이 회사의 인재상과 잘 어울리는가?
       - **주의사항**: 자기소개서 특성상 '학위', '영어성적', '자격증' 관련 내용은 따로 기재하지 않는 경우가 많습니다. 따라서 자소서에 해당 내용이 언급되어 있지 않다고 해서 절대로 약점(weaknesses)으로 간주하거나 감점 요인으로 평가하지 마십시오. 단, 자소서에 해당 내용이 언급되어 있고 JD의 우대사항/자격요건과 일치한다면 이는 강점(strengths)으로 평가에 긍정적으로 반영하십시오.

    [반드시 지켜야 할 응답 형식 (JSON)]
    {{
        "extracted_evaluation_criteria": {{
            "star_structure": [
                {{
                    "경험명": "...",
                    "S": "상황",
                    "T": "과제/목표",
                    "A": "행동/조치",
                    "R": "결과/성과"
                }}
            ],
            "job_insight": [
                {{
                    "경험명": "...",
                    "경험_요약": "...",
                    "지원자_인사이트": "..."
                }}
            ],
            "core_value_fit": [
                {{
                    "해당_인재상": "...",
                    "자소서_매칭_내용": "..."
                }}
            ]
        }},
        "hr_evaluation_results": {{
            "question_relevance": {{
                "reasoning": {{
                    "strengths": ["강점1", ...],
                    "weaknesses": ["약점1", ...]
                }},
                "score": 0.0
            }},
            "star_structure": {{
                "reasoning": {{
                    "strengths": ["강점1", ...],
                    "weaknesses": ["약점1", ...]
                }},
                "score": 0.0
            }},
            "job_insight": {{
                "reasoning": {{
                    "strengths": ["강점1", ...],
                    "weaknesses": ["약점1", ...]
                }},
                "score": 0.0
            }},
            "core_value_fit": {{
                "reasoning": {{
                    "strengths": ["강점1", ...],
                    "weaknesses": ["약점1", ...]
                }},
                "score": 0.0
            }}
        }}
    }}
    """

def run_hr_evaluation_si(jd_data, app_data, api_key, return_prompt=False):
    """
    [인사담당자 관점 평가 에이전트]
    핵심 평가 로직
    """
    print(f"    - [통합 평가 모델 - HR] 인사/조직적합성 평가 진행 중...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"temperature": 0.0, "response_mime_type": "application/json"})

    prompt = get_hr_evaluation_si_prompt(jd_data, app_data)
    response = model.generate_content(prompt)
    text = response.text.strip()

    
    # JSON 파싱
    if "```" in text:
        text = re.sub(r'```(?:json)?', '', text).strip()
    
    try:
        # 텍스트 내의 실제 JSON 부분만 추출 시도 (가장 바깥쪽 { } 찾기)
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != 0:
            text = text[start:end]
        parsed_data = json.loads(text)
    except Exception as e:
        print(f"    [통합 평가 모델 - HR] 파싱 에러 발생: {e}")
        error_dict = {"score": 0.0, "reasoning": {"strengths": [], "weaknesses": ["에러 발생"]}}
        parsed_data = {
            "extracted_evaluation_criteria": {},
            "hr_evaluation_results": {
                "question_relevance": error_dict,
                "star_structure": error_dict,
                "job_insight": error_dict,
                "core_value_fit": error_dict
            }
        }
    
    # 3단계: 최종 평균 점수 산출
    eval_res = parsed_data.get("hr_evaluation_results", {})
    s1 = float(eval_res.get("question_relevance", {}).get("score", 0))
    s2 = float(eval_res.get("star_structure", {}).get("score", 0))
    s3 = float(eval_res.get("job_insight", {}).get("score", 0))
    s4 = float(eval_res.get("core_value_fit", {}).get("score", 0))
    final_score = round((s1 + s2 + s3 + s4) / 4, 2)
    
    result = {
        "extracted_evaluation_criteria": parsed_data.get("extracted_evaluation_criteria", {}),
        "hr_evaluation_results": parsed_data.get("hr_evaluation_results", {}),
        "summary": {"hr_final_score": final_score}
    }
    if return_prompt:
        result["prompt"] = prompt
    return result



def get_ai_detection_si_prompt(app_data, sentence_length_cv):
    """AI 탐지 프롬프트 생성"""
    qna_list = app_data.get("qna", [])
    answers_only_list = [item.get("answer", "").strip() for item in qna_list]
    answers_only_text = "\n".join(answers_only_list)
    
    return f"""
    당신은 채용 과정에서 지원서의 AI(LLM) 생성 여부를 감별하는 10년 차 패턴 분석 전문가입니다.
    현재 지원자의 [자기소개서 순수 답변 내용]과 계산된 [문장 길이 CV 요동성 지표]가 주어집니다.
    반드시 다음 세 가지 기준을 종합적으로 분석하여 이 자기소개서가 AI에 의해 작성되었을 확률과 그 근거를 JSON 형태로 출력하세요.

    [지원자 자기소개서 내용]
    {answers_only_text}

    [사전 계산 데이터]
    - 문장 길이 변동계수(CV, Coefficient of Variation): {sentence_length_cv}
      (참고: 통상적으로 LLM이 기계적으로 쓴 글은 길이가 균일하여 CV가 0.2 부근 혹은 그 이하로 나옵니다. 전달된 CV 수치가 0.2 이하라면 '매우 강한 LLM 생성 위험 신호'로 간주하세요.)

    [분석 및 평가 기준]
    1. 어휘적 일관성 (lexical_consistency): '혁신적인', '궁극적으로', '경험을 바탕으로', '시너지를 발휘하여' 등 LLM이 선호하는 특유의 추상적/보편적인 어휘가 비정상적으로 자주 등장하는지 분석하세요.
    2. 구조적 정형성 (structural_uniformity): 서론-본론-결론의 대칭성이 지나치게 작위적이지 않은지, 그리고 앞서 제공된 [문장 길이 CV] 수치가 LLM 특유의 기계적 균일성(0.2 이하)을 보이는지 종합하여 분석하세요.
    3. 경험의 구체성 (experience_specificity): 환각(Hallucination)이나 과일반화를 방지하기 위한 지표입니다. 개인적인 고뇌, 구체적인 수치, 프로젝트나 조직의 고유명사 등이 결여되고 거시적인 성과 위주로만 포장되어 있는지 평가하세요.

    [반드시 지켜야 할 응답 형식 (JSON)]
    {{
        "ai_generation_probability": 0,  // 0에서 100 사이의 정수 (예: 85)
        "lexical_consistency_reasoning": {{
            "strengths": ["강점1", ...], // 인간다움이 느껴지는 패턴
            "weaknesses": ["약점1", ...] // AI 특유의 기계적 패턴
        }},
        "structural_uniformity_reasoning": {{
            "strengths": ["강점1", ...],
            "weaknesses": ["약점1", ...]
        }},
        "experience_specificity_reasoning": {{
            "strengths": ["강점1", ...],
            "weaknesses": ["약점1", ...]
        }},
        "final_judgment": "최종적으로 해당 자소서가 AI로 작성되었다고 판단하는 종합 의견..."
    }}
    """

def run_ai_detection_si(app_data, api_key, return_prompt=False):
    """
    [AI 생성 여부 탐지 에이전트]
    핵심 평가 로직
    """
    print(f"    - [통합 평가 모델 - AI 탐지] AI 작성 여부 분석 진행 중...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"temperature": 0.0, "response_mime_type": "application/json"})

    # 사전문항 제거 및 순수 답변만 추출 병합
    qna_list = app_data.get("qna", [])
    answers_only_list = [item.get("answer", "").strip() for item in qna_list]
    answers_only_text = "\n".join(answers_only_list)
    
    # 문장 길이 변동계수(CV) 산출
    sentence_length_cv = calculate_sentence_length_cv(answers_only_text)

    prompt = get_ai_detection_si_prompt(app_data, sentence_length_cv)
    response = model.generate_content(prompt)
    text = response.text.strip()

    
    # JSON 파싱
    if "```" in text:
        text = re.sub(r'```(?:json)?', '', text).strip()
    
    try:
        # 텍스트 내의 실제 JSON 부분만 추출 시도 (가장 바깥쪽 { } 찾기)
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != 0:
            text = text[start:end]
        parsed_data = json.loads(text)
    except Exception as e:
        print(f"    [통합 평가 모델 - AI 탐지] 파싱 에러 발생: {e}")
        parsed_data = {
            "ai_generation_probability": 0,
            "error": "결과 파싱 중 에러가 발생했습니다."
        }
    
    # 메타데이터로 CV 수치 자체도 리턴 객체에 포함 (리포트 가독성)
    parsed_data["calculated_metrics"] = {
        "sentence_length_cv": sentence_length_cv
    }
    if return_prompt:
        parsed_data["prompt"] = prompt
    return parsed_data


def main():
    # 경로 설정
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(script_dir, "자기소개서_평가_입력데이터")
    output_dir = os.path.join(script_dir, "자기소개서_평가_출력데이터")

    # === 데이터 경로 설정 ===
    # 예시 파일명에 맞춰 설정 (실제 파일명 확인 필요)
    jd_path = os.path.join(input_dir, "LG_CNS_JD.json")
    app_path = os.path.join(input_dir, "LG CNS AI.json")
    
    # 데이터 로드
    if not os.path.exists(jd_path) or not os.path.exists(app_path):
        print(f"입력 데이터를 찾을 수 없습니다.\n- JD: {jd_path}\n- 자소서: {app_path}")
        return

    jd_data = load_json(jd_path)
    app_data = load_json(app_path)
    
    # API 키 (환경 변수 또는 직접 입력)
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        api_key = input("Gemini API Key를 입력하세요: ")
    if not api_key: return

    # 직무 제목 추출 (리포트용)
    job_title = jd_data.get("모집직무", "해당 직무")
    company_name = app_data.get("company", "해당 기업")
    print(f"\n[평가 시작] 기업: {company_name}, 직무: {job_title}")

    # --- 시간 측정 시작 ---
    start_time = time.time() if MEASURE_TIME else None
    
    manager_report = run_manager_evaluation_si(jd_data, app_data, api_key)
    hr_report = run_hr_evaluation_si(jd_data, app_data, api_key)
    ai_detection_report = run_ai_detection_si(app_data, api_key)
    
    # --- 시간 측정 종료 ---
    execution_time = round(time.time() - start_time, 2) if MEASURE_TIME else None
    
    # 결과 통합 및 저장
    final_report = {
        "candidate_info": {
            "company": company_name,
            "job": job_title
        },
        "manager_evaluation": manager_report,
        "hr_evaluation": hr_report,
        "ai_detection": ai_detection_report
    }
    
    # 시간 측정 시 결과에 포함
    if MEASURE_TIME:
        final_report["metadata"] = {
            "execution_time_seconds": execution_time
        }

    output_path = os.path.join(output_dir, f"{company_name}_si_eval.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_report, f, ensure_ascii=False, indent=4)
    
    print(f"\n[완료] 평가 결과가 저장되었습니다: {output_path}")

if __name__ == "__main__":
    main()


