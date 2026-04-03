from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, AsyncGenerator
import asyncio
import os
import time
import warnings
import json
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
    main_news: list[Article]
    sponsor_text: Optional[str] = None
    prompt_of_the_day: Optional[str] = None

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

def call_gemini_with_retry(prompt: str, max_retries: int = 3, initial_delay: int = 2, is_json: bool = False) -> str:
    client = genai.Client()
    
    config = {}
    if is_json:
        config['response_mime_type'] = 'application/json'
        
    for attempt in range(max_retries):
        try:
            print(f"Gemini API 호출 시도 {attempt + 1}/{max_retries}...")
            # genai.Client는 기본적으로 timeout 설정이 명시적이지 않으나 
            # 호출 자체가 실패할 경우 Exception을 던지므로 여기서 잡습니다.
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=config if config else None
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

def generate_newsletter_with_gemini(topic: str, main_news: list, ai_tools: list, deep_finds: list, interesting_ai: list, sponsor_text: Optional[str] = None, prompt_of_the_day: Optional[str] = None) -> str:
    print("Gemini API로 뉴스레터 생성 중...")
    
    def format_articles(articles, title):
        if not articles:
            return ""
        res = f"[{title}]\n"
        for i, a in enumerate(articles):
            res += f"{i+1}. 제목: {a['title']}\nURL: {a['url']}\n내용: {a['content'][:500]}...\n\n"
        return res
        
    context = f"주제: {topic}\n\n"
    context += format_articles(main_news, "메인 뉴스")
    context += format_articles(ai_tools, "오늘의 AI 툴")
    context += format_articles(deep_finds, "심층 정보 및 아티클")
    context += format_articles(interesting_ai, "흥미로운 하드웨어 & 서비스")
    
    prompt = f"""너는 10년 차 베테랑 뉴스레터 에디터야. 제공된 기사 정보들을 바탕으로 읽기 쉽고 흥미로운 뉴스레터를 작성해 줘. 
반드시 아래 JSON 포맷으로만 응답해야 해. 마크다운(```json 등)은 절대 사용하지 마.

{{
  "intro_html": "활기찬 인사말과 오늘 다룰 핵심 주제 8~10가지를 <ul><li> 형태의 불릿 포인트로 요약",
  "main_news_html": "각 뉴스는 <h3>[이모지] 기사 제목</h3>과 <p>3~4문장 핵심 요약 (중요 부분 <strong>)</p>으로 구성",
  "ai_tools_html": "툴 소개 (<ul><li>[이모지] <strong>툴이름</strong>: 1~2문장 기능 설명</li></ul>). 단, 제공된 툴 중 하나는 네이티브 애드 형태로 깊이 있게 소개할 것",
  "deep_finds_html": "심층 정보 (다큐, 논문, 오픈소스 등)를 <ul><li> 형태로 구성",
  "interesting_ai_html": "하드웨어/서비스 1개를 선정해 2~3문단으로 상세히 리뷰하는 HTML (<p> 태그 사용)",
  "sources_html": "수집된 모든 기사의 출처(제목과 URL)를 <ul><li><a href='url'>제목</a></li></ul> 형태로 구성"
}}

제약조건:
- 허용되는 HTML 태그: <h3>, <p>, <ul>, <li>, <strong>, <a>, <br>
- JSON 형식 외에 다른 텍스트는 절대 출력하지 마.
- 각 값은 문자열이어야 하고, 이스케이프 처리를 완벽하게 해줘.

[수집된 기사 정보]
{context}"""

    result_text = call_gemini_with_retry(prompt, is_json=True)
    
    # 마크다운 코드 블록 제거 전처리
    cleaned_text = result_text.strip()
    if cleaned_text.startswith("```json"):
        cleaned_text = cleaned_text[7:]
    elif cleaned_text.startswith("```"):
        cleaned_text = cleaned_text[3:]
    if cleaned_text.endswith("```"):
        cleaned_text = cleaned_text[:-3]
    cleaned_text = cleaned_text.strip()
    
    try:
        data = json.loads(cleaned_text)
    except json.JSONDecodeError as e:
        print(f"JSON 파싱 오류: {e}, 원본 텍스트: {cleaned_text}")
        raise HTTPException(status_code=500, detail="뉴스레터 생성 중 오류가 발생했습니다. 다시 시도해주세요.")
        
    sponsor_html = f"""<hr>
<h2>💎 스폰서</h2>
<blockquote>{sponsor_text}</blockquote>
""" if sponsor_text else ""

    prompt_html = f"""<hr>
<h2>✍️ 오늘의 프롬프트</h2>
<blockquote>{prompt_of_the_day}</blockquote>
""" if prompt_of_the_day else ""

    final_html = f"""{data.get('intro_html', '')}
<hr>
<h2>🔥 메인 뉴스</h2>
{data.get('main_news_html', '')}
<hr>
<h2>🛠️ 오늘의 AI 툴</h2>
{data.get('ai_tools_html', '')}
{sponsor_html}<hr>
<h2>📚 심층 정보 및 아티클</h2>
{data.get('deep_finds_html', '')}
<hr>
<h2>🤖 흥미로운 하드웨어 & 서비스</h2>
{data.get('interesting_ai_html', '')}
{prompt_html}<hr>
<h2>🔗 관련 자료</h2>
{data.get('sources_html', '')}
<hr>
<h2>💬 마무리 및 피드백</h2>
<p>오늘의 뉴스레터는 어떠셨나요?</p>
<p><a href="https://docs.google.com/forms/d/e/1FAIpQLSf9PbZ7ggnzlsrDPhx8BBpD8P-egznXo8iZ_R_Org3BmIcvHQ/viewform?usp=dialog" target="_blank"><strong>👉 피드백 남기러 가기 (1분 소요)</strong></a></p>
<br>
<p><strong>Signing off, <br>— Mercury (머큐리)</strong></p>"""

    return final_html

