import { useMidiStore } from '../stores/useMidiStore';
import { useGameStore } from '../stores/useGameStore';

const BLACK_KEY_OFFSETS = new Set([1, 3, 6, 8, 10]);
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function isBlackKey(note: number): boolean {
  return BLACK_KEY_OFFSETS.has(note % 12);
}

function noteName(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

function octave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/**
 * PianoKeyboard — 61-key visual display (C2–C7).
 * When showNoteLabels is on, note names are displayed on white keys.
 * C notes always get the octave number label regardless.
 */
export function PianoKeyboard() {
  const keyStates      = useMidiStore((s) => s.keyStates);
  const keyboardRange  = useMidiStore((s) => s.keyboardRange);
  const showNoteLabels = useGameStore((s) => s.showNoteLabels);

  const notes = Array.from(
    { length: keyboardRange.max - keyboardRange.min + 1 },
    (_, i) => keyboardRange.min + i
  );

  const whiteKeys = notes.filter((n) => !isBlackKey(n));
  const blackKeys = notes.filter((n) => isBlackKey(n));

  const whiteKeyIndex = new Map<number, number>();
  let wi = 0;
  for (const n of notes) {
    if (!isBlackKey(n)) whiteKeyIndex.set(n, wi++);
  }

  const WHITE_KEY_WIDTH = 28;
  const totalWidth = whiteKeys.length * WHITE_KEY_WIDTH;

  return (
    <div className="relative select-none" style={{ width: totalWidth, height: 160 }}>
      {/* White keys */}
      {whiteKeys.map((note) => {
        const state    = keyStates.get(note);
        const pressed  = state?.isPressed ?? false;
        const velAlpha = pressed ? 0.4 + (state!.velocity / 127) * 0.6 : 0;
        const idx      = whiteKeyIndex.get(note) ?? 0;
        const name     = noteName(note);
        const isC      = note % 12 === 0;
        const showLabel = showNoteLabels || isC;

        return (
          <div
            key={note}
            title={`${name}${octave(note)} (MIDI ${note})`}
            className="absolute border border-gray-400 rounded-b-sm flex flex-col justify-end items-center pb-1"
            style={{
              left:            idx * WHITE_KEY_WIDTH,
              width:           WHITE_KEY_WIDTH - 1,
              height:          160,
              backgroundColor: pressed ? `rgba(74,222,128,${velAlpha})` : 'white',
              zIndex:          1,
              transition:      'background-color 30ms',
            }}
          >
            {showLabel && (
              <span
                className="text-gray-500 leading-none select-none"
                style={{ fontSize: 8, fontWeight: isC ? 700 : 400 }}
              >
                {showNoteLabels ? name : `C${octave(note)}`}
              </span>
            )}
          </div>
        );
      })}

      {/* Black keys */}
      {blackKeys.map((note) => {
        const state    = keyStates.get(note);
        const pressed  = state?.isPressed ?? false;
        const velAlpha = pressed ? 0.5 + (state!.velocity / 127) * 0.5 : 1;
        const prevWhite = whiteKeyIndex.get(note - 1) ?? 0;
        const leftPos   = (prevWhite + 1) * WHITE_KEY_WIDTH - 9;
        const name      = noteName(note);

        return (
          <div
            key={note}
            title={`${name}${octave(note)} (MIDI ${note})`}
            className="absolute rounded-b-sm flex flex-col justify-end items-center pb-0.5"
            style={{
              left:            leftPos,
              width:           18,
              height:          100,
              backgroundColor: pressed ? `rgba(74,222,128,${velAlpha})` : '#1a1a1a',
              zIndex:          2,
              transition:      'background-color 30ms',
            }}
          >
            {showNoteLabels && (
              <span className="text-gray-500 leading-none select-none" style={{ fontSize: 6 }}>
                {name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
