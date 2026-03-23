# -*- coding: utf-8 -*-
"""
AI Self-Introduction Evaluator for Job_AI_Assistant
Based on SI_evaluation.py logic.
Evaluates through 3 personas: Technical Manager, HR Specialist, and AI Pattern Analyst.
"""

import json
import sys
import os
import io
import google.generativeai as genai
import re
import statistics

# Force UTF-8 encoding for standard output (Windows compatibility)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
elif hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def get_model(api_key: str):
    """Initialize Gemini 2.5 Flash model"""
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        'gemini-2.0-flash', # Use stable version
        generation_config={"temperature": 0.0, "response_mime_type": "application/json"}
    )

def calculate_sentence_length_cv(text):
    """Calculate CV (Coefficient of Variation) for sentence length"""
    sentences = re.split(r'[.\n]+', text)
    lengths = [len(s.strip()) for s in sentences if len(s.strip()) > 0]
    if len(lengths) < 2: return 0.0
    mean_len = statistics.mean(lengths)
    stdev_len = statistics.stdev(lengths)
    return round(stdev_len / mean_len, 4) if mean_len > 0 else 0.0

def get_manager_evaluation_si_prompt(job_data, question, answer):
    job_title = job_data.get("모집직무", "해당 직무")
    jd_for_hardskills = {
        "주요업무": job_data.get("주요업무", ""),
        "자격요건": job_data.get("자격요건", ""),
        "우대사항": job_data.get("우대사항", ""),
        "상세내용": job_data.get("상세내용", "")
    }
    jd_for_projects = {
        "주요업무": job_data.get("주요업무", ""),
        "상세내용": job_data.get("상세내용", "")
    }
    formatted_answers = f"[문항] {question}\n[답변] {answer}\n\n"

    return f"""
    당신은 {job_title} 분야의 10년 차 채용 전문가이자 팩트 추출 전문가입니다.
    현재 지원자의 [자기소개서 답변]과 회사의 [JD 정보]가 주어집니다.
    반드시 다음 '두 가지 단계(Step)'를 순서대로 수행하여 객관적인 결과를 하나의 통합된 JSON 형태로 출력하세요. 모든 출력은 한국어로 작성하세요.

    [지원자 자기소개서 내용]
    {formatted_answers}

    [입력 데이터 (JD 정보)]
    - JD 하드스킬 필터링: {json.dumps(jd_for_hardskills, ensure_ascii=False)}
    - JD 프로젝트 필터링: {json.dumps(jd_for_projects, ensure_ascii=False)}

    [수행 지침]
    1. 첫 번째로, [지원자 자기소개서 내용]만을 읽고 명시된 '하드 스킬'과 '수행한 프로젝트' 정보를 추출하여 "extracted_facts" 스키마에 정리하세요. (단, 없는 내용은 지어내지 마세요.)
       - **주의사항**: 단순한 포부, 관심분야는 배제하고 실체가 입증된 하드스킬만 추출하세요.
    2. 두 번째로, 추출한 스킬 및 프로젝트 정보와 제공된 [입력 데이터 (JD 정보)]를 대조하여 5점 만점으로 "evaluation_results" 스키마에 점수와 근거를 기입하세요.
       - 기술적 추론(Technical Inference): 모델이나 고급 라이브러리 사용 경험이 명시되었다면, 그에 수반되는 필수 적인 역량은 논리적으로 추론하여 약점(weaknesses)으로 삼지 마세요.
       - 필수 스나 학위 등에 대한 정보가 비어있어도 자소서 특성이므로 약점으로 간주하지 마십시오. 있으면 강점입니다.

    [반드시 지켜야 할 응답 형식 (JSON)]
    {{
        "extracted_facts": {{
            "hard_skills": ["스킬1", "스킬2"],
            "projects": [
                {{
                    "프로젝트명": "...",
                    "직무 연관성": "...",
                    "활용 스킬": ["스킬A"]
                }}
            ]
        }},
        "evaluation_results": {{
            "hard_skill_evaluation": {{
                "base_jd_requirements": "참조한 JD 내용 요약",
                "reasoning": {{"strengths": ["강점1"], "weaknesses": ["약점1"]}},
                "score": 0.0
            }},
            "project_evaluation": {{
                "base_jd_responsibilities": "참조한 JD 내용 요약",
                "reasoning": {{"strengths": ["강점1"], "weaknesses": ["약점1"]}},
                "score": 0.0
            }}
        }}
    }}
    """

