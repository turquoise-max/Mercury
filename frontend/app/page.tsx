"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useRef, useEffect } from "react";
import { NewsletterEditor, NewsletterEditorRef } from "@/components/editor/NewsletterEditor";
import { Loader2, RefreshCw } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  type?: "text" | "suggestion";
  suggestion?: {
    text: string;
    range: { from: number; to: number };
    status: "pending" | "accepted" | "rejected";
  };
}

interface Article {
  title: string;
  url: string;
  content: string;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [articleCount, setArticleCount] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Article[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editorContent, setEditorContent] = useState("<p>이곳에 AI가 작성한 뉴스레터 초안이 표시됩니다.</p>");
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: "init-msg", role: "assistant", content: "안녕하세요! 뉴스레터 생성을 도와드릴 AI 어시스턴트입니다. 어떤 주제로 뉴스레터를 작성해 드릴까요?" }
  ]);
  const [editInstruction, setEditInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTextContext, setSelectedTextContext] = useState("");
  const editorRef = useRef<NewsletterEditorRef>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const savedData = localStorage.getItem('newsletter-current-work');
    if (savedData) {
      if (window.confirm("이전에 작업하던 내용이 있습니다. 복구하시겠습니까?")) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.topic !== undefined) setTopic(parsed.topic);
          if (parsed.articleCount !== undefined) setArticleCount(parsed.articleCount);
          if (parsed.searchResults !== undefined) setSearchResults(parsed.searchResults);
          if (parsed.selectedArticles !== undefined) setSelectedArticles(parsed.selectedArticles);
          if (parsed.editorContent !== undefined) setEditorContent(parsed.editorContent);
          if (parsed.chatHistory !== undefined) setChatHistory(parsed.chatHistory);
        } catch (e) {
          console.error("Failed to parse saved data", e);
        }
      } else {
        localStorage.removeItem('newsletter-current-work');
      }
    }
    setIsInitialLoad(false);
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  useEffect(() => {
    if (isInitialLoad) return;

    const timer = setTimeout(() => {
      const saveData = {
        topic,
        articleCount,
        searchResults,
        selectedArticles,
        editorContent,
        chatHistory
      };
      localStorage.setItem('newsletter-current-work', JSON.stringify(saveData));
      
      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => clearTimeout(timer);
  }, [topic, articleCount, editorContent, chatHistory, isInitialLoad]);

  const handleReset = () => {
    if (window.confirm("모든 작업 내용이 삭제됩니다. 새 작업을 시작하시겠습니까?")) {
      setTopic("");
      setArticleCount(5);
      setSearchResults([]);
      setSelectedArticles([]);
      setEditorContent("<p>이곳에 AI가 작성한 뉴스레터 초안이 표시됩니다.</p>");
      setChatHistory([{ id: "init-msg", role: "assistant", content: "안녕하세요! 뉴스레터 생성을 도와드릴 AI 어시스턴트입니다. 어떤 주제로 뉴스레터를 작성해 드릴까요?" }]);
      setLastSavedTime(null);
      localStorage.removeItem('newsletter-current-work');
    }
  };

  const handleSearch = async () => {
    if (!topic.trim()) {
      alert("검색할 주제를 입력해주세요.");
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch("http://localhost:8000/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          article_count: articleCount,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to search articles");
      }

      const data = await response.json();
      setSearchResults(data.articles);
      setSelectedArticles([]);
    } catch (error) {
      console.error("Error searching articles:", error);
      alert("기사 검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const toggleArticleSelection = (article: Article) => {
    setSelectedArticles(prev => {
      const isSelected = prev.some(a => a.url === article.url);
      if (isSelected) {
        return prev.filter(a => a.url !== article.url);
      } else {
        return [...prev, article];
      }
    });
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert("뉴스레터 주제를 입력해주세요.");
      return;
    }

    if (selectedArticles.length === 0) {
      alert("뉴스레터에 포함할 기사를 선택해주세요.");
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch("http://localhost:8000/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          articles: selectedArticles,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate newsletter");
      }

      const data = await response.json();
      setEditorContent(data.html);
    } catch (error) {
      console.error("Error generating newsletter:", error);
      alert("뉴스레터 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChatRequest = async () => {
    if (!editInstruction.trim()) return;

    const currentInstruction = editInstruction;
    setEditInstruction("");
    
    // 사용자 메시지 추가
    setChatHistory(prev => [...prev, { id: Date.now().toString(), role: "user", content: currentInstruction }]);
    setIsEditing(true);

    const range = editorRef.current?.getSelectionRange();
    const hasSelection = !!selectedTextContext && !!range;

    if (hasSelection && range) {
      // 수정 중인 영역 하이라이트 표시
      editorRef.current?.setHighlightAtRange(range.from, range.to);
    }

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selected_text: hasSelection ? selectedTextContext : null,
          instruction: currentInstruction,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process chat request");
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (hasSelection && range) {
        // AI 응답 제안 추가 (바로 교체하지 않음)
        setChatHistory(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: "assistant", 
          content: "다음과 같이 수정해 보았습니다.",
          type: "suggestion",
          suggestion: {
            text: data.reply,
            range: range,
            status: "pending"
          }
        }]);
      } else {
        // 일반 답변 추가
        setChatHistory(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.reply,
          type: "text"
        }]);
      }
    } catch (error) {
      console.error("Error processing chat request:", error);
      alert("요청 처리 중 오류가 발생했습니다.");
      // 에러 발생 시 하이라이트 제거
      if (hasSelection && range) {
        editorRef.current?.removeHighlightAtRange(range.from, range.to);
      }
    } finally {
      setIsEditing(false);
    }
  };

  const handleAccept = (msgId: string) => {
    setChatHistory(prev => prev.map(msg => {
      if (msg.id === msgId && msg.suggestion) {
        const { range, text } = msg.suggestion;
        editorRef.current?.replaceTextAtRange(range.from, range.to, text);
        return { ...msg, suggestion: { ...msg.suggestion, status: "accepted" } };
      }
      return msg;
    }));
    setChatHistory(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "✅ 에디터에 적용되었습니다." }]);
  };

  const handleReject = (msgId: string) => {
    setChatHistory(prev => prev.map(msg => {
      if (msg.id === msgId && msg.suggestion) {
        const { range } = msg.suggestion;
        editorRef.current?.removeHighlightAtRange(range.from, range.to);
        return { ...msg, suggestion: { ...msg.suggestion, status: "rejected" } };
      }
      return msg;
    }));
    setChatHistory(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "❌ 수정 제안을 거절했습니다." }]);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* 1. 좌측 패널: 크롤링 및 검색 설정 */}
      <aside className="flex flex-col w-[320px] flex-shrink-0 border-r bg-background relative z-10">
        {/* 고정 상단 영역 */}
        <div className="p-5 border-b space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold tracking-tight">기사 검색 및 선택</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleReset} title="새 작업 시작">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">뉴스레터 주제</label>
              <Input 
                placeholder="예: 인공지능 최신 동향" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-muted-foreground">검색 개수</label>
                <span className="text-xs font-mono">{articleCount}개</span>
              </div>
              <Slider 
                defaultValue={[5]} 
                max={10} 
                min={1} 
                step={1} 
                value={[articleCount]}
                onValueChange={(vals) => setArticleCount(vals[0])}
                className="py-1"
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  검색 중...
                </>
              ) : (
                "기사 검색하기"
              )}
            </Button>
          </div>
        </div>

        {/* 스크롤 가능한 검색 결과 영역 */}
        <div className="flex-1 flex flex-col min-h-0 bg-muted/10">
          <div className="px-5 py-3 flex justify-between items-center bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b sticky top-0 z-10">
            <h3 className="font-semibold text-sm">검색 결과</h3>
            {selectedArticles.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {selectedArticles.length}개 선택됨
              </span>
            )}
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3 pb-4">
              {searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    주제를 입력하고 검색해 주세요.
                  </p>
                </div>
              ) : (
                searchResults.map((article, index) => {
                  const isSelected = selectedArticles.some(a => a.url === article.url);
                  return (
                    <Card 
                      key={index} 
                      className={`overflow-hidden cursor-pointer transition-all hover:border-primary/50 ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : ''}`}
                      onClick={() => toggleArticleSelection(article)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={isSelected}
                            className="mt-0.5 pointer-events-none"
                          />
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
                              {article.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {article.url}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 하단 고정 뉴스레터 생성 버튼 (조건부 노출) */}
        {selectedArticles.length > 0 && (
          <div className="p-4 border-t bg-background shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.1)] z-20">
            <Button 
              className="w-full font-bold shadow-md" 
              size="lg" 
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                `선택한 ${selectedArticles.length}개의 기사로 생성하기`
              )}
            </Button>
          </div>
        )}
      </aside>

      {/* 2. 중앙 패널: 메인 에디터 */}
      <main className="flex-1 bg-muted/30 overflow-auto flex flex-col items-center p-8 relative">
        <div className="w-full max-w-4xl flex justify-end mb-2">
          {lastSavedTime && (
            <span className="text-xs text-muted-foreground">
              ✨ 마지막 저장: {lastSavedTime}
            </span>
          )}
        </div>
        <Card className="w-full max-w-4xl min-h-[800px] flex flex-col shadow-lg bg-white border-0 mb-8 overflow-hidden">
          <NewsletterEditor 
            ref={editorRef} 
            content={editorContent} 
            onSelectionChange={setSelectedTextContext}
          />
        </Card>
      </main>

      {/* 3. 우측 패널: AI 챗 어시스턴트 */}
      <aside className="flex flex-col w-[320px] flex-shrink-0 border-l bg-card h-full">
        <div className="flex-shrink-0 p-4 space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">AI 어시스턴트</h2>
          <div className={`p-2 rounded text-xs font-medium ${selectedTextContext ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
            {selectedTextContext ? (
              <>
                <div className="mb-1">✏️ [선택 부분 수정 모드]</div>
                <div className="line-clamp-2 italic opacity-80">"{selectedTextContext}"</div>
              </>
            ) : (
              <div>💡 [아이디에이션 모드] 뉴스레터 기획이나 아이디어를 물어보세요.</div>
            )}
          </div>
        </div>
        <Separator />
        
        <ScrollArea className="flex-1 min-h-0 p-4">
          <div className="space-y-4">
            {chatHistory.map((msg) => (
              msg.role === "assistant" ? (
                <div key={msg.id} className="flex flex-col gap-2 bg-muted p-3 rounded-lg rounded-tl-none max-w-[85%] text-sm">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.type === "suggestion" && msg.suggestion && (
                    <div className="mt-2 space-y-3">
                      <div className="bg-background p-2 rounded border text-muted-foreground whitespace-pre-wrap">
                        {msg.suggestion.text}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleAccept(msg.id)}
                          disabled={msg.suggestion.status !== "pending"}
                        >
                          적용하기
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleReject(msg.id)}
                          disabled={msg.suggestion.status !== "pending"}
                        >
                          거절
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div key={msg.id} className="flex flex-col gap-2 bg-primary text-primary-foreground p-3 rounded-lg rounded-tr-none max-w-[85%] self-end ml-auto text-sm">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              )
            ))}
            <div ref={chatScrollRef} />
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 p-4 border-t bg-background space-y-3">
          <Textarea 
            placeholder={selectedTextContext ? "수정 사항을 프롬프트로 입력하세요..." : "질문이나 아이디어를 입력하세요..."}
            className="min-h-[80px] resize-none"
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
          />
          <Button 
            className="w-full" 
            variant="secondary"
            onClick={handleChatRequest}
            disabled={isEditing || !editInstruction.trim()}
          >
            {isEditing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              "보내기"
            )}
          </Button>
        </div>
      </aside>
    </div>
  );
}