import { useEffect, useState } from 'react';
import { useMidiStore } from '../stores/useMidiStore';

const STORAGE_KEY = 'piano-tutor-onboarding-v1';

interface Props {
  onComplete: () => void;
}

/**
 * Onboarding
 *
 * Full-screen first-run wizard. Shown once, then gated by localStorage.
 * Step 1 — Welcome
 * Step 2 — Connect keyboard (auto-advances on detection)
 * Step 3 — All set
 */
export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const isConnected = useMidiStore((s) => s.device.isConnected);
  const deviceName  = useMidiStore((s) => s.device.inputName);

  // Auto-advance to "connected" confirmation when keyboard is detected
  useEffect(() => {
    if (step === 2 && isConnected) setStep(3);
  }, [step, isConnected]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col items-center justify-center p-8">

      {/* Step dots */}
      <div className="flex gap-2 mb-12">
        {([1, 2, 3] as const).map((n) => (
          <div
            key={n}
            className={`w-2 h-2 rounded-full transition-colors ${
              n <= step ? 'bg-indigo-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* ── Step 1: Welcome ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="text-center max-w-md animate-fade-in">
          {/* Piano icon */}
          <svg viewBox="0 0 80 48" className="w-20 h-12 mx-auto mb-6 text-indigo-400" fill="currentColor">
            <rect x="0"  y="0" width="10" height="48" rx="2"/>
            <rect x="12" y="0" width="10" height="48" rx="2"/>
            <rect x="24" y="0" width="10" height="48" rx="2"/>
            <rect x="36" y="0" width="10" height="48" rx="2"/>
            <rect x="48" y="0" width="10" height="48" rx="2"/>
            <rect x="60" y="0" width="10" height="48" rx="2"/>
            <rect x="72" y="0" width="8"  height="48" rx="2"/>
            <rect x="8"  y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
            <rect x="20" y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
            <rect x="44" y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
            <rect x="56" y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
            <rect x="68" y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
          </svg>

          <h1 className="text-3xl font-bold text-white mb-3">Welcome to Piano Tutor</h1>
          <p className="text-gray-400 text-base leading-relaxed mb-8">
            Learn piano with interactive lessons, falling notes, and real-time sheet music.
            Optimized for Casio LK-series — compatible with Yamaha, Roland, Korg, and
            most USB MIDI keyboards.
          </p>
          <button
            onClick={() => setStep(2)}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl
              font-medium text-white transition-colors"
          >
            Get Started
          </button>
        </div>
      )}

      {/* ── Step 2: Connect keyboard ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="text-center max-w-md">
          {/* USB plug icon */}
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center
            rounded-full bg-indigo-900/40 border border-indigo-700">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-indigo-400" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v6M9 5h6M12 8v8a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-2"/>
              <circle cx="18" cy="18" r="3"/>
              <path d="M15 18H8"/>
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">Connect your keyboard</h2>
          <p className="text-gray-400 mb-2 leading-relaxed">
            Plug your MIDI keyboard into a USB port and turn it on.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Piano Tutor will detect it automatically.
          </p>

          {/* Live detection status */}
          <div className={`flex items-center justify-center gap-2 text-sm mb-8
            ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-green-400' : 'bg-gray-600 animate-pulse'
            }`} />
            {isConnected
              ? `Detected: ${deviceName ?? 'Keyboard'}`
              : 'Waiting for keyboard\u2026'}
          </div>

          <button
            onClick={finish}
            className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
          >
            Skip — I'll connect later
          </button>
        </div>
      )}

      {/* ── Step 3: All set ──────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="text-center max-w-md">
          {/* Checkmark circle */}
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center
            rounded-full bg-green-500/20 border border-green-600">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-green-400" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">You're all set!</h2>
          <p className="text-gray-400 mb-1">
            {deviceName ?? 'Your keyboard'} is connected and ready.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Pick a lesson from the list and press Play to begin.
          </p>

          <button
            onClick={finish}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl
              font-medium text-white transition-colors"
          >
            Start Playing
          </button>
        </div>
      )}
    </div>
  );
}

/** Returns true if onboarding has never been completed. */
export function needsOnboarding(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}
