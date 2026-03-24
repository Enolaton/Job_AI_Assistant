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
    model = genai.GenerativeModel('gemini-2.0-flash')

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
    1. **데이터 일관성 (Consistency)**: 면접 답변이 본인이 작성한 자소서나 공고의 요구사항과 충돌하는 지점이 있는지 확인하세요. 만약 일치한다면 높은 점수를, 모순된다면 그 이유와 함께 감점하세요.
    2. **직무 전문성 (Expertise)**: 기술적인 질문에 대해 구체적인 사례와 수치를 들어 답변했는지 분석하세요.
    3. **논리 및 구조 (Logic)**: STARI(Situation, Task, Action, Result, Insight) 구조로 답변이 구성되었는지 평가하세요.
    4. **전략 제안 (Strategy)**: 다음 실제 면접에서 더 좋은 점수를 받기 위한 실질적인 액션 아이템을 제시하세요.

    [출력 형식]
    반드시 아래 JSON 형식으로만 출력하세요:
    {{
      "score": 0~100 사이의 정수,
      "strengths": ["강점1", "강점2"],
      "weaknesses": ["약점1", "약점2"],
      "consistency_check": "기존 서류 데이터와의 일관성 분석 결과 총평",
      "feedback": "종합적인 피드백 및 조언"
    }}
    """

    try:
        response = model.generate_content(prompt)
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
        result = evaluate_interview(input_data)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
