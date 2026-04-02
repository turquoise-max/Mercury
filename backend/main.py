from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncio
import os
import time
import warnings
from dotenv import load_dotenv
from duckduckgo_search import DDGS
from firecrawl import FirecrawlApp
from google import genai

# DuckDuckGo 경고 억제
warnings.filterwarnings("ignore", module="duckduckgo_search")

# 환경 변수 로드 (.env 파일에서 GEMINI_API_KEY 등 로드)
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allows requests from Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

class SearchRequest(BaseModel):
    topic: str
    article_count: int

class Article(BaseModel):
    title: str
    url: str
    content: str

class GenerateRequest(BaseModel):
    topic: str
    articles: list[Article]

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    selected_text: Optional[str] = None
    instruction: str
    chat_history: Optional[list[ChatMessage]] = []

def crawl_articles(topic: str, count: int) -> list:
    print(f"[{topic}] 주제로 {count}개의 기사 검색 중...")
    results = []
    try:
        ddgs = DDGS()
        # DuckDuckGo 검색을 통해 기사 링크 수집
        try:
            search_results = list(ddgs.text(topic, max_results=count))
        except Exception as e:
            print(f"DuckDuckGo 검색 오류: {e}")
            raise HTTPException(status_code=500, detail=f"DuckDuckGo 검색 중 오류가 발생했습니다: {e}")

        if not search_results:
            return []
            
        print(f"검색 완료. {len(search_results)}개의 링크 크롤링 시작...")
        
        # Firecrawl 앱 초기화
        firecrawl = FirecrawlApp(api_key=os.environ.get('FIRECRAWL_API_KEY'))
        
        for item in search_results:
            url = item.get('href')
            title = item.get('title')
            if not url:
                continue
                
            print(f"[시작] Firecrawl 크롤링: {title} ({url})")
            try:
                # 파라미터 제외하고 기본 호출로 변경
                if hasattr(firecrawl, 'scrape_url'):
                    scrape_result = firecrawl.scrape_url(url)
                else:
                    scrape_result = firecrawl.scrape(url)
                
                print(f"Firecrawl 응답 타입: {type(scrape_result)}")
                print(f"Firecrawl 응답 키: {scrape_result.keys() if isinstance(scrape_result, dict) else 'Not a dict'}")

                # 반환된 결과에서 마크다운 텍스트 추출 (Object 및 Dict 형태 모두 대응)
                text = ""
                if isinstance(scrape_result, dict):
                    if 'markdown' in scrape_result:
                        text = scrape_result.get('markdown', '')
                    elif 'data' in scrape_result and isinstance(scrape_result['data'], dict) and 'markdown' in scrape_result['data']:
                        text = scrape_result['data'].get('markdown', '')
                elif hasattr(scrape_result, 'markdown'):
                    text = scrape_result.markdown or ""
                elif hasattr(scrape_result, 'get'):
                    text = scrape_result.get('markdown') or ""
                
                # 토큰 제한을 방지하기 위해 각 기사당 상위 2000자로 자르기
                text = (text or "").strip()[:2000]
                
                if text:
                    print(f"성공: {len(text)}자 추출 완료 - {title}")
                    results.append({
                        'title': title,
                        'url': url,
                        'content': text
                    })
                else:
                    print(f"실패/경고: 크롤링 결과가 비어 있음 - {title}")
            except Exception as e:
                print(f"오류: Firecrawl 크롤링 실패 ({url}) - 구체적 에러: {e}")
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"검색 과정 중 예기치 않은 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=f"기사 검색 중 예기치 않은 오류가 발생했습니다: {str(e)}")
        
    return results

