import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { KeyState, MidiDeviceState, NoteNumber } from '../types/midi.types';

interface KeyboardRange { min: number; max: number; }

interface MidiStoreState {
  device: MidiDeviceState;

  /** Detected physical key range — updates on connect and as notes are played */
  keyboardRange: KeyboardRange;

  /** Live key states for any note 0–127 that has been pressed */
  keyStates: Map<NoteNumber, KeyState>;

  setDevice: (state: MidiDeviceState) => void;
  setKeyboardRange: (range: KeyboardRange) => void;
  setKeyOn: (note: NoteNumber, velocity: number, timestamp: number) => void;
  setKeyOff: (note: NoteNumber, timestamp: number) => void;
  resetAllKeys: () => void;
}

function makeKeyStates(range: KeyboardRange): Map<NoteNumber, KeyState> {
  return new Map(
    Array.from(
      { length: range.max - range.min + 1 },
      (_, i) => [range.min + i, { isPressed: false, velocity: 0, timestamp: 0 }]
    )
  );
}

const DEFAULT_RANGE: KeyboardRange = { min: 36, max: 96 }; // 61-key default

export const useMidiStore = create<MidiStoreState>()(
  subscribeWithSelector((set) => ({
    device: {
      isConnected: false,
      inputName: null,
      outputName: null,
      lastError: null,
      keyboardMin: DEFAULT_RANGE.min,
      keyboardMax: DEFAULT_RANGE.max,
    },

    keyboardRange: DEFAULT_RANGE,

    keyStates: makeKeyStates(DEFAULT_RANGE),

    setDevice: (state) =>
      set((s) => {
        const newRange = { min: state.keyboardMin, max: state.keyboardMax };
        const rangeChanged =
          newRange.min !== s.keyboardRange.min ||
          newRange.max !== s.keyboardRange.max;
        return {
          device: state,
          keyboardRange: newRange,
          // Rebuild keyStates map when range changes to initialize all new keys
          keyStates: rangeChanged ? makeKeyStates(newRange) : s.keyStates,
        };
      }),

    setKeyboardRange: (range) =>
      set((s) => {
        const rangeChanged =
          range.min !== s.keyboardRange.min || range.max !== s.keyboardRange.max;
        if (!rangeChanged) return {};
        // Merge existing pressed states into the new map
        const next = makeKeyStates(range);
        for (const [note, state] of s.keyStates) {
          if (state.isPressed && note >= range.min && note <= range.max) {
            next.set(note, state);
          }
        }
        return { keyboardRange: range, keyStates: next };
      }),

    setKeyOn: (note, velocity, timestamp) =>
      set((s) => {
        const next = new Map(s.keyStates);
        next.set(note, { isPressed: true, velocity, timestamp });
        return { keyStates: next };
      }),

    setKeyOff: (note, timestamp) =>
      set((s) => {
        const next = new Map(s.keyStates);
        next.set(note, { isPressed: false, velocity: 0, timestamp });
        return { keyStates: next };
      }),

    resetAllKeys: () =>
      set((s) => {
        const next = new Map(s.keyStates);
        for (const key of next.keys()) {
          next.set(key, { isPressed: false, velocity: 0, timestamp: 0 });
        }
        return { keyStates: next };
      }),
  }))
);
