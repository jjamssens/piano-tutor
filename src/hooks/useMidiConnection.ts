import { useEffect, useRef } from 'react';
import { midiService } from '../services/MidiService';
import { useMidiStore } from '../stores/useMidiStore';

/**
 * useMidiConnection
 *
 * Bridges MidiService (hardware) → Zustand (UI state).
 *
 * - Subscribes to device state changes (connect/disconnect, range)
 * - Subscribes to range-change events when auto-expansion fires
 * - Drains the MIDI event buffer at 60fps via RAF loop
 * - Clamps out-of-range notes to the DETECTED range (not a hardcoded 61-key range)
 */
export function useMidiConnection() {
  const setDevice       = useMidiStore((s) => s.setDevice);
  const setKeyboardRange = useMidiStore((s) => s.setKeyboardRange);
  const setKeyOn        = useMidiStore((s) => s.setKeyOn);
  const setKeyOff       = useMidiStore((s) => s.setKeyOff);
  const resetAllKeys    = useMidiStore((s) => s.resetAllKeys);

  const rafRef    = useRef<number | null>(null);
  const isRunning = useRef(false);

  useEffect(() => {
    midiService.initialize();

    // Device connect / disconnect — includes detected keyboard range
    const unsubState = midiService.onDeviceStateChange((state) => {
      setDevice(state);
      if (!state.isConnected) resetAllKeys();
    });

    // Range auto-expansion — fires when user plays a note outside initial range
    const unsubRange = midiService.onRangeChange((range) => {
      setKeyboardRange(range);
    });

    // 60fps drain loop
    isRunning.current = true;
    const tick = () => {
      if (!isRunning.current) return;

      const events = midiService.drainEventBuffer();
      if (events.length > 0) {
        const range = midiService.getKeyboardRange();
        for (const event of events) {
          // Clamp note to the detected keyboard range by octave-shifting
          let note = event.note;
          while (note < range.min) note += 12;
          while (note > range.max) note -= 12;

          if (event.type === 'noteOn') {
            setKeyOn(note, event.velocity, event.timestamp);
          } else {
            setKeyOff(note, event.timestamp);
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      isRunning.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      unsubState();
      unsubRange();
    };
  }, [setDevice, setKeyboardRange, setKeyOn, setKeyOff, resetAllKeys]);
}
