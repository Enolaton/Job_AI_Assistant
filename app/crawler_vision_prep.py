import time
import os
from urllib.parse import urlparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

def capture_full_page(url: str, output_filename: str = "job_posting_full.png"):
    print(f"▶ URL 접속 중: {url}")
    
    # 1. 브라우저 옵션 설정 (Headless 및 봇 탐지 우회)
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--start-maximized")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled") # 봇 탐지 우회
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    # 자동화 메시지 제거
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"
    })
    
    try:
        driver.get(url)
        time.sleep(3)  # 기본 페이지 렌더링/팝업 뜨기 대기
        
        domain = urlparse(url).netloc
        
        # 2. [구조적 개선] 최상단 광역 DOM 청소
        # 캡처를 방해하는 요소들과 잡코리아의 하단 불필요 섹션들을 구조적으로 제거합니다.
        print("▶ 화면 노이즈 제거(팝업, 배너, 하단 섹션 등) 진행 중...")
        clear_all_noise_js = """
        // 1. 기존 방식: 알려진 노이즈 요소들 제거
        const allNoises = [
            'header', 'nav', 'footer', 'dialog', 'aside',
            '[class*="header"]', '[class*="nav"]', '[class*="footer"]', '[class*="aside"]',
            '[class*="popup"]', '[id*="popup"]', '.layer_wrap', '.dimmed', '[class*="modal"]', '[id*="modal"]',
            '.recommend_wrap', '.review_wrap', '#rec_recommend', '.company_info_wrap',
            '[id*="gnb"]', '[class*="gnb"]',
            '[class*="floating"]', '[id*="floating"]',
            '[style*="position: fixed"]', '[style*="position: sticky"]', '[style*="position: absolute"]',
            /* --- 잡코리아 전용 섹션들 --- */
            '[data-sentry-component="StrategyWrapper"]', '.related-tags', '#recommended-section',
            '[data-sentry-component="Notice"]', '[data-sentry-component="AIRecommendList"]',
            '[data-sentry-component="Aside"]', '[data-sentry-component="Banner"]', '.side-area', '.side-banner',
            '[class*="ChipTag"]', '.artReadTag', '[class*="keyword"]', '[class*="banner"]',
            /* --- 광고성 iframe들 --- */
            'iframe[title*="광고"]', 'iframe[id*="google_ads"]'
        ];
        allNoises.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => { 
                el.style.setProperty('display', 'none', 'important'); 
            });
        });

        // 2. [구조적 해결] 잡코리아 상세페이지의 '본문 이후'를 통째로 날려버리는 로직
        // '복리후생' 혹은 '기업정보' 섹션을 찾아서 그 이후의 모든 형제(Siblings)를 숨깁니다.
        const targetComponents = ["StrategyWrapper", "BenefitCard", "CorpInformation", "ApplyBox"];
        for (const compName of targetComponents) {
            const startEl = document.querySelector(`[data-sentry-component="${compName}"]`);
            if (startEl && compName === "StrategyWrapper") {
                // '취업 전략' 그 자체부터 그 뒤를 다 지움
                let next = startEl;
                while(next) {
                    next.style.setProperty('display', 'none', 'important');
                    next = next.nextElementSibling;
                }
                break; 
            } else if (startEl) {
                // BenefitCard나 CorpInformation 등을 찾았다면 그 '다음' 형제부터 다 지움
                let next = startEl.nextElementSibling;
                while(next) {
                    next.style.setProperty('display', 'none', 'important');
                    next = next.nextElementSibling;
                }
            }
        }
        
        // 추가로 grid-area="list-content" 도 확실히 날림
        document.querySelectorAll('div[style*="list-content"]').forEach(el => el.remove());
        """
        driver.execute_script(clear_all_noise_js)
        time.sleep(1)

        # 3. iframe(실제 공고 본문) 쏙 뽑아내기 타겟팅
        if "saramin" in domain:
            print("▶ 사람인 도메인 감지. iframe 내부 본문 진입을 시도합니다.")
            try:
                iframe = driver.find_element(By.ID, "iframe_content_0")
                driver.switch_to.frame(iframe)
                print("   ✅ 사람인 iframe 진입 성공")
                time.sleep(1)
            except Exception as e:
                print("   ⚠️ iframe을 찾을 수 없습니다. 기본 페이지 캡처를 진행합니다.")
                
        elif "catch.co.kr" in domain:
            print("▶ 캐치 도메인 감지. 채용상세 iframe 내부 진입을 시도합니다.")
            try:
                iframe = driver.find_element(By.XPATH, '//iframe[@title="채용상세"]')
                driver.switch_to.frame(iframe)
                print("   ✅ 캐치 iframe 진입 성공")
                time.sleep(1)
            except Exception as e:
                print("   ⚠️ iframe을 찾을 수 없습니다. 기본 페이지 캡처를 진행합니다.")

        # 4. 고속 스크롤 (지연 로딩 이미지 렌더링 유도)
        print("▶ 지연 로딩 이미지 렌더링을 위해 스크롤 중...")
        last_height = driver.execute_script("return document.body.scrollHeight")
        max_scroll_attempts = 15
        attempts = 0
        current_position = 0
        
        while attempts < max_scroll_attempts:
            attempts += 1
            step_limit = min(last_height, 15000)
            
            while current_position < step_limit:
                driver.execute_script(f"window.scrollTo(0, {current_position});")
                current_position += 800
                time.sleep(0.1)
            
            time.sleep(1.0)
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height or current_position >= 15000:
                break
            last_height = new_height

        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(1)
        
        # [추가] 스크롤 후 한 번 더 청소를 해줍니다 (지연 로딩된 섹션들 제거)
        print("▶ 지연 로딩된 노이즈 요소 추가 제거 중...")
        driver.execute_script(clear_all_noise_js)
        time.sleep(1)
        
        # 5. 브라우저 창 크기 세팅
        required_width = driver.execute_script('return document.documentElement.scrollWidth')
        required_height = driver.execute_script('return document.body.scrollHeight')
        
        required_height += 150
        required_height = min(required_height, 20000)
        
        print(f"▶ 창 크기 세팅 및 전체 캡처 진행 중... (예상 해상도: {required_width} x {required_height})")
        driver.set_window_size(required_width, required_height)
        time.sleep(2)
        
        # 6. 전체 화면 캡처 저장
        body = driver.find_element(By.TAG_NAME, "body")
        body.screenshot(output_filename)
        
        print(f"✅ 캡처 완료! 저장 위치: {os.path.abspath(output_filename)}")
        return output_filename
        
    except Exception as e:
        print(f"❌ 캡처 중 오류 발생: {e}")
        return None
    finally:
        driver.quit()

if __name__ == "__main__":
    print("="*60)
    print(" 🚀 고속 범용 캡처 파이프라인 (capture_url5.py - 구조 기반 개선판)")
    print("="*60)
    # 기본 테스트 URL (HL클레무브 잡코리아 공고)
    test_url = "https://www.jobkorea.co.kr/Recruit/GI_Read/48716715?Oem_Code=C1&PageGbn=ST"
    custom_url = input(f"캡처할 URL을 입력하세요 (엔터 시 테스트 URL 사용): ")
    if custom_url.strip():
        test_url = custom_url
        
    capture_full_page(test_url, "test_capture_result_v5.png")