def get_hr_evaluation_si_prompt(job_data, question, answer):
    job_title = job_data.get("모집직무", "해당 직무")
    job_responsibilities = job_data.get("주요업무", "")
    core_values = job_data.get("인재상", "책임감, 소통능력, 성실함")
    jd_hr_context = {
        "모집직무": job_title,
        "주요업무": job_responsibilities,
        "인재상": core_values
    }
    formatted_answers = f"[문항] {question}\n[답변] {answer}\n\n"

    return f"""
    당신은 {job_title} 분야의 지원자를 채용하는 10년 차 인사(HR) 전문가입니다.
    현재 지원자의 [자기소개서 답변]과 회사의 [JD 정보]가 주어집니다.
    반드시 다음 단계들을 순서대로 수행하여 객관적인 평가 결과를 JSON 형태로 출력하세요. 모든 출력은 절대로 영어가 아닌 한국어로만 작성하세요.

    [지원자 자기소개서 내용]
    {formatted_answers}

    [입력 데이터 (HR 기준 JD 정보)]
    {json.dumps(jd_hr_context, ensure_ascii=False)}

    [수행 지침]
    1. [1단계: 평가 기준 설정 및 정형화] 자기소개서를 분석하여 각 평가 항목에 대한 기준 데이터를 JSON 형태로 추출하세요. 
       - "star_structure": 지원자의 경험과 이에 해당하는 S(Situation), T(Task), A(Action), R(Result) 요소를 명시하세요.
       - "job_insight": 직무 경험과 이에 대한 지원자의 인사이트를 명시.
       - "core_value_fit": 각 인재상별로 알맞은 자소서 내용을 매칭하세요.
    2. [2단계: 평가 산출] 1단계에서 만들어진 JSON 요약 데이터를 바탕으로, 다음 4개 항목에 대한 5점 만점 기준 점수와 구체적인 근거를 제시하세요.
       (1) question_relevance
       (2) star_structure
       (3) job_insight
       (4) core_value_fit

    [반드시 지켜야 할 응답 형식 (JSON)]
    {{
        "extracted_evaluation_criteria": {{"star_structure": [], "job_insight": [], "core_value_fit": []}},
        "hr_evaluation_results": {{
            "question_relevance": {{"reasoning": {{"strengths": [], "weaknesses": []}}, "score": 0.0}},
            "star_structure": {{"reasoning": {{"strengths": [], "weaknesses": []}}, "score": 0.0}},
            "job_insight": {{"reasoning": {{"strengths": [], "weaknesses": []}}, "score": 0.0}},
            "core_value_fit": {{"reasoning": {{"strengths": [], "weaknesses": []}}, "score": 0.0}}
        }}
    }}
    """

def get_ai_detection_si_prompt(answer, cv_val):
    return f"""
    당신은 채용 과정에서 지원서의 AI(LLM) 생성 여부를 감별하는 10년 차 패턴 분석 전문가입니다.
    현재 지원자의 [자기소개서 순수 답변 내용]과 계산된 [문장 길이 CV 요동성 지표]가 주어집니다.
    반드시 세 가지 기준을 종합적으로 분석하여 이 자기소개서가 AI에 의해 작성되었을 확률과 그 근거를 JSON 형태로 츨력하세요. 모든 출력은 한국어로 작성하세요.

    [지원자 자기소개서 내용]
    {answer}

    [사전 계산 데이터]
    - 문장 길이 변동계수(CV): {cv_val}
      (참고: 통상적으로 LLM이 기계적으로 쓴 글은 길이가 균일하여 CV가 0.2 이하라 나옵니다.)

    [분석 및 평가 기준]
    1. 어휘적 일관성 (lexical_consistency): '혁신적인', '궁극적으로' 등의 상투적 어휘 체크.
    2. 구조적 정형성 (structural_uniformity): 변동계수 및 대칭성 평가.
    3. 경험의 구체성 (experience_specificity): 환각이나 과일반화 없이 구체적인 수치나 고유명사가 있는지 확인.

    [반드시 지켜야 할 응답 형식 (JSON)]
    {{
        "ai_generation_probability": 0,
        "lexical_consistency_reasoning": {{"strengths": [], "weaknesses": []}},
        "structural_uniformity_reasoning": {{"strengths": [], "weaknesses": []}},
        "experience_specificity_reasoning": {{"strengths": [], "weaknesses": []}},
        "final_judgment": "최종 의견..."
    }}
    """