def call_gemini_with_retry(prompt: str, max_retries: int = 3, initial_delay: int = 2) -> str:
    client = genai.Client()
    
    for attempt in range(max_retries):
        try:
            print(f"Gemini API 호출 시도 {attempt + 1}/{max_retries}...")
            # genai.Client는 기본적으로 timeout 설정이 명시적이지 않으나 
            # 호출 자체가 실패할 경우 Exception을 던지므로 여기서 잡습니다.
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            return response.text
        except Exception as e:
            error_msg = str(e).lower()
            if "api key" in error_msg or "unauthorized" in error_msg:
                # API 키 오류는 재시도해도 의미가 없으므로 바로 예외 발생
                raise HTTPException(status_code=401, detail="Gemini API 키가 유효하지 않거나 만료되었습니다.")
            
            print(f"Gemini API 호출 실패 (시도 {attempt + 1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                raise HTTPException(status_code=500, detail=f"Gemini API 호출에 실패했습니다 (최대 재시도 초과): {e}")
            
            # exponential backoff
            time.sleep(initial_delay * (2 ** attempt))
            
    raise HTTPException(status_code=500, detail="Gemini API 호출에 실패했습니다.")

def generate_newsletter_with_gemini(topic: str, articles: list) -> str:
    print("Gemini API로 뉴스레터 생성 중...")
    
    context = f"주제: {topic}\n\n[수집된 기사 정보]\n"
    for i, article in enumerate(articles):
        context += f"{i+1}. 제목: {article['title']}\nURL: {article['url']}\n내용 요약: {article['content']}...\n\n"
        
    prompt = f"""너는 10년 차 베테랑 뉴스레터 에디터야. 수집된 아래 기사 정보들을 바탕으로 읽기 쉽고 흥미로운 뉴스레터를 작성해 줘. 
- 서론: 주제에 대한 최근 동향과 인사말
- 본론: 각 기사를 헤드라인과 요약 내용으로 정리 (중요한 부분은 <strong> 태그 사용)
- 결론: 요약 및 마무리 인사
- 제약조건: 결과는 오직 Tiptap 에디터에서 즉시 사용 가능한 HTML 태그(<h1>, <h2>, <p>, <ul>, <li>, <strong>, <br>, <a>)로만 구성해 줘. 마크다운 기호(```html 등)는 절대 포함하지 마.

{context}"""

    html_result = call_gemini_with_retry(prompt)
    
    # 혹시라도 마크다운 코드 블록이 포함되어 있다면 제거
    if html_result.startswith("```html"):
        html_result = html_result.replace("```html", "", 1)
    if html_result.endswith("```"):
        html_result = html_result[:html_result.rfind("```")]
        
    return html_result.strip()

@app.post("/api/search")
async def search_articles(request: SearchRequest):
    articles = crawl_articles(request.topic, request.article_count)
    return {"articles": articles}

@app.post("/api/generate")
async def generate_newsletter(request: GenerateRequest):
    if not request.articles:
        return {"html": "<p>선택된 기사가 없어 뉴스레터를 생성할 수 없습니다.</p>"}
        
    articles_dict = [{"title": a.title, "url": a.url, "content": a.content} for a in request.articles]
    html_content = generate_newsletter_with_gemini(request.topic, articles_dict)
    
    print("뉴스레터 생성 완료!")
    
    return {"html": html_content}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"채팅/수정 요청: {request.instruction}")
    
    if request.selected_text:
        prompt = f"""원본 텍스트: [{request.selected_text}], 요청사항: [{request.instruction}]. 이 요청에 맞게 원본 텍스트를 수정해 줘. 다른 인사말이나 부연 설명 없이 오직 수정된 텍스트 결과물(필요시 HTML 태그 포함)만 반환해."""
    else:
        history_text = ""
        if request.chat_history:
            for msg in request.chat_history:
                role = "사용자" if msg.role == "user" else "AI"
                history_text += f"{role}: {msg.content}\n"
                
        prompt = f"""너는 뉴스레터 전문가야. 사용자가 특정 부분을 드래그하지 않고 대화만 할 때는 기획안이나 초안을 HTML 형식으로 성실히 작성해 줘. 뉴스레터 초안을 작성할 때는 반드시 ```html ... ``` 마크다운 코드 블록 형식을 사용해 줘. 답변 끝에는 항상 '이 내용을 에디터에 바로 적용하시려면 아래 적용 버튼을 누르세요'라는 안내를 덧붙여줘.

[이전 대화 기록]
{history_text}
사용자: {request.instruction}"""
    
    try:
        result = call_gemini_with_retry(prompt, max_retries=2, initial_delay=1)
        result = result.strip()
        
        # 혹시라도 마크다운 코드 블록이 포함되어 있다면 제거
        if result.startswith("```html"):
            result = result[7:]
        if result.startswith("```"):
            result = result[3:]
        if result.endswith("```"):
            result = result[:-3]
            
        return {"reply": result.strip()}
    except HTTPException as e:
        return {"error": e.detail, "reply": ""}
    except Exception as e:
        print(f"Gemini API 오류: {e}")
        return {"error": "처리 중 오류가 발생했습니다.", "reply": ""}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)