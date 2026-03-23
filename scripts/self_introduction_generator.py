# -*- coding: utf-8 -*-
"""
AI Self-Introduction Generator for Job_AI_Assistant
Based on SI_generation.py logic.
Takes JSON input from CLI and returns a generated draft with strategic reasoning.
"""

import json
import sys
import os
import io
import google.generativeai as genai

# Force UTF-8 encoding for standard output (Windows compatibility)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
elif hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def get_model(api_key: str):
    """Initialize Gemini 2.5 Flash model"""
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        'gemini-2.0-flash', 
        generation_config={"temperature": 0.2} 
    )

def generate_si_draft(api_key, question, max_chars, job_data, experiences, dart_data=None):
    """
    1. Strategy Planning 
    2. Draft Generation
    3. Return combined result
    """
    model = get_model(api_key)
    
    # --- 1. Data Processing ---
    jd_summary = json.dumps(job_data, ensure_ascii=False, indent=2)
    
    # 이력서 데이터 (Experiences)
    resume_summary = json.dumps(experiences, ensure_ascii=False, indent=2)
    
    # DART 데이터
    dart_section = ""
    if dart_data:
        selected_dart = {
            "business_overview": dart_data.get("business_overview", ""),
            "products_services": dart_data.get("products_services", "")
        }
        dart_summary = json.dumps(selected_dart, ensure_ascii=False, indent=2)
        dart_section = f"\n    [기업 분석 데이터 (DART)]\n    {dart_summary}\n    "

    # Step 1: Strategy Formulation
    strategy_prompt = f"""
    당신은 한국 대기업 채용 자기소개서 작성을 전문으로 하는 10년 차 취업 컨설턴트입니다.
    아래 제공되는 데이터를 종합적으로 분석하여, 주어진 자기소개서 문항에 대한 **구체적인 작성 전략**을 수립해 주세요.

    [자기소개서 문항]
    질문: {question}
    글자 수 제한: {max_chars}자

    [채용 공고 (JD)]
    {jd_summary}
    {dart_section}
    [지원자 이력서 데이터]
    {resume_summary}

    [작성 전략 수립 지침]
    1. 문항의 의도를 정확히 파악하고, 해당 문항이 요구하는 핵심 역량/가치를 명시하세요.
    2. 지원자의 이력서 데이터에서 이 문항에 가장 적합한 경험/스킬/프로젝트를 선별하세요.
    3. DART 데이터가 있다면 기업의 사업 방향과 연결 짓는 방법을 제시하세요.
    4. 글의 구조(도입-본론-마무리)를 제안하고, 각 파트에서 다룰 핵심 내용을 명시하세요.
    5. 글자 수 제한({max_chars}자)을 고려한 분량 배분을 제안하세요.
    6. JD의 직무 요구사항과 지원자 경험을 어떻게 연결할지 구체적으로 서술하세요.

    [출력 형식]
    한국어로 작성하되, 마크다운 형식 없이 읽기 쉬운 플레인 텍스트로 작성하세요.
    """
    
    strategy_res = model.generate_content(strategy_prompt)
    strategy = strategy_res.text.strip()

    # Step 2: Final Draft Generation
    draft_prompt = f"""
    당신은 한국 대기업 채용 자기소개서 작성을 전문으로 하는 10년 차 취업 컨설턴트입니다.
    아래 수립된 작성 전략과 데이터를 바탕으로 자기소개서 초안을 작성해 주세요.

    [자기소개서 문항]
    질문: {question}
    글자 수 제한: {max_chars}자

    [작성 전략]
    {strategy}

    [채용 공고 (JD)]
    {jd_summary}
    {dart_section}
    [지원자 이력서 데이터]
    {resume_summary}

    [작성 지침]
    1. 반드시 위 작성 전략의 구조와 내용을 충실히 따르세요.
    2. 글자 수 제한({max_chars}자)을 엄격히 지켜 주세요. 공백 포함 {max_chars}자를 초과하면 안 됩니다.
    3. 지원자의 실제 경험과 데이터에 기반하여 작성하세요. 없는 사실을 지어내지 마세요.
    4. 자연스러운 한국어로 작성하되, 지나치게 문어체이거나 AI 생성 느낌이 나지 않도록 주의하세요.
    5. 구체적인 수치, 프로젝트명, 성과 등을 포함하여 진정성 있게 작성하세요.
    6. 마크다운 기호(`**`, `*`, `__` 등)나 제목 태그 없이 순수한 자기소개서 본문 텍스트만 출력하세요.
    """
    
    draft_res = model.generate_content(draft_prompt)
    draft = draft_res.text.strip()

    # --- Post-Processing: Scrub Markdown & Strict Guard ---
    # Remove common markdown artifacts if AI ignored the prompt
    for markdown_symbol in ["**", "__", "*", "_"]:
        draft = draft.replace(markdown_symbol, "")

    if len(draft) > int(max_chars):
        truncated = draft[:int(max_chars)]
        last_period = truncated.rfind('.')
        if last_period != -1 and last_period > (int(max_chars) * 0.7):
            draft = truncated[:last_period + 1]
        else:
            draft = truncated

    return {
        "success": True,
        "strategy": strategy,
        "draft": draft,
        "char_count": len(draft)
    }

if __name__ == "__main__":
    # Expecting JSON string as a single argument
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No input provided"}))
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
        
        api_key = input_data.get("api_key")
        question = input_data.get("question")
        max_chars = input_data.get("max_chars", 500)
        job_data = input_data.get("job_data", {})
        experiences = input_data.get("experiences", [])
        dart_data = input_data.get("dart_data")

        if not api_key or not question:
            raise ValueError("API Key or Question is missing")

        result = generate_si_draft(api_key, question, max_chars, job_data, experiences, dart_data)
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