def run_evaluation(api_key, question, answer, job_data):
    """
    Run the 3-persona evaluation suite bridging original comprehensive logic to frontend format.
    """
    model = get_model(api_key)
    
    cv_val = calculate_sentence_length_cv(answer)
    
    manager_prompt = get_manager_evaluation_si_prompt(job_data, question, answer)
    hr_prompt = get_hr_evaluation_si_prompt(job_data, question, answer)
    ai_prompt = get_ai_detection_si_prompt(answer, cv_val)

    def parse_gemini(text):
        if "```" in text:
            text = re.sub(r'```(?:json)?', '', text).strip()
        start = text.find('{{')
        end = text.rfind('}}') + 1
        if start != -1 and end != 0:
            text = text[start:end]
        return json.loads(text) if text else {}

    try:
        res1 = model.generate_content(manager_prompt).text
        res2 = model.generate_content(hr_prompt).text
        res3 = model.generate_content(ai_prompt).text
        
        m_data = parse_gemini(res1)
        h_data = parse_gemini(res2)
        a_data = parse_gemini(res3)
        
        # --- Manager Mapping ---
        m_eval = m_data.get("evaluation_results", {})
        h_skill = m_eval.get("hard_skill_evaluation", {})
        p_skill = m_eval.get("project_evaluation", {})
        
        m_score = round((float(h_skill.get("score", 0)) + float(p_skill.get("score", 0))) / 2, 2)
        m_strengths = h_skill.get("reasoning", {}).get("strengths", []) + p_skill.get("reasoning", {}).get("strengths", [])
        m_weaknesses = h_skill.get("reasoning", {}).get("weaknesses", []) + p_skill.get("reasoning", {}).get("weaknesses", [])
        
        manager_mapped = {
            "score": m_score,
            "reasoning": {"strengths": m_strengths[:3], "weaknesses": m_weaknesses[:3]}
        }
        
        # --- HR Mapping ---
        hr_eval = h_data.get("hr_evaluation_results", {})
        s1 = float(hr_eval.get("question_relevance", {}).get("score", 0))
        s2 = float(hr_eval.get("star_structure", {}).get("score", 0))
        s3 = float(hr_eval.get("job_insight", {}).get("score", 0))
        s4 = float(hr_eval.get("core_value_fit", {}).get("score", 0))
        h_score = round((s1 + s2 + s3 + s4) / 4, 2)
        
        h_strengths = []
        h_weaknesses = []
        for key in ["question_relevance", "star_structure", "job_insight", "core_value_fit"]:
            h_strengths.extend(hr_eval.get(key, {}).get("reasoning", {}).get("strengths", []))
            h_weaknesses.extend(hr_eval.get(key, {}).get("reasoning", {}).get("weaknesses", []))
            
        hr_mapped = {
            "score": h_score,
            "reasoning": {"strengths": h_strengths[:3], "weaknesses": h_weaknesses[:3]}
        }
        
        # --- AI Mapping ---
        prob = a_data.get("ai_generation_probability", 0)
        ai_mapped = {
            "probability": prob,
            "reasoning": a_data.get("final_judgment", "통합 분석 결과 특이사항 없음.")
        }
        
        # --- Summary Mapping ---
        final_score = round((m_score + h_score) / 2, 2)
        
        # Create core reasoning blending JD reqs and strengths
        core_reasoning = ""
        if (len(m_strengths) > 0 and len(h_strengths) > 0):
            core_reasoning = f"[직무역량] {m_strengths[0]} \n[조직적합도] {h_strengths[0]}"
        else:
            core_reasoning = a_data.get("final_judgment", "주요 역량이 확인됩니다.")
            
        return {
            "success": True,
            "manager": manager_mapped,
            "hr": hr_mapped,
            "ai_detect": ai_mapped,
            "summary": {
                "score": final_score,
                "reasoning": core_reasoning
            }
        }
    except Exception as e:
        return {"success": False, "error": f"LLM Error: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No input provided"}))
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
        api_key = input_data.get("api_key")
        question = input_data.get("question")
        answer = input_data.get("answer")
        job_data = input_data.get("job_data", {})

        if not api_key or not question or not answer:
            raise ValueError("Required fields missing (API Key, Question, or Answer)")

        result = run_evaluation(api_key, question, answer, job_data)
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)
