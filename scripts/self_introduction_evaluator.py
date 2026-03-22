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

def run_evaluation(api_key, question, answer, job_data):
    """
    Run the 3-persona evaluation suite
    """
    model = get_model(api_key)
    job_title = job_data.get("모집직무", "해당 직무")
    
    # --- Persona 1: Technical Manager (Hard skills & Project fit) ---
    manager_prompt = f"""
    당신은 {job_title} 분야의 10년 차 채용 전문가이자 실무 팀장입니다.
    지원자의 자기소개서 내용과 채용 공고(JD)를 대조하여 **실무 역량**을 평가하세요.

    [자소서 정보]
    문항: {question}
    답변: {answer}

    [공고 정보 (JD)]
    {json.dumps(job_data, ensure_ascii=False)}

    [평가 지침]
    1. 자소서에서 실제로 보유한 '하드 스킬'과 '프로젝트 경험'만 엄결하게 추출하세요. (의지/포부 제외)
    2. 추출된 실무 역량이 JD의 자격요건/우대사항과 얼마나 일치하는지 5점 만점으로 채점하세요.
    3. 강점(strengths)과 약점(weaknesses)을 구체적인 기술적 관점에서 도출하세요.

    [출력 포맷: JSON]
    {{
        "score": 0.0,
        "reasoning": {{"strengths": [], "weaknesses": []}},
        "extracted_facts": {{"hard_skills": [], "projects": []}}
    }}
    """
    
    # --- Persona 2: HR Specialist (Structure & Attitude) ---
    hr_prompt = f"""
    당신은 {job_title} 분야의 10년 차 인사(HR) 담당자입니다.
    지원자의 **논리 구조(STAR 기법)**와 **인재상 적합성**을 평가하세요.

    [자소서 답변]
    {answer}

    [인재상/가치]
    {job_data.get("인재상", "책임감, 소통, 전문성")}

    [평가 지침]
    1. 답변이 질문의 의도에 부합하는지 평가하세요. (question_relevance)
    2. 경험 서술 시 상황(S)-과제(T)-행동(A)-결과(R) 구조가 탄탄한지 확인하세요.
    3. 지원자의 태도와 가치관이 회사의 인재상과 어울리는지 5점 만점으로 채점하세요.

    [출력 포맷: JSON]
    {{
        "score": 0.0,
        "reasoning": {{"strengths": [], "weaknesses": []}}
    }}
    """

    # --- Persona 3: AI Detection (Pattern Analysis) ---
    cv_val = calculate_sentence_length_cv(answer)
    ai_prompt = f"""
    당신은 자소서의 AI(LLM) 생성 여부를 판별하는 패턴 분석 전문가입니다.
    문장 길이의 균일성과 어휘 패턴을 분석하여 AI 작성 확률을 계산하세요.

    [자소서 내용]
    {answer}

    [통계 지표]
    문장 길이 변동계수(CV): {cv_val} (0.2 이하는 기계적 균일성이 매우 높음)

    [평가 지침]
    1. '궁극적으로', '시너지를 발휘하여' 등 AI가 선호하는 상투적 표현 빈도를 체크하세요.
    2. 문장 구조가 지나치게 정형화되어 있는지 판단하세요.

    [출력 포맷: JSON]
    {{
        "probability": 0, // 0-100%
        "reasoning": "종합 판정 의견"
    }}
    """

    # Parallel generation would be better but for sequential call:
    try:
        res1 = model.generate_content(manager_prompt).text
        res2 = model.generate_content(hr_prompt).text
        res3 = model.generate_content(ai_prompt).text
        
        manager_eval = json.loads(res1 if "{" in res1 else "{}")
        hr_eval = json.loads(res2 if "{" in res2 else "{}")
        ai_eval = json.loads(res3 if "{" in res3 else "{}")
        
        final_score = round((manager_eval.get("score", 0) + hr_eval.get("score", 0)) / 2, 2)
        
        return {
            "success": True,
            "manager": manager_eval,
            "hr": hr_eval,
            "ai_detect": ai_eval,
            "metrics": {"cv": cv_val},
            "summary": {"score": final_score}
        }
    except Exception as e:
        return {"success": False, "error": f"LLM Output Parsing Error: {str(e)}"}

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
