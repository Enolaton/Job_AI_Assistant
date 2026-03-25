import sys
import json
import os
import google.generativeai as genai
from typing import Dict, List

def generate_questions(payload: Dict):
    api_key = payload.get('api_key')
    jd_data = payload.get('jd_data', {})
    intro_data = payload.get('intro_data', {})
    resume_data = payload.get('resume_data', {})
    experiences = payload.get('experiences', [])
    
    if not api_key:
        return {"error": "API Key is missing"}

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        'gemini-2.0-flash',
        generation_config={"response_mime_type": "application/json"}
    )

    prompt = f"""
    당신은 전문 채용 면접관입니다. 아래 제공된 [공고], [자기소개서], [이력서/경험] 데이터를 분석하여 
    사용자의 역량을 정밀하게 검증하고 데이터 간의 일관성을 체크할 수 있는 면접 질문 6개를 생성하세요.

    [대상 기업 및 공고 정보]
    - 기업명: {jd_data.get('companyName', '정보 없음')}
    - 모집직무: {jd_data.get('roleTitle', '정보 없음')}
    - 주요업무/자격요건: {jd_data.get('requirements', '')} {jd_data.get('tasks', '')}

    [사용자 자기소개서 내용]
    {json.dumps(intro_data.get('qna', []), ensure_ascii=False, indent=2)}
    - 자소서 평가 요약: {intro_data.get('evaluation', '없음')}

    [사용자 이력서 및 경험 뱅크]
    - 이력서 요약: {json.dumps(resume_data, ensure_ascii=False)}
    - 경험 뱅크 내용: {json.dumps(experiences, ensure_ascii=False, indent=2)}

    [출력 형식]
    반드시 아래 JSON 스키마를 따르는 배열 형태로 출력하세요:
    [
      {{
        "id": number,
        "type": "consistency" | "tech" | "personality" | "behavioral",
        "question": string,
        "intent": string,
        "expected_keywords": string[],
        "mock_answer": string
      }}
    ]
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # JSON 정제
        def clean_json_string(s):
            import re
            s = re.sub(r'```(?:json)?\n?', '', s)
            s = re.sub(r'\n?```$', '', s)
            return s.strip()

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
        result = generate_questions(input_data)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
