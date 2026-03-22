import { useEffect, useState } from 'react';

interface CountdownOverlayProps {
  onComplete: () => void;
}

/**
 * CountdownOverlay
 *
 * Renders 3 → 2 → 1 → GO! over 3 seconds, then calls onComplete.
 * Mounted when sessionPhase === 'countdown'; unmounts itself via onComplete.
 */
export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [count, setCount] = useState<number | 'GO!'>(3);

  useEffect(() => {
    const steps: Array<number | 'GO!'> = [3, 2, 1, 'GO!'];
    let step = 0;

    const advance = () => {
      step++;
      if (step < steps.length) {
        setCount(steps[step]);
        if (steps[step] !== 'GO!') {
          timer = setTimeout(advance, 1000);
        } else {
          // Show GO! briefly then hand off
          timer = setTimeout(onComplete, 400);
        }
      }
    };

    let timer = setTimeout(advance, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-10 rounded-xl"
      style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <span
        key={String(count)}
        className={`font-black select-none
          ${count === 'GO!'
            ? 'text-green-400 text-7xl'
            : 'text-indigo-300 text-9xl'
          }`}
        style={{
          animation: 'countPop 0.35s ease-out',
          textShadow: count === 'GO!' ? '0 0 40px #4ade80' : '0 0 40px #a5b4fc',
        }}
      >
        {count}
      </span>

      {/* Inline keyframe — no external CSS dependency */}
      <style>{`
        @keyframes countPop {
          0%   { transform: scale(1.6); opacity: 0; }
          60%  { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
