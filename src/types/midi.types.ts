export interface MidiDeviceState {
  isConnected: boolean;
  inputName: string | null;
  outputName: string | null;
  lastError: string | null;
  /** Detected MIDI note range for this keyboard */
  keyboardMin: number;
  keyboardMax: number;
}

export interface KeyState {
  isPressed: boolean;
  velocity: number;      // 0–127
  timestamp: number;     // performance.now() at event time
}

// 61 keys: MIDI notes 36 (C2) through 96 (C7)
export const KEYBOARD_RANGE = { min: 36, max: 96 } as const;

export type NoteNumber = number; // MIDI note 0–127

export interface NoteEvent {
  note: NoteNumber;
  velocity: number;
  timestamp: number;
  type: 'noteOn' | 'noteOff';
}
