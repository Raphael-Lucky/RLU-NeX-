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
        Math.min(textareaRef.current.scrollHeight, 180) + "px";
    }
  }, [input]);

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
    <div className="flex-1 flex flex-col h-screen bg-[#0f0f12] overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 pt-6 sm:pt-8 pb-4 scrollbar-thin">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center">
            <NexLogo
              size={56}
              className="shadow-2xl shadow-cyan-500/30 mb-5 sm:size-[64px]"
              strokeWidth={2}
            />

            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight px-2">
              {firstName ? `Hey ${firstName}, I'm NeX` : "Hi, I'm NeX"}
            </h1>

            <p className="text-white/40 text-sm sm:text-[15px] leading-relaxed mb-6 sm:mb-8 px-4">
              Your intelligent AI assistant. Ask me anything — from coding help
              to creative writing and analysis.
            </p>

            {/* Suggestions */}
            <div className="grid grid-cols-1 gap-2 w-full px-2">
              {suggestions.map((s, index) => (
                <button
                  key={`${index}-${s}`}
                  onClick={() => {
                    setInput(s);
                    textareaRef.current?.focus();
                  }}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] text-white/50 hover:text-white/80 text-[13px] text-left transition-all duration-150 group"
                >
                  <ArrowUp
                    size={13}
                    className="shrink-0 mt-1 rotate-45 text-white/20 group-hover:text-cyan-400/60 transition-colors"
                  />

                  <span className="leading-relaxed">{s}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto w-full">
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
      <div className="px-3 sm:px-6 pb-4 sm:pb-6 pt-2 sm:pt-3 bg-[#0f0f12]">
        <div className="max-w-2xl mx-auto">
          {conversation && (
            <p className="text-[10px] sm:text-[11px] text-white/20 text-center mb-3 truncate px-3">
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
              className="w-full bg-transparent text-white/85 placeholder-white/20 text-[14px] sm:text-[15px] resize-none px-4 py-3 pr-14 outline-none leading-relaxed max-h-[180px] overflow-y-auto"
            />

            {/* SEND / STOP BUTTON */}
            <button
              onClick={isTyping ? onStop : handleSend}
              disabled={!input.trim() && !isTyping}
              className={`absolute right-2.5 bottom-2.5 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 ${
                input.trim() || isTyping
                  ? "bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 active:scale-95"
                  : "bg-white/[0.06] text-white/20 cursor-not-allowed"
              }`}
            >
              {isTyping ? (
                <span className="text-sm font-bold">■</span>
              ) : (
                <Send size={15} strokeWidth={2} />
              )}
            </button>
          </div>

          <p className="text-[10px] sm:text-[11px] text-white/15 text-center mt-2.5 px-2">
            Press Enter to send, Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}