import { Zap } from 'lucide-react';

interface NexLogoProps {
  size?: number;
  className?: string;
  iconClassName?: string;
  strokeWidth?: number;
}

export default function NexLogo({
  size = 28,
  className = '',
  iconClassName = '',
  strokeWidth = 2.5,
}: NexLogoProps) {
  const iconSize = Math.max(12, Math.round(size * 0.46));
  const radius =
    size >= 64 ? 'rounded-2xl' : size >= 36 ? 'rounded-xl' : 'rounded-lg';

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-500 shadow-md shadow-cyan-500/20 shrink-0 ${radius} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Zap
        size={iconSize}
        className={`text-white ${iconClassName}`}
        strokeWidth={strokeWidth}
      />
    </div>
  );
}