@app.post("/api/search")
async def search_articles(request: SearchRequest):
    articles = crawl_articles(request.topic, request.article_count)
    return {"articles": articles}

@app.post("/api/generate")
async def generate_newsletter(request: GenerateRequest):
    if not request.main_news:
        return {"html": "<p>선택된 메인 뉴스가 없어 뉴스레터를 생성할 수 없습니다.</p>"}
        
    main_news_dict = [{"title": a.title, "url": a.url, "content": a.content} for a in request.main_news]
    
    # 비동기로 자동 크롤링 병렬 실행
    ai_tools, deep_finds, interesting_ai = await asyncio.gather(
        asyncio.to_thread(crawl_articles, "latest AI tools startup this week", 3),
        asyncio.to_thread(crawl_articles, "top AI machine learning research papers github", 3),
        asyncio.to_thread(crawl_articles, "interesting AI hardware robots gadgets", 2)
    )
    
    html_content = generate_newsletter_with_gemini(
        request.topic, 
        main_news_dict, 
        ai_tools, 
        deep_finds, 
        interesting_ai,
        request.sponsor_text,
        request.prompt_of_the_day
    )
    
    print("뉴스레터 생성 완료!")
    
    return {"html": html_content}

async def stream_gemini_response(prompt: str) -> AsyncGenerator[str, None]:
    client = genai.Client()
    try:
        response_stream = client.models.generate_content_stream(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        for chunk in response_stream:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        print(f"Gemini streaming error: {e}")
        yield f"<chat>처리 중 오류가 발생했습니다: {str(e)}</chat>"

@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    print(f"채팅/수정 스트리밍 요청: {request.instruction}")
    
    # XML 태그 기반 스트리밍용 스키마 지시어
    schema_instruction = """
반드시 아래와 같은 커스텀 XML 태그 형식으로 응답해 줘. 스트리밍 처리를 위함이므로 다른 형식은 사용하지 마:
<chat>사용자에게 할 자연스러운 대화나 안내 문구 (에디터 본문에 들어갈 내용이 아님)</chat>
<html_draft>순수 HTML 본문(없으면 태그 생략). 마크다운 틱(```html)을 쓰지 마.</html_draft>
"""

    if request.selected_text:
        prompt = f"""원본 텍스트: [{request.selected_text}], 요청사항: [{request.instruction}]. 이 요청에 맞게 원본 텍스트를 수정해 줘.
{schema_instruction}
수정된 텍스트는 <html_draft> 태그에 담고, 수정 완료 안내 메시지를 <chat> 태그에 담아 줘."""
    else:
        history_text = ""
        if request.chat_history:
            for msg in request.chat_history:
                role = "사용자" if msg.role == "user" else "AI"
                history_text += f"{role}: {msg.content}\n"
                
        prompt = f"""너는 뉴스레터 전문가야. 사용자가 기획안이나 초안 작성을 요구하면 HTML 형식으로 성실히 작성해 줘.

중요 제약조건: 생성하는 HTML 초안은 반드시 Tiptap 에디터(StarterKit)에서 호환되는 기본 태그만 사용해야 해. 허용되는 태그: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <hr>, <br>, <a>. 절대 <div>, <span>, <section>, <style> 태그나 인라인 스타일(style='...')을 사용하지 마. 전체 구조는 오직 <p>와 헤딩 태그 위주로만 작성해.

{schema_instruction}

[이전 대화 기록]
{history_text}
사용자: {request.instruction}"""

    return StreamingResponse(stream_gemini_response(prompt), media_type="text/event-stream")

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"채팅/수정 요청: {request.instruction}")
    
    # JSON Mode Schema Instruction
    schema_instruction = """
반드시 아래 JSON 형식으로만 응답해 줘. 다른 말은 절대 추가하지 마:
{
  "chat_message": "사용자에게 할 자연스러운 대화나 안내 문구 (에디터 본문에 들어갈 내용이 아님)",
  "editor_html": "순수 HTML 본문(없으면 null). 여기에 마크다운 틱(```html)을 쓰지 마."
}
"""

    if request.selected_text:
        prompt = f"""원본 텍스트: [{request.selected_text}], 요청사항: [{request.instruction}]. 이 요청에 맞게 원본 텍스트를 수정해 줘.
{schema_instruction}
수정된 텍스트는 'editor_html'에 담고, 수정 완료 안내 메시지를 'chat_message'에 담아 줘."""
    else:
        history_text = ""
        if request.chat_history:
            for msg in request.chat_history:
                role = "사용자" if msg.role == "user" else "AI"
                history_text += f"{role}: {msg.content}\n"
                
        prompt = f"""너는 뉴스레터 전문가야. 사용자가 기획안이나 초안 작성을 요구하면 HTML 형식으로 성실히 작성해 줘.

중요 제약조건: 생성하는 HTML 초안은 반드시 Tiptap 에디터(StarterKit)에서 호환되는 기본 태그만 사용해야 해. 허용되는 태그: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <hr>, <br>, <a>. 절대 <div>, <span>, <section>, <style> 태그나 인라인 스타일(style='...')을 사용하지 마. 전체 구조는 오직 <p>와 헤딩 태그 위주로만 작성해.

{schema_instruction}

[이전 대화 기록]
{history_text}
사용자: {request.instruction}"""
    
    try:
        result = call_gemini_with_retry(prompt, max_retries=2, initial_delay=1, is_json=True)
        result = result.strip()
        
        parsed_result = json.loads(result)
        
        return {
            "chat_message": parsed_result.get("chat_message", ""),
            "editor_html": parsed_result.get("editor_html", None)
        }
    except HTTPException as e:
        return {"error": e.detail, "chat_message": "", "editor_html": None}
    except Exception as e:
        print(f"Gemini API 오류/JSON 파싱 오류: {e}")
        return {"error": "처리 중 오류가 발생했습니다.", "chat_message": "", "editor_html": None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)