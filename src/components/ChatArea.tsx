import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Send, ArrowUp } from "lucide-react";
import NexLogo from "./NexLogo";
import type { Conversation, Message } from "../lib/supabase";
import { pickSuggestions } from "../lib/suggestions";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isTyping: boolean;
  streamingContent: string;
  onSend: (content: string) => void;
  onStop: () => void;
  firstName: string;
}

export default function ChatArea({
  conversation,
  messages,
  isLoading,
  isTyping,
  streamingContent,
  onSend,
  onStop,
  firstName,
}: ChatAreaProps) {
  const [input, setInput] = useState("");

  // Random suggestions
  const [suggestions] = useState(() => pickSuggestions(4, firstName));

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isTyping ? "auto" : "smooth",
    });
  }, [messages, isTyping, streamingContent]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  // Send message
  const handleSend = () => {
    const trimmed = input.trim();

    if (!trimmed) return;

    setInput("");
    onSend(trimmed);
  };

  // Enter to send
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0f0f12] overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-4 scrollbar-thin">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center">
            <NexLogo
              size={64}
              className="shadow-2xl shadow-cyan-500/30 mb-5"
              strokeWidth={2}
            />

            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              {firstName ? `Hey ${firstName}, I'm NeX` : "Hi, I'm NeX"}
            </h1>

            <p className="text-white/40 text-[15px] leading-relaxed mb-8">
              Your intelligent AI assistant. Ask me anything — from coding help
              to creative writing and analysis.
            </p>

            {/* Suggestions */}
            <div className="grid grid-cols-1 gap-2 w-full">
              {suggestions.map((s, index) => (
                <button
                  key={`${index}-${s}`}
                  onClick={() => {
                    setInput(s);
                    textareaRef.current?.focus();
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] text-white/50 hover:text-white/80 text-[13px] text-left transition-all duration-150 group"
                >
                  <ArrowUp
                    size={13}
                    className="shrink-0 rotate-45 text-white/20 group-hover:text-cyan-400/60 transition-colors"
                  />

                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Chat Messages */}
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}

                {/* Streaming Response */}
                {isTyping && streamingContent && (
                  <MessageBubble
                    message={{
                      id: "streaming",
                      conversation_id: "",
                      role: "assistant",
                      content: streamingContent,
                      created_at: new Date().toISOString(),
                    }}
                  />
                )}

                {/* Typing Indicator */}
                {isTyping && !streamingContent && <TypingIndicator />}
              </>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-3">
        <div className="max-w-2xl mx-auto">
          {conversation && (
            <p className="text-[11px] text-white/20 text-center mb-3 truncate">
              {conversation.title}
            </p>
          )}

          <div className="relative bg-[#1a1a1f] border border-white/[0.08] rounded-2xl shadow-xl hover:border-blue/[0.14] focus-within:border-cyan-500/40 focus-within:shadow-cyan-500/5 transition-all duration-200">
            {/* TEXTAREA */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message NeX..."
              rows={1}
              className="w-full bg-transparent text-white/85 placeholder-white/20 text-[14px] resize-none px-4 py-3.5 pr-14 outline-none leading-relaxed max-h-[200px] overflow-y-auto"
            />

            {/* SEND / STOP BUTTON */}
            <button
              onClick={isTyping ? onStop : handleSend}
              disabled={!input.trim() && !isTyping}
              className={`absolute right-3 bottom-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
                input.trim() || isTyping
                  ? "bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105"
                  : "bg-white/[0.06] text-white/20 cursor-not-allowed"
              }`}
            >
              {isTyping ? (
                <span className="text-sm font-bold">■</span>
              ) : (
                <Send size={14} strokeWidth={2} />
              )}
            </button>
          </div>

          <p className="text-[11px] text-white/15 text-center mt-2.5">
            Press Enter to send, Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
