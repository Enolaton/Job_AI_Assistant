import sys
import json
import os
import google.generativeai as genai
from typing import Dict, List

def evaluate_interview(payload: Dict):
    api_key = payload.get('api_key')
    jd_data = payload.get('jd_data', {})
    intro_data = payload.get('intro_data', {})
    qna = payload.get('qna', [])
    
    if not api_key:
        return {"error": "API Key is missing"}

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        'gemini-2.0-flash',
        generation_config={"response_mime_type": "application/json"}
    )

    transcript_text = ""
    for item in qna:
        transcript_text += f"Q: {item['question']}\nA: {item['answer']}\n\n"

    prompt = f"""
    당신은 숙련된 채용 팀장(Hiring Manager)입니다. 사용자의 모의 면접 답변 스크립트를 분석하여 
    제공된 [공고], [자기소개서] 데이터와 비교한 정밀 평가 리포트를 작성하세요.

    [분석 기준 데이터]
    - 공고(JD): {json.dumps(jd_data, ensure_ascii=False)}
    - 자기소개서 및 평가: {json.dumps(intro_data, ensure_ascii=False)}

    [면접 답변 스크립트]
    {transcript_text}

    [평가 지침]
    1. **데이터 일관성 (Consistency)**: 면접 답변이 본인이 작성한 자소서나 공고의 요구사항과 충돌하는 지점이 있는지 확인하세요.
    2. **직무 전문성 (Expertise)**: 기술적인 질문에 대해 구체적인 사례와 수치를 들어 답변했는지 분석하세요.
    3. **논리 및 구조 (Logic)**: STARI 구조로 답변이 구성되었는지 평가하세요.
    4. **전략 제안 (Strategy)**: 실질적인 액션 아이템을 제시하세요.

    [출력 형식]
    반드시 아래 JSON 스키마를 따르세요:
    {{
      "score": number,
      "strengths": string[],
      "weaknesses": string[],
      "consistency_check": string,
      "feedback": string
    }}
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # JSON 정제 (불필요한 제어 문자 및 이스케이프 오류 방지)
        def clean_json_string(s):
            # 마크다운 코드 블록 제거
            s = re.sub(r'```(?:json)?\n?', '', s)
            s = re.sub(r'\n?```$', '', s)
            # 유효하지 않은 백슬래시 이스케이프 처리 (JSON 표준 위반 방지)
            # 특히 \^, \!, \@ 등 LLM이 가끔 실수로 넣는 백슬래시 보호
            return s.strip()

        import re
        cleaned_text = clean_json_string(text)
        return json.loads(cleaned_text)
    except Exception as e:
        return {"error": f"LLM Error: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)
        
    try:
        input_data = json.loads(sys.argv[1])
        result = evaluate_interview(input_data)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
