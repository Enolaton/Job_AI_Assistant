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
    # Job analysis data formatting
    jd_summary = json.dumps(job_data, ensure_ascii=False, indent=2)
    
    # Experience (Resume) data formatting
    # experiences should be a list of Project/Experience objects
    exp_summary = json.dumps(experiences, ensure_ascii=False, indent=2)
    m_limit = int(max_chars)
    
    # Pre-process Data for Prompts
    jd_str = json.dumps(job_data, ensure_ascii=False, indent=2)
    exp_str = json.dumps(experiences, ensure_ascii=False, indent=2)
    dart_str = ""
    if dart_data:
        dart_str = json.dumps(dart_data, ensure_ascii=False, indent=2)

    # Step 1: Strategy Formulation
    strategy_prompt = f"""
    당신은 신입/경력 채용 전문 자소서 컨설턴트입니다.
    질문: {question}
    최종 목표 분량: 공백 포함 {m_limit}자 이내.

    아래 데이터를 분석하여 '{m_limit}'자 분량에 맞춘 최적의 전략을 짜세요.
    JD: {jd_str}
    경험: {exp_str}
    기업분석: {dart_str}
    """
    
    strategy_res = model.generate_content(strategy_prompt)
    strategy = strategy_res.text.strip()

    # Step 2: Final Draft Generation (with strict limit)
    # Give AI a slightly smaller targets (e.g. 90% of limit) to avoid spill-over
    safe_target = int(m_limit * 0.95)

    draft_prompt = f"""
    당신은 자소서 작성 전문가입니다.
    아래 전략을 바탕으로 **공백 포함 반드시 {m_limit}자 이내 (권장 {safe_target}자)**로 작성하세요.

    전략: {strategy}

    [입력 데이터 요약]
    - 질문: {question}
    - {m_limit}자를 넘으면 절대 안 됩니다.
    - 데이터: {jd_str[:500]} / {exp_str[:800]}

    [작성 수칙 - 필수]
    1. **마크다운 서식 금지**: `**`, `*`, `__`, `#` 등의 기호를 절대 사용하지 마세요. 강조하고 싶다면 문맥이나 단어 선택으로 하세요.
    2. **글자 수 절대 준수**: 공백 포함 {m_limit}자를 절대 넘지 마세요.
    3. **소제목**: [ ] 형태의 소제목 하나만 사용하세요. (예: [데이터로 성과를 증명하다])
    4. **순수 본문**: 마크다운 없이 줄바꿈과 텍스트만 출력하세요.
    """
    
    draft_res = model.generate_content(draft_prompt)
    draft = draft_res.text.strip()

    # --- Post-Processing: Scrub Markdown & Strict Guard ---
    # Remove common markdown artifacts if AI ignored the prompt
    for markdown_symbol in ["**", "__", "*", "_"]:
        draft = draft.replace(markdown_symbol, "")

    if len(draft) > m_limit:
        # If way over, cut and try to end at the last full sentence
        truncated = draft[:m_limit]
        last_period = truncated.rfind('.')
        if last_period != -1 and last_period > (m_limit * 0.7):
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
