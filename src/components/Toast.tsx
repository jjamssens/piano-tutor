import { useEffect, useRef, useState } from 'react';
import { useMidiStore } from '../stores/useMidiStore';
import { midiService } from '../services/MidiService';

interface ToastState {
  message: string;
  type: 'success' | 'warning';
  key: number;   // force re-mount if two toasts fire in quick succession
}

/**
 * Toast
 *
 * Shows a 3-second notification whenever the MIDI keyboard connects or
 * disconnects. Does not fire on the initial render — only on changes.
 */
export function Toast() {
  const isConnected = useMidiStore((s) => s.device.isConnected);
  const [toast, setToast] = useState<ToastState | null>(null);
  const prevConnected = useRef<boolean | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    // Skip the mount — we only want to react to transitions
    if (prevConnected.current === null) {
      prevConnected.current = isConnected;
      return;
    }
    if (isConnected === prevConnected.current) return;

    prevConnected.current = isConnected;

    if (isConnected) {
      const brand = midiService.deviceBrand ?? 'Keyboard';
      const lighting = midiService.hasLighting ? ' (LED lighting on)' : '';
      setToast({ message: `${brand} connected${lighting}`, type: 'success', key: ++counter.current });
    } else {
      setToast({ message: 'Keyboard disconnected', type: 'warning', key: ++counter.current });
    }
  }, [isConnected]);

  // Auto-dismiss after 3 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      key={toast.key}
      className={`fixed top-4 right-4 z-50 flex items-center gap-2.5
        px-4 py-3 rounded-xl shadow-lg text-sm font-medium
        animate-slide-in
        ${toast.type === 'success'
          ? 'bg-green-700 text-white border border-green-600'
          : 'bg-orange-700 text-white border border-orange-600'}`}
    >
      {toast.type === 'success'
        ? <span className="w-2 h-2 rounded-full bg-green-300 flex-shrink-0" />
        : <span className="w-2 h-2 rounded-full bg-orange-300 flex-shrink-0" />}
      {toast.message}
    </div>
  );
}
