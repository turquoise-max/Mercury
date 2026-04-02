"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Copy, Download } from 'lucide-react';
import { useEffect, forwardRef, useImperativeHandle } from 'react';

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

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex flex-wrap gap-2 p-2 border-b bg-muted/20 items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
        >
          <Heading1 className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
        >
          <Heading2 className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={handleCopyHtml}>
          <Copy className="w-4 h-4 mr-2" />
          HTML 복사
        </Button>
        <Button variant="default" size="sm" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />
          HTML 다운로드
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4 cursor-text" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  );
});