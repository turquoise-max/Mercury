from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import os
from dotenv import load_dotenv
from duckduckgo_search import DDGS
import requests
from bs4 import BeautifulSoup
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

class GenerateRequest(BaseModel):
    topic: str
    article_count: int

class EditRequest(BaseModel):
    selected_text: str
    instruction: str

def crawl_articles(topic: str, count: int) -> list:
    print(f"[{topic}] 주제로 {count}개의 기사 검색 중...")
    results = []
    try:
        ddgs = DDGS()
        # DuckDuckGo 검색을 통해 기사 링크 수집
        search_results = list(ddgs.text(topic, max_results=count))
        
        print(f"검색 완료. {len(search_results)}개의 링크 크롤링 시작...")
        for item in search_results:
            url = item.get('href')
            title = item.get('title')
            if not url:
                continue
                
            print(f"크롤링 중: {title} ({url})")
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                response = requests.get(url, headers=headers, timeout=5)
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # 본문 텍스트 추출 (p 태그 위주로 수집)
                paragraphs = soup.find_all('p')
                text = ' '.join([p.get_text() for p in paragraphs])
                
                # 토큰 제한을 방지하기 위해 각 기사당 상위 1000자로 자르기
                text = text.strip()[:1000]
                
                if text:
                    results.append({
                        'title': title,
                        'url': url,
                        'content': text
                    })
            except Exception as e:
                print(f"크롤링 실패 ({url}): {e}")
                
    except Exception as e:
        print(f"검색 중 오류 발생: {e}")
        
    return results

def generate_newsletter_with_gemini(topic: str, articles: list) -> str:
    print("Gemini API로 뉴스레터 생성 중...")
    
    # 환경변수에서 GEMINI_API_KEY를 자동으로 읽어옵니다.
    client = genai.Client()
    
    context = f"주제: {topic}\n\n[수집된 기사 정보]\n"
    for i, article in enumerate(articles):
        context += f"{i+1}. 제목: {article['title']}\nURL: {article['url']}\n내용 요약: {article['content']}...\n\n"
        
    prompt = f"""너는 10년 차 베테랑 뉴스레터 에디터야. 수집된 아래 기사 정보들을 바탕으로 읽기 쉽고 흥미로운 뉴스레터를 작성해 줘. 
- 서론: 주제에 대한 최근 동향과 인사말
- 본론: 각 기사를 헤드라인과 요약 내용으로 정리 (중요한 부분은 <strong> 태그 사용)
- 결론: 요약 및 마무리 인사
- 제약조건: 결과는 오직 Tiptap 에디터에서 즉시 사용 가능한 HTML 태그(<h1>, <h2>, <p>, <ul>, <li>, <strong>, <br>, <a>)로만 구성해 줘. 마크다운 기호(```html 등)는 절대 포함하지 마.

{context}"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        html_result = response.text
        
        # 혹시라도 마크다운 코드 블록이 포함되어 있다면 제거
        if html_result.startswith("```html"):
            html_result = html_result.replace("```html", "", 1)
        if html_result.endswith("```"):
            html_result = html_result[:html_result.rfind("```")]
            
        return html_result.strip()
    except Exception as e:
        print(f"Gemini API 호출 중 오류 발생: {e}")
        return f"<p>뉴스레터 생성에 실패했습니다. 오류: {e}</p>"

@app.post("/api/generate")
async def generate_newsletter(request: GenerateRequest):
    # 1. 크롤링 진행
    articles = crawl_articles(request.topic, request.article_count)
    
    if not articles:
        return {"html": "<p>검색된 기사가 없어 뉴스레터를 생성할 수 없습니다. 다른 주제로 시도해주세요.</p>"}
        
    # 2. Gemini AI를 활용한 뉴스레터 생성
    html_content = generate_newsletter_with_gemini(request.topic, articles)
    
    print("뉴스레터 생성 완료!")
    
    return {"html": html_content}

@app.post("/api/edit")
async def edit_text(request: EditRequest):
    print(f"텍스트 수정 요청: {request.instruction}")
    
    client = genai.Client()
    
    prompt = f"""원본 텍스트: [{request.selected_text}], 요청사항: [{request.instruction}]. 이 요청에 맞게 원본 텍스트를 수정해 줘. 다른 인사말이나 부연 설명 없이 오직 수정된 텍스트 결과물(필요시 HTML 태그 포함)만 반환해."""
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        result = response.text.strip()
        
        # 혹시라도 마크다운 코드 블록이 포함되어 있다면 제거
        if result.startswith("```html"):
            result = result[7:]
        if result.startswith("```"):
            result = result[3:]
        if result.endswith("```"):
            result = result[:-3]
            
        return {"edited_text": result.strip()}
    except Exception as e:
        print(f"Gemini API 오류: {e}")
        return {"error": "수정 중 오류가 발생했습니다.", "edited_text": ""}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)