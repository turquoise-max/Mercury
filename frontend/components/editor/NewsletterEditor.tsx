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
  Copy 
} from 'lucide-react';
import { useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    onSelectionUpdate: ({ editor }) => {
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

  const handleCopyHtml = () => {
    if (!editor) return;
    const html = editor.getHTML();
    navigator.clipboard.writeText(html).then(() => {
      alert("클립보드에 HTML이 복사되었습니다.");
    });
  };

  const handleDownload = () => {
    if (!editor) return;
    const editorContent = editor.getHTML();
    const htmlTemplate = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 뉴스레터</title>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2 { color: #111; }
    blockquote { border-left: 4px solid #ddd; padding-left: 1rem; color: #666; }
    p { margin-bottom: 1.25em; line-height: 1.6; }
  </style>
</head>
<body>
  ${editorContent}
</body>
</html>`;

    const blob = new Blob([htmlTemplate], { type: 'text/html' });
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

  const getTextStyle = () => {
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    return 'p';
  };

  return (
    <div className="flex flex-col w-full h-full bg-white relative">
      <div className="flex py-1.5 px-3 border-b border-slate-100 bg-white/90 backdrop-blur-sm sticky top-0 z-20 items-center justify-between shadow-sm min-h-[52px]">
        {/* Left Group */}
        <div className="flex items-center gap-0.5">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <Select 
                  value={getTextStyle()} 
                  onValueChange={(value) => {
                    if (value === 'p') editor.chain().focus().setParagraph().run();
                    else if (value === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                    else if (value === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                  }}
                >
                  <SelectTrigger className="w-[120px] h-9 border-none bg-transparent hover:bg-slate-100 focus:ring-0 text-sm font-medium">
                    <SelectValue placeholder="스타일" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p">일반 텍스트</SelectItem>
                    <SelectItem value="h1">제목 1</SelectItem>
                    <SelectItem value="h2">제목 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              텍스트 스타일
            </TooltipContent>
          </Tooltip>

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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600"
              >
                <Download className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              HTML 다운로드
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyHtml}
                className="h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600"
              >
                <Copy className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              HTML 복사
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-12 py-10 cursor-text scroll-smooth" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} className="min-h-full mx-auto max-w-[700px]" />
      </div>
    </div>
  );
});