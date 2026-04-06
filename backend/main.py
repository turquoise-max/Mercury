from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, AsyncGenerator, Type
import asyncio
import os
import time
import warnings
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import ssl
import re
import base64
from dotenv import load_dotenv
from crawl4ai import AsyncWebCrawler
from google import genai

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

class NewsletterResponse(BaseModel):
    intro_html: str
    main_news_html: str
    ai_tools_html: str
    deep_finds_html: str
    interesting_ai_html: str
    sources_html: str

class SearchQueriesResponse(BaseModel):
    ai_tools_query: str
    deep_finds_query: str
    interesting_ai_query: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    selected_text: Optional[str] = None
    instruction: str
    chat_history: Optional[list[ChatMessage]] = []

async def crawl_articles(topic: str, count: int) -> list:
    print(f"[{topic}] 주제로 {count}개의 기사 검색 중...")
    results = []
    try:
        # 1. Bing 뉴스 RSS URL (다이렉트 원문 링크 제공, 암호화 없음)
        encoded_topic = urllib.parse.quote(topic)
        rss_url = f"https://www.bing.com/news/search?q={encoded_topic}&format=rss&mkt=ko-KR"
        
        ssl_context = ssl._create_unverified_context()
        req = urllib.request.Request(
            rss_url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'}
        )
        
        with urllib.request.urlopen(req, context=ssl_context) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        items = root.findall('.//item')[:count + 5]
        
        if not items:
            return []
            
        print(f"검색 완료. {len(items)}개의 기사 크롤링 시작...")
        
        # Crawl4AI 크롤러 실행
        async with AsyncWebCrawler() as crawler:
            for item in items:
                title = item.findtext('title')
                # Bing 뉴스는 리다이렉트 없이 진짜 언론사 주소를 바로 줍니다!
                direct_url = item.findtext('link')
                
                if not direct_url:
                    continue

                # Bing 추적 URL에서 진짜 기사 URL만 깔끔하게 추출 (추가된 부분)
                try:
                    parsed_url = urllib.parse.urlparse(direct_url)
                    query_params = urllib.parse.parse_qs(parsed_url.query)
                    if 'url' in query_params:
                        direct_url = query_params['url'][0]
                except Exception:
                    pass

                print(f"[Crawl4AI 크롤링 시작] {direct_url}")
                
                try:
                    # magic=True로 언론사 자체 봇 차단막만 우회
                    result = await crawler.arun(url=direct_url, magic=True)
                    text = (result.markdown or "").strip()[:2000]
                    
                    if text:
                        print(f"성공: {len(text)}자 추출 완료 - {title}")
                        results.append({
                            'title': title,
                            'url': direct_url,
                            'content': text
                        })
                        if len(results) >= count:
                            print(f"✅ 요청한 {count}개의 기사 수집을 완료하여 크롤링을 조기 종료합니다.")
                            break
                    else:
                        print(f"실패/경고: 크롤링 결과가 비어 있음 - {title}")
                except Exception as e:
                    print(f"오류: Crawl4AI 크롤링 실패 ({direct_url}) - {e}")
                    
    except Exception as e:
        print(f"검색 과정 중 예기치 않은 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=f"기사 검색 중 오류 발생: {str(e)}")
        
    return results

async def call_gemini_with_retry(prompt: str, max_retries: int = 3, initial_delay: int = 2, is_json: bool = False, response_schema: Optional[Type[BaseModel]] = None) -> str:
    client = genai.Client()
    
    config = {}
    if is_json:
        config['response_mime_type'] = 'application/json'
    if response_schema:
        config['response_schema'] = response_schema
        
    for attempt in range(max_retries):
        try:
            print(f"Gemini API 호출 시도 {attempt + 1}/{max_retries}...")
            # genai.Client는 기본적으로 timeout 설정이 명시적이지 않으나 
            # 호출 자체가 실패할 경우 Exception을 던지므로 여기서 잡습니다.
            # 동기 네트워크 호출을 이벤트 루프에서 분리하기 위해 to_thread 사용
            response = await asyncio.to_thread(
                client.models.generate_content,
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
            
            # exponential backoff - time.sleep 대신 asyncio.sleep 사용
            await asyncio.sleep(initial_delay * (2 ** attempt))
            
    raise HTTPException(status_code=500, detail="Gemini API 호출에 실패했습니다.")

async def generate_newsletter_with_gemini(topic: str, main_news: list, ai_tools: list, deep_finds: list, interesting_ai: list, sponsor_text: Optional[str] = None, prompt_of_the_day: Optional[str] = None) -> str:
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
    
    prompt = f"""[절대 규칙 - 반드시 지킬 것]
- 정보 기반 작성 및 플랜 B: 기본적으로 전달된 JSON 데이터(`main_news`, `ai_tools`, `deep_finds`, `interesting_ai`) 안에 있는 실제 기사 내용만을 바탕으로 작성해. 하지만 만약 특정 섹션(예: interesting_ai_html, deep_finds_html)을 채울 구체적인 기사 정보가 부족하다면, 절대 빈 문자열("")을 반환하지 마. 대신 수집된 '메인 뉴스'의 맥락을 바탕으로 해당 카테고리와 관련된 '최신 트렌드 분석'이나 '에디터의 통찰(인사이트)'을 작성해서 지면을 채워줘.
- 사족 금지: '오늘의 툴을 소개합니다' 같은 뻔한 도입부 문장을 절대 쓰지 마. 곧바로 기사/툴 이름과 핵심 설명으로 넘어가.
- 카테고리 엄수: 
  1. 'ai_tools_html': 언론사나 뉴스 기사가 아닌, 실제 작동하는 '소프트웨어/앱/서비스'만 넣어.
  2. 'deep_finds_html': 뭉뚱그린 사이트 소개가 아니라, 구체적인 논문 이름, 리포트 제목, 오픈소스 프로젝트 명을 정확히 명시해 (정보가 부족하면 플랜 B 적용).
  3. 'interesting_ai_html': ChatGPT 같은 챗봇 소프트웨어가 아니라, 반드시 로봇, 웨어러블, 가젯 등 물리적인 '기기(Hardware)' 위주로만 작성해 (관련 하드웨어 기사가 없다면 플랜 B 적용).

너는 10년 차 베테랑 뉴스레터 에디터야. 제공된 기사 정보들을 바탕으로 읽기 쉽고 흥미로운 뉴스레터를 작성해 줘. 
반드시 아래 JSON 포맷으로만 응답해야 해. 마크다운(```json 등)은 절대 사용하지 마.

{{
  "intro_html": "활기찬 인사말과 오늘 다룰 핵심 주제 8~10가지를 <ul><li> 형태의 불릿 포인트로 요약",
  "main_news_html": "각 뉴스는 <h3>[이모지] 기사 제목</h3>과 <p>3~4문장 핵심 요약 (중요 부분 <strong>)</p>으로 구성",
  "ai_tools_html": "툴 소개 (<ul><li>[이모지] <strong>툴이름</strong>: 1~2문장 기능 설명</li></ul>). 단, 제공된 툴 중 하나는 네이티브 애드 형태로 깊이 있게 소개할 것",
  "deep_finds_html": "심층 정보 (다큐, 논문, 오픈소스 등)를 <ul><li> 형태로 구성. 기사 정보가 부족하면 메인 뉴스 기반의 심층 분석/인사이트 제공",
  "interesting_ai_html": "반드시 기사에 등장한 '특정 브랜드의 구체적인 제품명'을 하나 선정해서 2~3문단으로 상세히 리뷰하는 HTML (<p> 태그 사용). 만약 기사에 구체적인 제품명이 명시되어 있지 않다면, '메인 뉴스'의 맥락과 연결하여 최신 AI 트렌드나 에디터 인사이트로 대체하여 작성해.",
  "sources_html": "수집된 모든 기사의 출처(제목과 URL)를 <ul><li><a href='url'>제목</a></li></ul> 형태로 구성"
}}

제약조건:
- 허용되는 HTML 태그: <h3>, <p>, <ul>, <li>, <strong>, <a>, <br>
- JSON 형식 외에 다른 텍스트는 절대 출력하지 마.
- 각 값은 문자열이어야 하고, 이스케이프 처리를 완벽하게 해줘.

[수집된 기사 정보]
{context}"""

    try:
        result_text = await call_gemini_with_retry(prompt, is_json=True, response_schema=NewsletterResponse)
        data = NewsletterResponse.model_validate_json(result_text).model_dump()
    except Exception as e:
        print(f"JSON 파싱 오류: {e}, 원본 텍스트: {result_text if 'result_text' in locals() else 'None'}")
        raise HTTPException(status_code=500, detail="뉴스레터 생성 중 오류가 발생했습니다. 다시 시도해주세요.")
        
    # 방어 로직: 각 섹션이 비어있지 않을 때만 제목과 구분선을 포함
    intro_html = data.get('intro_html', '')
    
    main_news_html = data.get('main_news_html', '')
    main_news_section = f"<hr>\n<h2>🔥 메인 뉴스</h2>\n{main_news_html}\n" if main_news_html else ""
    
    ai_tools_html = data.get('ai_tools_html', '')
    ai_tools_section = f"<hr>\n<h2>🛠️ 오늘의 AI 툴</h2>\n{ai_tools_html}\n" if ai_tools_html else ""
    
    sponsor_section = f"<hr>\n<h2>💎 스폰서</h2>\n<blockquote>{sponsor_text}</blockquote>\n" if sponsor_text else ""
    
    deep_finds_html = data.get('deep_finds_html', '')
    deep_finds_section = f"<hr>\n<h2>📚 심층 정보 및 아티클</h2>\n{deep_finds_html}\n" if deep_finds_html else ""
    
    interesting_ai_html = data.get('interesting_ai_html', '')
    interesting_ai_section = f"<hr>\n<h2>🤖 흥미로운 하드웨어 & 서비스</h2>\n{interesting_ai_html}\n" if interesting_ai_html else ""
    
    prompt_section = f"<hr>\n<h2>✍️ 오늘의 프롬프트</h2>\n<blockquote>{prompt_of_the_day}</blockquote>\n" if prompt_of_the_day else ""
    
    sources_html = data.get('sources_html', '')
    sources_section = f"<hr>\n<h2>🔗 관련 자료</h2>\n{sources_html}\n" if sources_html else ""

    final_html = f"""{intro_html}
{main_news_section}{ai_tools_section}{sponsor_section}{deep_finds_section}{interesting_ai_section}{prompt_section}{sources_section}<hr>
<h2>💬 마무리 및 피드백</h2>
<p>오늘 머큐리가 전해드린 소식은 어떠셨나요? 여러분의 1분 피드백이 더 나은 뉴스레터를 만드는 데 큰 힘이 됩니다.</p>
<p><a href="https://docs.google.com/forms/d/e/1FAIpQLSf9PbZ7ggnzlsrDPhx8BBpD8P-egznXo8iZ_R_Org3BmIcvHQ/viewform?usp=dialog" target="_blank" data-button="feedback"><strong>👉 피드백 남기러 가기 (1분 소요)</strong></a></p>
<p>오늘 준비한 소식은 여기까지입니다. 눈길을 끄는 소식이 있었다면 동료와 친구들에게도 널리 공유해 주세요! 다음 주에도 가장 흥미로운 AI 소식으로 찾아오겠습니다. 🚀</p>
<br>
<p><strong>오늘도 함께해 주셔서 감사합니다. <br>— Mercury (머큐리)</strong></p>"""

    return final_html

async def generate_search_queries(topic: str) -> dict:
    print(f"[{topic}] 맞춤형 검색어 생성 중...")
    prompt = f"""사용자가 입력한 주제('{topic}')를 바탕으로 뉴스 및 아티클 크롤링을 위한 영문 검색어 3개를 생성해 줘.
각 검색어는 빙(Bing) 뉴스 검색에 사용될 예정이므로, 연관성 높고 구체적인 키워드 조합이어야 해.

1. ai_tools_query: '{topic}'와 관련된 최신 AI 소프트웨어, 스타트업 툴, Product Hunt 런칭 등에 최적화된 영문 검색어
2. deep_finds_query: '{topic}'와 관련된 arXiv 논문, 심층 연구 리포트, 오픈소스 프로젝트에 최적화된 영문 검색어
3. interesting_ai_query: '{topic}'와 관련된 AI 하드웨어, 로봇, 웨어러블, 스마트 가젯에 최적화된 영문 검색어

반드시 아래 JSON 형식으로만 반환해:
{{
  "ai_tools_query": "...",
  "deep_finds_query": "...",
  "interesting_ai_query": "..."
}}
"""
    try:
        result_text = await call_gemini_with_retry(prompt, max_retries=2, initial_delay=1, is_json=True, response_schema=SearchQueriesResponse)
        data = SearchQueriesResponse.model_validate_json(result_text)
        return data.model_dump()
    except Exception as e:
        print(f"검색어 생성 중 오류 발생: {e}, 기본 검색어 사용")
        return {
            "ai_tools_query": f"new AI startup tools launch producthunt {topic}",
            "deep_finds_query": f"arXiv research paper {topic} AI",
            "interesting_ai_query": f"new AI hardware gadget wearable robot release {topic}"
        }

@app.post("/api/search")
async def search_articles(request: SearchRequest):
    articles = await crawl_articles(request.topic, request.article_count)
    return {"articles": articles}

@app.post("/api/generate")
async def generate_newsletter(request: GenerateRequest):
    if not request.main_news:
        return {"html": "<p>선택된 메인 뉴스가 없어 뉴스레터를 생성할 수 없습니다.</p>"}
        
    main_news_dict = [{"title": a.title, "url": a.url, "content": a.content} for a in request.main_news]
    
    # 비동기로 맞춤형 검색어 생성
    queries = await generate_search_queries(request.topic)
    
    # 비동기로 자동 크롤링 병렬 실행
    ai_tools, deep_finds, interesting_ai = await asyncio.gather(
        crawl_articles(queries.get("ai_tools_query", f"new AI startup tools launch producthunt {request.topic}"), 3),
        crawl_articles(queries.get("deep_finds_query", f"arXiv research paper {request.topic} AI"), 3),
        crawl_articles(queries.get("interesting_ai_query", f"new AI hardware gadget wearable robot release {request.topic}"), 2)
    )
    
    html_content = await generate_newsletter_with_gemini(
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
    
    html_instruction = """
중요 제약조건: 생성하는 HTML 본문/초안은 절대 마크다운(*, ** 등)을 사용하지 말고, 반드시 Tiptap 에디터(StarterKit)에서 호환되는 기본 HTML 태그만 사용해야 해. 
허용되는 태그: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <hr>, <br>, <a>. 
절대 <div>, <span>, <section>, <style> 태그나 인라인 스타일(style='...')을 사용하지 마. 전체 구조는 오직 <p>와 헤딩 태그 위주로만 작성해.
"""

    # XML 태그 기반 스트리밍용 스키마 지시어
    schema_instruction = """
반드시 아래와 같은 커스텀 XML 태그 형식으로 응답해 줘. 스트리밍 처리를 위함이므로 다른 형식은 사용하지 마:
<chat>사용자에게 할 자연스러운 대화나 안내 문구 (에디터 본문에 들어갈 내용이 아님)</chat>
<html_draft>순수 HTML 본문(없으면 태그 생략). 마크다운 틱(```html)을 쓰지 마.</html_draft>
"""

    if request.selected_text:
        prompt = f"""원본 텍스트: [{request.selected_text}], 요청사항: [{request.instruction}]. 이 요청에 맞게 원본 텍스트를 수정해 줘.
{html_instruction}
{schema_instruction}
수정된 텍스트는 <html_draft> 태그에 담고, 수정 완료 안내 메시지를 <chat> 태그에 담아 줘."""
    else:
        history_text = ""
        if request.chat_history:
            for msg in request.chat_history:
                role = "사용자" if msg.role == "user" else "AI"
                history_text += f"{role}: {msg.content}\n"
                
        prompt = f"""너는 뉴스레터 전문가야. 사용자가 기획안이나 초안 작성을 요구하면 HTML 형식으로 성실히 작성해 줘.
{html_instruction}
{schema_instruction}

[이전 대화 기록]
{history_text}
사용자: {request.instruction}"""

    return StreamingResponse(stream_gemini_response(prompt), media_type="text/event-stream")

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"채팅/수정 요청: {request.instruction}")
    
    html_instruction = """
중요 제약조건: 생성하는 HTML 본문/초안은 절대 마크다운(*, ** 등)을 사용하지 말고, 반드시 Tiptap 에디터(StarterKit)에서 호환되는 기본 HTML 태그만 사용해야 해. 
허용되는 태그: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <hr>, <br>, <a>. 
절대 <div>, <span>, <section>, <style> 태그나 인라인 스타일(style='...')을 사용하지 마. 전체 구조는 오직 <p>와 헤딩 태그 위주로만 작성해.
"""

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
{html_instruction}
{schema_instruction}
수정된 텍스트는 'editor_html'에 담고, 수정 완료 안내 메시지를 'chat_message'에 담아 줘."""
    else:
        history_text = ""
        if request.chat_history:
            for msg in request.chat_history:
                role = "사용자" if msg.role == "user" else "AI"
                history_text += f"{role}: {msg.content}\n"
                
        prompt = f"""너는 뉴스레터 전문가야. 사용자가 기획안이나 초안 작성을 요구하면 HTML 형식으로 성실히 작성해 줘.
{html_instruction}
{schema_instruction}

[이전 대화 기록]
{history_text}
사용자: {request.instruction}"""
    
    try:
        result = await call_gemini_with_retry(prompt, max_retries=2, initial_delay=1, is_json=True)
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