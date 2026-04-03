"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
// 터미널에서 npm install @tiptap/extension-image 를 실행하여 패키지를 설치해주세요.
import Image from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Undo2, 
  Redo2, 
  Check, 
  Download, 
  Copy,
  Palette,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';
import { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';
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
  const [selectedTheme, setSelectedTheme] = useState<string>('theme-default');
  const [textStyle, setTextStyle] = useState<string>('p');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 5MB 용량 체크
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 용량은 5MB를 초과할 수 없습니다. 브라우저 성능을 위해 작은 이미지를 사용해주세요.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (editor && typeof reader.result === 'string') {
        editor.chain().focus().setImage({ src: reader.result }).run();
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const themes = {
    'theme-default': {
      name: '기본 테마',
      desc: '기본적인 깔끔한 스타일',
      style: { backgroundColor: '#ffffff', color: '#333333', fontFamily: 'sans-serif' },
    },
    'theme-soft': {
      name: '소프트 테마',
      desc: '최신 SaaS 블로그처럼 부드럽고 친근한 라운드 스타일',
      style: { backgroundColor: '#f8fafc', color: '#334155', fontFamily: 'sans-serif' },
    },
    'theme-pro': {
      name: '프로페셔널 테마',
      desc: '고급 비즈니스/VC 뉴스레터처럼 정갈하고 신뢰감 있는 스타일',
      style: { backgroundColor: '#ffffff', color: '#0f172a', fontFamily: 'sans-serif' },
    },
    'theme-neopop': {
      name: '네오 팝',
      desc: '발랄하고 톡톡 튀는 트렌디한 스타일',
      style: { backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif' },
    },
    'theme-editorial': {
      name: '에디토리얼',
      desc: '고급스러운 잡지/신문 스타일',
      style: { backgroundColor: '#fdfbf7', color: '#2c2c2c', fontFamily: 'serif' },
    },
    'theme-midnight': {
      name: '미드나잇 다크',
      desc: '세련된 다크 모드',
      style: { backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'sans-serif' },
    },
    'theme-eco': {
      name: '에코 네이처',
      desc: '편안하고 자연 친화적인 스타일',
      style: { backgroundColor: '#f8faf6', color: '#3f6212', fontFamily: 'sans-serif' },
    },
    'theme-cyberpunk': {
      name: '사이버펑크',
      desc: '해커/개발자 감성의 힙한 스타일',
      style: { backgroundColor: '#121212', color: '#00ff00', fontFamily: 'monospace' },
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image.configure({ inline: true }),
    ],
    content: content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base m-5 focus:outline-none w-full max-w-none',
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
    
    // 테마별 CSS 추가
    let themeCss = '';
    if (selectedTheme === 'theme-soft') {
      themeCss = `
        .prose h2 { background-color: #e0e7ff; color: #1e3a8a; padding: 8px 20px; border-radius: 9999px; display: inline-block; font-weight: bold; }
        .prose blockquote { background-color: #ffffff; color: #334155; border: none; padding: 16px 20px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); font-style: normal; }
        .prose hr { border: 0; border-top: 3px dotted #e2e8f0; margin: 32px 0; }
      `;
    } else if (selectedTheme === 'theme-pro') {
      themeCss = `
        .prose h2 { color: #0f172a; letter-spacing: 0.05em; border-bottom: 3px double #0f172a; padding-bottom: 8px; margin-bottom: 16px; font-weight: bold; }
        .prose h3 { color: #0f172a; border-left: 3px solid #0f172a; padding-left: 12px; font-weight: 600; }
        .prose blockquote { background-color: #f1f5f9; border-left: 4px solid #0f172a; padding: 16px 20px; color: #475569; font-style: italic; }
        .prose hr { border: 0; border-top: 1px solid #cbd5e1; margin: 32px 0; }
      `;
    } else if (selectedTheme === 'theme-neopop') {
      themeCss = `
        .prose h1 { border: 4px solid #000; background-color: #ff00ff; color: #fff; padding: 10px 16px; box-shadow: 4px 4px 0px #000; font-weight: 900; }
        .prose h2 { border: 3px solid #000; background-color: #ffff00; color: #000; padding: 8px 16px; box-shadow: 3px 3px 0px #000; font-weight: 800; }
        .prose h3 { color: #000; text-decoration: underline; text-decoration-thickness: 4px; text-decoration-color: #00ffff; font-weight: bold; }
        .prose blockquote { border: 2px solid #000; background-color: #00ffff; color: #000; padding: 16px; font-weight: bold; box-shadow: 4px 4px 0px #000; font-style: normal; }
        .prose hr { border: 2px solid #000; margin: 32px 0; }
        .prose a { color: #ff0000; font-weight: bold; text-decoration: none; border-bottom: 2px solid #000; }
      `;
    } else if (selectedTheme === 'theme-editorial') {
      themeCss = `
        .prose h1 { font-family: serif; font-size: 2.5em; text-align: center; border-bottom: 1px solid #1a1a1a; padding-bottom: 12px; color: #1a1a1a; font-weight: normal; }
        .prose h2 { font-family: serif; text-align: center; border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a; padding: 12px 0; color: #2c2c2c; font-weight: normal; }
        .prose h3 { font-family: serif; color: #3a3a3a; font-style: italic; font-weight: normal; }
        .prose blockquote { border-left: 1px solid #333; padding-left: 24px; font-style: italic; color: #4a4a4a; font-family: serif; font-size: 1.1em; background: transparent; }
        .prose hr { border: 0; border-top: 1px solid #ccc; margin: 32px 0; }
        .prose a { color: #1a1a1a; text-decoration: underline; text-underline-offset: 4px; }
      `;
    } else if (selectedTheme === 'theme-midnight') {
      themeCss = `
        .prose h1 { color: #fff; border-bottom: 2px solid #38bdf8; padding-bottom: 12px; font-weight: 800; }
        .prose h2 { color: #f1f5f9; border-left: 4px solid #f472b6; padding-left: 16px; font-weight: 700; }
        .prose h3 { color: #cbd5e1; text-decoration: underline; text-decoration-color: #38bdf8; text-underline-offset: 4px; }
        .prose blockquote { background-color: #1e293b; border-left: 4px solid #38bdf8; padding: 16px 20px; color: #94a3b8; font-style: italic; }
        .prose hr { border: 0; border-top: 1px solid #334155; margin: 32px 0; }
        .prose a { color: #38bdf8; text-decoration: none; border-bottom: 1px dashed #38bdf8; }
      `;
    } else if (selectedTheme === 'theme-eco') {
      themeCss = `
        .prose h1 { color: #14532d; border-bottom: 2px solid #86efac; padding-bottom: 12px; font-weight: 800; }
        .prose h2 { color: #166534; background-color: #dcfce7; padding: 10px 16px; border-radius: 12px; font-weight: 700; }
        .prose h3 { color: #15803d; font-weight: 600; }
        .prose blockquote { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 20px; color: #166534; font-style: italic; }
        .prose hr { border: 0; border-top: 2px dashed #bbf7d0; margin: 32px 0; }
        .prose a { color: #16a34a; text-decoration: underline; text-decoration-color: #86efac; text-underline-offset: 4px; }
      `;
    } else if (selectedTheme === 'theme-cyberpunk') {
      themeCss = `
        .prose h1 { color: #ff00ff; text-transform: uppercase; border-bottom: 2px dashed #ff00ff; padding-bottom: 12px; font-weight: 900; }
        .prose h2 { color: #00ffff; border-left: 4px solid #00ffff; padding-left: 16px; background-color: rgba(26, 26, 26, 0.8); font-weight: 800; }
        .prose h3 { color: #ffff00; font-weight: 700; }
        .prose blockquote { background-color: #000; border: 1px solid #00ff00; color: #00ff00; padding: 16px 20px; border-left: 4px solid #ff00ff; font-style: normal; }
        .prose hr { border: 0; border-top: 1px dashed #00ff00; margin: 32px 0; }
        .prose a { color: #ffff00; text-decoration: none; border-bottom: 1px solid #ffff00; }
      `;
    }

    const currentTheme = themes[selectedTheme as keyof typeof themes] || themes['theme-default'];

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 뉴스레터</title>
  <style>
    body { 
      font-family: ${currentTheme.style.fontFamily}, sans-serif; 
      line-height: 1.6; 
      color: ${currentTheme.style.color}; 
      background-color: ${currentTheme.style.backgroundColor};
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px; 
    }
    img { max-width: 100%; height: auto; }
    .prose { max-width: none; }
    ${themeCss}
  </style>
</head>
<body>
  <div class="prose ${selectedTheme}">
    ${editorContent}
  </div>
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

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL을 입력하세요', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col w-full h-full bg-white relative">
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleImageUpload}
        className="hidden"
      />
      <div className="flex px-3 border-b border-slate-100 bg-white/90 backdrop-blur-sm sticky top-0 z-20 items-center justify-between shadow-sm h-[52px] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center justify-between w-full min-w-[650px] gap-2">
          {/* Left Group */}
          <div className="flex items-center gap-0.5 h-full shrink-0">
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

        <div className="w-px h-7 bg-slate-200 mx-3 shrink-0" />

        {/* Center Group */}
        <div className="flex items-center gap-3 flex-1 min-w-max">
          <div className="flex items-center gap-2">
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
                  onClick={setLink}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('link') ? 'bg-slate-200 text-primary' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <LinkIcon className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                링크
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600 transition-all"
                >
                  <ImageIcon className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                이미지 삽입
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
          </div>
        </div>

        <div className="w-px h-7 bg-slate-200 mx-3 shrink-0" />

        {/* Right Group */}
        <div className="flex items-center gap-1 shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 text-slate-600 font-medium">
                <Palette className="w-4 h-4" />
                내보내기
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1400px] max-w-[90vw] w-[1400px] h-[85vh] flex flex-col gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
              <DialogHeader className="px-6 py-4 border-b shrink-0">
                <DialogTitle>디자인 및 내보내기</DialogTitle>
              </DialogHeader>
              <div className="flex flex-1 overflow-hidden">
                {/* 좌측 패널: 테마 선택 */}
                <div className="w-1/3 border-r bg-slate-50/50 p-6 flex flex-col gap-4 overflow-y-auto">
                  <h3 className="font-semibold text-sm text-slate-500 mb-2">테마 선택</h3>
                  {(Object.entries(themes) as [keyof typeof themes, typeof themes['theme-default']][]).map(([key, theme]) => (
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
                  <div className="flex-1 overflow-auto p-8">
                    <div 
                      className={`w-full max-w-[800px] mx-auto shadow-sm rounded-lg h-fit ${selectedTheme}`}
                      style={{
                        backgroundColor: themes[selectedTheme as keyof typeof themes]?.style.backgroundColor || '#ffffff',
                        color: themes[selectedTheme as keyof typeof themes]?.style.color || '#333333',
                        fontFamily: themes[selectedTheme as keyof typeof themes]?.style.fontFamily || 'sans-serif',
                        padding: '40px',
                      }}
                      dangerouslySetInnerHTML={{ __html: `<div class="prose max-w-none ${selectedTheme}">${editor.getHTML()}</div>` }}
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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