"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Undo2, 
  Redo2, 
  Check, 
  Sigma, 
  Download, 
  Copy,
  Palette
} from 'lucide-react';
import { useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NewsletterEditorProps {
  content: string;
  onSelectionChange?: (selectedText: string) => void;
}

export interface NewsletterEditorRef {
  getSelectedText: () => string;
  replaceSelectedText: (newText: string) => void;
  getSelectionRange: () => { from: number; to: number } | null;
  setHighlightAtRange: (from: number, to: number) => void;
  removeHighlightAtRange: (from: number, to: number) => void;
  replaceTextAtRange: (from: number, to: number, newText: string) => void;
}

export const NewsletterEditor = forwardRef<NewsletterEditorRef, NewsletterEditorProps>(({ content, onSelectionChange }, ref) => {
  const [selectedTheme, setSelectedTheme] = useState<'minimal' | 'warm' | 'dark'>('minimal');
  const [textStyle, setTextStyle] = useState<string>('p');

  const themes = {
    minimal: {
      name: '🤍 미니멀 베이직',
      desc: '깨끗한 흰색 배경, 기본 폰트',
      style: { backgroundColor: '#ffffff', color: '#333333', fontFamily: 'sans-serif' },
      css: `body { font-family: sans-serif; line-height: 1.6; color: #333333; background-color: #ffffff; max-width: 800px; margin: 0 auto; padding: 20px; } h1, h2 { color: #111111; } blockquote { border-left: 4px solid #dddddd; padding-left: 1rem; color: #666666; } p { margin-bottom: 1.25em; line-height: 1.6; } a { color: #0066cc; text-decoration: none; }`
    },
    warm: {
      name: '☕ 따뜻한 감성',
      desc: '옅은 베이지색 배경, 세리프 폰트',
      style: { backgroundColor: '#faf8f5', color: '#4a3f35', fontFamily: 'serif' },
      css: `body { font-family: 'Times New Roman', serif; line-height: 1.7; color: #4a3f35; background-color: #faf8f5; max-width: 800px; margin: 0 auto; padding: 20px; } h1, h2 { color: #2d241c; } blockquote { border-left: 4px solid #d3c4b7; padding-left: 1rem; color: #7a6b5d; font-style: italic; } p { margin-bottom: 1.25em; line-height: 1.7; } a { color: #a67c52; text-decoration: underline; }`
    },
    dark: {
      name: '🌙 모던 다크',
      desc: '어두운 배경, 밝은 텍스트',
      style: { backgroundColor: '#1a1a1a', color: '#e0e0e0', fontFamily: 'sans-serif' },
      css: `body { font-family: sans-serif; line-height: 1.6; color: #e0e0e0; background-color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; } h1, h2 { color: #ffffff; } blockquote { border-left: 4px solid #444444; padding-left: 1rem; color: #aaaaaa; } p { margin-bottom: 1.25em; line-height: 1.6; } a { color: #66b3ff; text-decoration: none; }`
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none w-full max-w-none',
      },
    },
    onTransaction: ({ editor }) => {
      if (editor.isActive('heading', { level: 1 })) setTextStyle('h1');
      else if (editor.isActive('heading', { level: 2 })) setTextStyle('h2');
      else if (editor.isActive('heading', { level: 3 })) setTextStyle('h3');
      else setTextStyle('p');
    },
    onSelectionUpdate: ({ editor }) => {
      if (editor.isActive('heading', { level: 1 })) setTextStyle('h1');
      else if (editor.isActive('heading', { level: 2 })) setTextStyle('h2');
      else if (editor.isActive('heading', { level: 3 })) setTextStyle('h3');
      else setTextStyle('p');

      if (onSelectionChange) {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");
        onSelectionChange(text.trim());
      }
    },
    onBlur: ({ editor }) => {
      // Blur 시에도 선택 영역이 풀리면 업데이트
      if (onSelectionChange) {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");
        onSelectionChange(text.trim());
      }
    }
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  useImperativeHandle(ref, () => ({
    getSelectedText: () => {
      if (!editor) return "";
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, " ");
    },
    replaceSelectedText: (newText: string) => {
      if (!editor) return;
      editor.commands.insertContent(newText);
    },
    getSelectionRange: () => {
      if (!editor) return null;
      const { from, to } = editor.state.selection;
      if (from === to) return null; // No selection
      return { from, to };
    },
    setHighlightAtRange: (from: number, to: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).setHighlight({ color: '#ffcc00' }).run();
    },
    removeHighlightAtRange: (from: number, to: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).unsetHighlight().run();
    },
    replaceTextAtRange: (from: number, to: number, newText: string) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).insertContent(newText).run();
    }
  }));

  const getFullHtml = () => {
    if (!editor) return "";
    const editorContent = editor.getHTML();
    const themeCss = themes[selectedTheme].css;
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 뉴스레터</title>
  <style>
    ${themeCss}
  </style>
</head>
<body>
  ${editorContent}
</body>
</html>`;
  };

  const handleCopyHtml = () => {
    const html = getFullHtml();
    if (!html) return;
    navigator.clipboard.writeText(html).then(() => {
      alert("클립보드에 HTML이 복사되었습니다.");
    });
  };

  const handleDownload = () => {
    const html = getFullHtml();
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newsletter.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col w-full h-full bg-white relative">
      <div className="flex px-3 border-b border-slate-100 bg-white/90 backdrop-blur-sm sticky top-0 z-20 items-center justify-between shadow-sm h-[52px]">
        {/* Left Group */}
        <div className="flex items-center gap-0.5 h-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center h-9 w-9 text-emerald-500/80">
                <Check className="w-[18px] h-[18px]" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              자동 저장됨
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="h-9 w-9 p-0 rounded-md hover:bg-slate-100 transition-colors inline-flex items-center justify-center"
              >
                <Undo2 className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              실행 취소 (Undo)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="h-9 w-9 p-0 rounded-md hover:bg-slate-100 transition-colors inline-flex items-center justify-center"
              >
                <Redo2 className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              다시 실행 (Redo)
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="w-px h-7 bg-slate-200 mx-3" />

        {/* Center Group */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center">
            <Select
              value={textStyle}
              onValueChange={(value) => {
                if (value === 'p') editor.chain().focus().setParagraph().run();
                else if (value === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                else if (value === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                else if (value === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
              }}
            >
              <SelectTrigger className="w-[120px] h-9 border-none bg-transparent hover:bg-slate-100 focus:ring-0 text-sm font-medium">
                <SelectValue placeholder="스타일" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p">일반 텍스트</SelectItem>
                <SelectItem value="h1">제목 1</SelectItem>
                <SelectItem value="h2">제목 2</SelectItem>
                <SelectItem value="h3">제목 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('bold') ? 'bg-slate-200 text-primary font-bold' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <Bold className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                굵게
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('italic') ? 'bg-slate-200 text-primary italic' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <Italic className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                기울임꼴
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('bulletList') ? 'bg-slate-200 text-primary' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <List className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                글머리 기호 목록
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('orderedList') ? 'bg-slate-200 text-primary' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <ListOrdered className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                번호 매기기 목록
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center h-9 w-9 text-slate-400">
                  <Sigma className="w-[18px] h-[18px]" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                수식 삽입 (준비 중)
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="w-px h-7 bg-slate-200 mx-3" />

        {/* Right Group */}
        <div className="flex items-center gap-1">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 text-slate-600 font-medium">
                <Palette className="w-4 h-4" />
                디자인 및 내보내기
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] w-[1400px] h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
              <DialogHeader className="px-6 py-4 border-b shrink-0">
                <DialogTitle>디자인 및 내보내기</DialogTitle>
              </DialogHeader>
              <div className="flex flex-1 overflow-hidden">
                {/* 좌측 패널: 테마 선택 */}
                <div className="w-1/3 border-r bg-slate-50/50 p-6 flex flex-col gap-4 overflow-y-auto">
                  <h3 className="font-semibold text-sm text-slate-500 mb-2">테마 선택</h3>
                  {(Object.entries(themes) as [keyof typeof themes, typeof themes['minimal']][]).map(([key, theme]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedTheme(key)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${selectedTheme === key ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div className="font-semibold text-slate-900 mb-1">{theme.name}</div>
                      <div className="text-xs text-slate-500">{theme.desc}</div>
                    </button>
                  ))}
                </div>
                {/* 우측 패널: 미리보기 & 내보내기 */}
                <div className="w-2/3 flex flex-col bg-slate-100">
                  <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
                    <span className="text-sm font-medium text-slate-500">실시간 미리보기</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={handleCopyHtml} className="h-8 gap-1.5">
                        <Copy className="w-3.5 h-3.5" />
                        HTML 복사
                      </Button>
                      <Button size="sm" onClick={handleDownload} className="h-8 gap-1.5">
                        <Download className="w-3.5 h-3.5" />
                        HTML 다운로드
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-8 flex justify-center">
                    <div 
                      className="w-full max-w-[800px] shadow-sm rounded-lg min-h-full"
                      style={{
                        backgroundColor: themes[selectedTheme].style.backgroundColor,
                        color: themes[selectedTheme].style.color,
                        fontFamily: themes[selectedTheme].style.fontFamily,
                        padding: '40px',
                      }}
                      dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="min-h-full px-12 py-10 cursor-text" onClick={() => editor.chain().focus().run()}>
          <EditorContent editor={editor} className="mx-auto max-w-[700px]" />
        </div>
      </ScrollArea>
    </div>
  );
});