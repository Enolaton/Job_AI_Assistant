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
    model = genai.GenerativeModel('gemini-2.0-flash')

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

    [질문 생성 가이드라인]
    1. **일관성 검증 (Consistency)**: 자소서와 이력서/경험 뱅크 데이터 사이에 모순이 있거나 설명이 부족한 부분을 찾아 날카로운 확인 질문을 1~2개 포함하세요.
    2. **직무 적합성 (Job Fit)**: 공고의 핵심 역량과 사용자의 기술적 배경이 얼마나 일치하는지 묻는 질문을 2개 포함하세요.
    3. **인성 및 가치관 (Values)**: 자소서 에피소드 기반의 행동 방식과 문제 해결 과정을 심층적으로 묻는 질문을 2개 포함하세요.
    4. **압박 면접 요소**: 단순히 경험을 묻는 것이 아니라, "만약 ~한 상황이라면?" 과 같은 상황 가정형 질문을 1개 포함하세요.

    [출력 형식]
    반드시 아래 JSON 형식으로만 출력하세요:
    [
      {{
        "id": 1,
        "type": "consistency | tech | personality | behavioral",
        "question": "질문 내용",
        "intent": "질문의 의도 (면접관 가이드)",
        "expected_keywords": ["키워드1", "키워드2"],
        "mock_answer": "모범 답안 예시"
      }},
      ...
    ]
    """

    try:
        response = model.generate_content(prompt)
        # JSON 파싱을 위해 텍스트 정제
        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
            
        return json.loads(text)
    except Exception as e:
        return {"error": str(e)}

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
