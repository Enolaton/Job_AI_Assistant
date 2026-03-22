# -*- coding: utf-8 -*-
"""
자기소개서 초안 생성 에이전트 (순수 함수 호출 기반)

[워크플로우]
1. 입력 데이터(JD, 이력서, DART, 자소서 문항)를 바탕으로 작성 전략 수립
2. 수립된 전략을 바탕으로 자기소개서 1차안 생성
3. 유저의 자기소개서 컨펌 및 수정사항(피드백) 입력
4. 수정사항이 있으면 반영하여 자기소개서 내용 개선 (반복)

[입력]
- question_data: {"question": "...", "max_chars": 500}
- jd_data: JD JSON
- resume_data: 이력서 추출 데이터 JSON
- dart_data: DART 기업 분석 JSON (Optional)
- api_key: Gemini API Key
"""

import json
import os
import google.generativeai as genai


# ============================================================
# 1. LLM 초기화
# ============================================================
def get_model(api_key: str):
    """Gemini 2.5 Flash 모델 반환"""
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        'gemini-2.5-flash',
        generation_config={"temperature": 0.0}
    )


# ============================================================
# 2. 전략 수립
# ============================================================
def plan_strategy(question, max_chars, jd_data, resume_data, api_key, dart_data=None):
    """
    JD, 이력서, DART, 문항 정보를 종합하여 문항에 대한 작성 전략을 세움
    """
    print("\n  [전략 수립 중...]")
    model = get_model(api_key)

    jd_summary = json.dumps(jd_data, ensure_ascii=False, indent=2)
    # 이력서 데이터 필터링 (필요한 섹션만 선택)
    resume_keys = {
        "skills": ["Skills", "skills"],
        "experience": ["Experience", "experience"],
        "projects_activities": ["Projects_Activities", "projects_activities"],
        "research_and_thesis": ["Research_and_Thesis", "research_and_thesis"]
    }
    selected_resume = {}
    for key, possible_keys in resume_keys.items():
        for pk in possible_keys:
            if pk in resume_data:
                selected_resume[key] = resume_data[pk]
                break
    resume_summary = json.dumps(selected_resume, ensure_ascii=False, indent=2)
    dart_section = ""
    if dart_data:
        # 'business_overview'와 'products_services' 섹션만 사용
        selected_dart = {
            "business_overview": dart_data.get("business_overview", ""),
            "products_services": dart_data.get("products_services", "")
        }
        dart_summary = json.dumps(selected_dart, ensure_ascii=False, indent=2)
        dart_section = f"""
    [기업 분석 데이터 (DART)]
    {dart_summary}
    """

    prompt = f"""
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

    response = model.generate_content(prompt)
    return response.text.strip()


def analyze_feedback_dependency(user_feedback, api_key):
    """
    사용자의 피드백이 JD/DART나 Resume 정보를 필요로 하는지 분석
    """
    model = get_model(api_key)
    prompt = f"""
    사용자의 자기소개서 내용 수정 요청을 분석하여, 해당 요청이 기업 정보(JD, DART)나 지원자의 상세 경험(Resume)을 다시 확인해야 하는 성격인지 판단하세요.
    
    [사용자 수정 요청]
    {user_feedback}
    
    [판단 기준]
    1. needs_jd_dart: 기업의 사업 방향, 직무 요구사항(JD), 우대사항 등 기업/직무 관련 맥락을 참조해야 하는 경우 (예: "기업의 비전 반영", "직무 역량 강조")
    2. needs_resume: 지원자의 구체적인 프로젝트, 스킬, 자격증 등 이력서의 상세 내용을 다시 확인해야 하는 경우 (예: "A 프로젝트 내용 보강", "파이썬 역량 강조")
    
    [출력 형식]
    반드시 아래와 같은 JSON 형식으로만 응답하세요. 다른 설명은 생략하세요.
    {{
        "needs_jd_dart": true/false,
        "needs_resume": true/false
    }}
    """
    response = model.generate_content(prompt)
    try:
        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[-1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception:
        # 파싱 실패 시 보수적으로 모두 True 반환
        return {"needs_jd_dart": True, "needs_resume": True}


# ============================================================
# 3. 자소서 수정 (기존 전략 수정 대체)
# ============================================================
def revise_draft(question, max_chars, current_draft, strategy, user_feedback, jd_data, resume_data, api_key, dart_data=None):
    """
    유저의 수정사항을 반영하여 기존 자기소개서 초안을 개선
    """
    print("\n  [피드백 분석 중...]")
    dependency = analyze_feedback_dependency(user_feedback, api_key)
    needs_jd = dependency.get("needs_jd_dart", True)
    needs_resume = dependency.get("needs_resume", True)

    print(f"  [분석 결과: JD/DART 필요={needs_jd}, Resume 필요={needs_resume}]")
    print("  [수정사항을 반영하여 자기소개서 개선 중...]")
    model = get_model(api_key)

    # 1. JD 및 DART 데이터 구성 (필요할 때만)
    jd_section = ""
    dart_section = ""
    if needs_jd:
        jd_summary = json.dumps(jd_data, ensure_ascii=False, indent=2)
        jd_section = f"\n[채용 공고 (JD)]\n{jd_summary}"
        if dart_data:
            selected_dart = {
                "business_overview": dart_data.get("business_overview", ""),
                "products_services": dart_data.get("products_services", "")
            }
            dart_summary = json.dumps(selected_dart, ensure_ascii=False, indent=2)
            dart_section = f"\n[기업 분석 데이터 (DART)]\n{dart_summary}"

    # 2. 이력서 데이터 구성 (필요할 때만)
    resume_section = ""
    if needs_resume:
        resume_keys = {
            "skills": ["Skills", "skills"],
            "experience": ["Experience", "experience"],
            "projects_activities": ["Projects_Activities", "projects_activities"],
            "research_and_thesis": ["Research_and_Thesis", "research_and_thesis"]
        }
        selected_resume = {}
        for key, possible_keys in resume_keys.items():
            for pk in possible_keys:
                if pk in resume_data:
                    selected_resume[key] = resume_data[pk]
                    break
        resume_summary = json.dumps(selected_resume, ensure_ascii=False, indent=2)
        resume_section = f"\n[지원자 이력서 데이터]\n{resume_summary}"

    prompt = f"""
    당신은 한국 대기업 채용 자기소개서 작성을 전문으로 하는 10년 차 취업 컨설턴트입니다.
    이전에 작성된 자기소개서 초안에 대해 사용자가 수정 요청을 보냈습니다.
    제공된 맥락 정보를 바탕으로 자기소개서를 수정 및 개선해 주세요.

    [자기소개서 문항]
    질문: {question}
    글자 수 제한: {max_chars}자
    {jd_section}
    {dart_section}
    {resume_section}

    [기존 자기소개서 1차안]
    {current_draft}

    [수립된 작성 전략]
    {strategy}

    [사용자 수정 요청]
    {user_feedback}

    [수정 지침]
    1. **사용자가 요청한 내용을 우선적으로 반영하여 내용을 개선하세요.**
    2. 기존 자소서에서 수정이 필요하지 않은 부분은 자연스럽게 유지하세요.
    3. 글자 수 제한({max_chars}자)을 엄격히 지켜 주세요. 공백 포함 {max_chars}자를 초과하면 안 됩니다.
    4. 지원자의 실제 경험과 데이터에 기반하여 작성하세요. 없는 사실을 지어내지 마세요.
    5. 자연스러운 한국어로 작성하되, 지나치게 문어체이거나 AI 생성 느낌이 나지 않도록 주의하세요.
    6. 마크다운 형식이나 제목 태그 없이 순수한 자기소개서 본문만 출력하세요.
    """

    response = model.generate_content(prompt)
    return response.text.strip()


# ============================================================
# 4. 자소서 초안 생성
# ============================================================
def generate_draft(question, max_chars, strategy, jd_data, resume_data, api_key, dart_data=None):
    """
    수립된 전략을 바탕으로 실제 자기소개서 1차안 작성
    """
    print("\n  [전략 기반으로 자소서 1차안 생성 중...]")
    model = get_model(api_key)

    jd_summary = json.dumps(jd_data, ensure_ascii=False, indent=2)
    # 이력서 데이터 필터링 (필요한 섹션만 선택)
    resume_keys = {
        "skills": ["Skills", "skills"],
        "experience": ["Experience", "experience"],
        "projects_activities": ["Projects_Activities", "projects_activities"],
        "research_and_thesis": ["Research_and_Thesis", "research_and_thesis"]
    }
    selected_resume = {}
    for key, possible_keys in resume_keys.items():
        for pk in possible_keys:
            if pk in resume_data:
                selected_resume[key] = resume_data[pk]
                break
    resume_summary = json.dumps(selected_resume, ensure_ascii=False, indent=2)
    dart_section = ""
    if dart_data:
        # 'business_overview'와 'products_services' 섹션만 사용
        selected_dart = {
            "business_overview": dart_data.get("business_overview", ""),
            "products_services": dart_data.get("products_services", "")
        }
        dart_summary = json.dumps(selected_dart, ensure_ascii=False, indent=2)
        dart_section = f"""
    [기업 분석 데이터 (DART)]
    {dart_summary}
    """

    prompt = f"""
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
    6. 마크다운 형식이나 제목 태그 없이 순수한 자기소개서 본문만 출력하세요.
    """

    response = model.generate_content(prompt)
    return response.text.strip()


# ============================================================
# 5. 메인 실행 함수
# ============================================================
def run_self_instruction_generation(question_data, jd_data, resume_data, api_key, dart_data=None):
    """
    자기소개서 한 문항에 대한 초안 생성을 수행합니다.

    Args:
        question_data (dict): {"question": "...", "max_chars": 500}
        jd_data (dict): JD JSON 데이터
        resume_data (dict): 이력서 추출 데이터 JSON
        api_key (str): Gemini API Key
        dart_data (dict, optional): DART 기업 분석 JSON

    Returns:
        dict: {"question": "...", "answer": "..."} 형태의 결과
    """
    question = question_data["question"]
    max_chars = question_data["max_chars"]

    # === 1단계: 전략 수립 ===
    print("\n" + "=" * 60)
    print(" [1단계] 작성 전략을 수립하고 있습니다...")
    print("=" * 60)

    strategy = plan_strategy(question, max_chars, jd_data, resume_data, api_key, dart_data)

    # === 2단계: 1차안 생성 ===
    print("\n" + "=" * 60)
    print(" [2단계] 작성 전략을 바탕으로 1차안을 생성 중...")
    print("=" * 60)

    draft = generate_draft(question, max_chars, strategy, jd_data, resume_data, api_key, dart_data)

    # === 3단계: 유저 컨펌 및 개선 루프 ===
    while True:
        print("\n" + "-" * 60)
        print(" [생성된 자기소개서 초안]")
        print("-" * 60)
        print(draft)
        print("-" * 60)
        print(f" 글자 수: {len(draft)}자 / 제한: {max_chars}자")
        print("-" * 60)

        user_input = input("\n자기소개서를 승인하시겠습니까? (승인: Enter / 수정사항 입력): ").strip()

        if user_input == "":
            # 승인
            break
        else:
            # 수정 요청 → 초안 개선
            print("\n" + "=" * 60)
            print(" [3단계] 피드백을 반영하여 자기소개서를 개선하고 있습니다...")
            print("=" * 60)
            draft = revise_draft(question, max_chars, draft, strategy, user_input, jd_data, resume_data, api_key, dart_data)

    return {
        "question": question,
        "answer": draft
    }


# ============================================================
# 6. 헬퍼 함수
# ============================================================
def load_json(file_path):
    """로컬 JSON 파일 로드"""
    if not os.path.exists(file_path):
        print(f"  [경고] 파일을 찾을 수 없습니다: {file_path}")
        return None
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


# ============================================================
# 7. 메인
# ============================================================
def main():
    # API 키 설정
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        api_key = input("Gemini API Key를 입력하세요: ")
    if not api_key:
        print("API Key가 누락되었습니다.")
        return

    # 경로 설정
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(script_dir, "자기소개서_생성_입력데이터")
    output_dir = os.path.join(script_dir, "자기소개서_생성_출력데이터")

    # === 데이터 경로 설정 ===
    TARGET_COMPANY = "LG_CNS"

    jd_path = os.path.join(input_dir, f"{TARGET_COMPANY}_JD.json")
    resume_path = os.path.join(input_dir, "이력서_예시_추출데이터.json")
    dart_path = os.path.join(input_dir, f"{TARGET_COMPANY}_dart.json")
    question_path = os.path.join(input_dir, "question_data.json")

    # 데이터 로드
    jd_data = load_json(jd_path)
    resume_data = load_json(resume_path)
    dart_data = load_json(dart_path)  # 없을 수도 있음
    question_data = load_json(question_path)

    if not jd_data or not resume_data or not question_data:
        print("입력 데이터를 로드할 수 없습니다. (JD, 이력서, 문항 데이터 확인 필요)")
        return

    print(f"\n[자기소개서 생성 시작]")
    print(f"  기업: {TARGET_COMPANY}")
    print(f"  문항: {question_data['question']}")
    print(f"  글자수 제한: {question_data['max_chars']}자")

    # 생성 실행
    result = run_self_instruction_generation(
        question_data=question_data,
        jd_data=jd_data,
        resume_data=resume_data,
        api_key=api_key,
        dart_data=dart_data,
    )

    # 결과 저장
    output_data = {
        "company": TARGET_COMPANY,
        "job": jd_data.get("모집직무", ""),
        "qna": [result]
    }
    output_path = os.path.join(output_dir, f"{TARGET_COMPANY}_생성_자소서.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=4)

    print(f"\n[완료] 결과가 저장되었습니다: {output_path}")


if __name__ == "__main__":
    main()
