import { useEffect, useRef } from 'react';
import type { Message } from '../lib/supabase';
import NexLogo from './NexLogo';

interface MessageBubbleProps {
  message: Message;
}

function parseMarkdown(text: string): string {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="code-block"><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`
    )
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="md-ul">$1</ul>')
    .replace(/\n\n/g, '</p><p class="md-p">')
    .replace(/^(.+)$/gm, (line) => {
      if (line.startsWith('<')) return line;
      return line;
    });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUser && contentRef.current) {
      contentRef.current.innerHTML = parseMarkdown(message.content);
    }
  }, [message.content, isUser]);

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[75%]">
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 text-white/90 rounded-2xl rounded-tr-sm px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-6">
      <div className="shrink-0 mt-0.5">
        <NexLogo size={28} className="shadow-md shadow-cyan-500/20" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-semibold text-cyan-400/80 uppercase tracking-widest mb-1.5 block">Nex</span>
        <div
          ref={contentRef}
          className="nex-response text-white/85 text-[14px] leading-[1.75]"
        />
      </div>
    </div>
  );
}
