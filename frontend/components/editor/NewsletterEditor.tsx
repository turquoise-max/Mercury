"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered } from 'lucide-react';
import { useEffect, forwardRef, useImperativeHandle } from 'react';

interface NewsletterEditorProps {
  content: string;
}

export interface NewsletterEditorRef {
  getSelectedText: () => string;
  replaceSelectedText: (newText: string) => void;
  getSelectionRange: () => { from: number; to: number } | null;
  setHighlightAtRange: (from: number, to: number) => void;
  removeHighlightAtRange: (from: number, to: number) => void;
  replaceTextAtRange: (from: number, to: number, newText: string) => void;
}

export const NewsletterEditor = forwardRef<NewsletterEditorRef, NewsletterEditorProps>(({ content }, ref) => {
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

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex flex-wrap gap-2 p-2 border-b bg-muted/20">
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
      </div>
      <div className="flex-1 overflow-auto p-4 cursor-text" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  );
});
