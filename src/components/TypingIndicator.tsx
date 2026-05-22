import NexLogo from './NexLogo';

export default function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-6">
      <div className="shrink-0 mt-0.5">
        <NexLogo size={28} className="shadow-md shadow-cyan-500/20" />
      </div>
      <div className="flex items-center gap-1 pt-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
