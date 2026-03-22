import { Midi } from '@tonejs/midi';
import type { KeySignatureSpec, LessonSong, ScheduledNote } from '../types/game.types';

/**
 * Map MIDI key signature (sharps count) → key root + altered pitch classes.
 * Positive = sharps, negative = flats.
 * Sharps order:  F# C# G# D# A# E# B#  (pitch classes 6 1 8 3 10 5 0)
 * Flats order:   Bb Eb Ab Db Gb Cb Fb  (pitch classes 10 3 8 1 6 11 4)
 */
const KEY_SIG_MAP: Record<number, { root: string; alteredPitches: number[] }> = {
   7: { root: 'C#', alteredPitches: [6,1,8,3,10,5,0]  },
   6: { root: 'F#', alteredPitches: [6,1,8,3,10,5]    },
   5: { root: 'B',  alteredPitches: [6,1,8,3,10]      },
   4: { root: 'E',  alteredPitches: [6,1,8,3]         },
   3: { root: 'A',  alteredPitches: [6,1,8]           },
   2: { root: 'D',  alteredPitches: [6,1]             },
   1: { root: 'G',  alteredPitches: [6]               },
   0: { root: 'C',  alteredPitches: []                },
  '-1': { root: 'F',  alteredPitches: [10]            },
  '-2': { root: 'Bb', alteredPitches: [10,3]          },
  '-3': { root: 'Eb', alteredPitches: [10,3,8]        },
  '-4': { root: 'Ab', alteredPitches: [10,3,8,1]      },
  '-5': { root: 'Db', alteredPitches: [10,3,8,1,6]    },
  '-6': { root: 'Gb', alteredPitches: [10,3,8,1,6,11] },
  '-7': { root: 'Cb', alteredPitches: [10,3,8,1,6,11,4] },
};

/**
 * parseMidiFile
 *
 * Converts an ArrayBuffer (raw .mid file bytes) into a LessonSong
 * compatible with GameEngine, FallingNotesRenderer, and MasterClass.
 *
 * - All tracks are merged; notes sorted by absolute time
 * - Out-of-range notes are octave-shifted to fit the 61-key board (C2–C7)
 * - Velocity is preserved from the MIDI file for Expression scoring
 * - Key signature and BPM are read from MIDI meta events when present
 * - Timestamps are normalized to start at 0 (first note = 0ms)
 *
 * @throws if the file cannot be parsed or contains no notes
 */
export function parseMidiFile(
  buffer: ArrayBuffer,
  fileName: string,
  keyboardRange: { min: number; max: number } = { min: 36, max: 96 }
): LessonSong {
  const midi = new Midi(buffer);

  // ─── Key signature ─────────────────────────────────────────────────────────
  const keySigEvent = midi.header.keySignatures[0];
  const sfKey       = String(keySigEvent?.key ?? 0);
  const keySigData  = KEY_SIG_MAP[sfKey as unknown as number] ?? KEY_SIG_MAP[0];

  const keySignature: KeySignatureSpec = {
    root:           keySigData.root,
    mode:           keySigEvent?.scale === 'minor' ? 'minor' : 'major',
    alteredPitches: new Set(keySigData.alteredPitches),
  };

  // ─── BPM ───────────────────────────────────────────────────────────────────
  const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 120);

  // ─── Collect notes (skip General MIDI percussion channel) ────────────────
  const raw: Array<{ midi: number; time: number; duration: number; velocity: number }> = [];

  for (const track of midi.tracks) {
    // Channel 10 (index 9) is GM percussion — skip it entirely
    if (track.instrument.percussion) continue;
    for (const note of track.notes) {
      raw.push({ midi: note.midi, time: note.time, duration: note.duration, velocity: note.velocity });
    }
  }

  if (raw.length === 0) {
    throw new Error('No notes found in this MIDI file.');
  }

  // ─── Global optimal transposition ─────────────────────────────────────────
  // Naively shifting each note independently destroys chord voicings and makes
  // bass notes jump up to the treble register. Instead, find the single
  // transposition (±2 octaves) that puts the MOST notes naturally in range,
  // then apply it globally. Only clamp individual outliers as a last resort.
  const MIN = keyboardRange.min;
  const MAX = keyboardRange.max;

  let bestTranspose = 0;
  let bestScore     = -1;
  for (let t = -24; t <= 24; t++) {
    const score = raw.filter((n) => n.midi + t >= MIN && n.midi + t <= MAX).length;
    if (score > bestScore) { bestScore = score; bestTranspose = t; }
  }

  // ─── Apply transposition + clamp remaining outliers ───────────────────────
  // Deduplicate notes at the same pitch & timestamp (multiple tracks playing
  // the same note simultaneously, or octave-clamp collisions).
  const allNotes: ScheduledNote[] = [];
  let noteIndex = 0;
  const seen = new Set<string>();

  for (const n of raw) {
    let midiNote = n.midi + bestTranspose;
    while (midiNote < MIN) midiNote += 12;
    while (midiNote > MAX) midiNote -= 12;

    const targetTimestamp = n.time * 1000;
    const dedupeKey = `${Math.round(targetTimestamp)}-${midiNote}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    allNotes.push({
      id:              `upload-${noteIndex++}`,
      note:            midiNote,
      targetTimestamp,
      durationMs:      Math.max(n.duration * 1000, 80),
      targetVelocity:  Math.round(n.velocity * 127),
    });
  }

  // Sort by absolute time
  allNotes.sort((a, b) => a.targetTimestamp - b.targetTimestamp);

  // Normalize: shift so the first note starts at t=0
  const offset = allNotes[0].targetTimestamp;
  for (const n of allNotes) {
    n.targetTimestamp -= offset;
  }

  // ─── Build LessonSong ──────────────────────────────────────────────────────
  const title = fileName
    .replace(/\.midi?$/i, '')   // strip extension
    .replace(/[_-]/g, ' ')      // underscores/hyphens → spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case

  const song: LessonSong = {
    id:           `upload-${Date.now()}`,
    title,
    bpm,
    keySignature,
    notes:        allNotes,
  };
  song.difficultyLevel = classifyDifficulty(song);
  return song;
}


// ─── Difficulty classification ─────────────────────────────────────────────────
// Analyzes a parsed MIDI song and returns a difficulty level from 1–10.
// Metrics: note range span, notes-per-second density, peak polyphony, and tempo.

export function classifyDifficulty(song: LessonSong): number {
  const notes = song.notes;
  if (notes.length === 0) return 1;

  // 1. Note range span (semitones between lowest and highest note)
  const minNote = Math.min(...notes.map((n) => n.note));
  const maxNote = Math.max(...notes.map((n) => n.note));
  const span    = maxNote - minNote;
  const spanScore = span < 8 ? 0 : span < 16 ? 1 : span < 24 ? 2 : 3;

  // 2. Note density (notes per second)
  const songMs   = Math.max(...notes.map((n) => n.targetTimestamp + n.durationMs)) - notes[0].targetTimestamp;
  const density  = songMs > 0 ? (notes.length / (songMs / 1000)) : 1;
  const densityScore = density < 2 ? 0 : density < 4 ? 1 : density < 7 ? 2 : 3;

  // 3. Peak polyphony (max simultaneous notes)
  let maxPoly = 1;
  for (let i = 0; i < notes.length; i++) {
    const end = notes[i].targetTimestamp + notes[i].durationMs;
    let concurrent = 1;
    for (let j = i + 1; j < notes.length; j++) {
      if (notes[j].targetTimestamp < end) concurrent++;
      else break;
    }
    if (concurrent > maxPoly) maxPoly = concurrent;
  }
  const polyScore = maxPoly <= 1 ? 0 : maxPoly <= 2 ? 1 : 2;

  // 4. Tempo factor
  const tempoScore = song.bpm < 80 ? 0 : song.bpm < 110 ? 1 : 2;

  const rawScore = spanScore + densityScore + polyScore + tempoScore; // 0–10
  return Math.max(1, Math.min(10, rawScore + 1));
}

// ─── localStorage persistence helpers ─────────────────────────────────────────

type SerializedSong = Omit<LessonSong, 'keySignature'> & {
  keySignature: Omit<KeySignatureSpec, 'alteredPitches'> & { alteredPitches: number[] };
};

const STORAGE_KEY = 'piano-tutor-user-songs';

export function saveUserSongs(songs: LessonSong[]): void {
  const serializable: SerializedSong[] = songs.map((s) => ({
    ...s,
    keySignature: {
      ...s.keySignature,
      alteredPitches: Array.from(s.keySignature.alteredPitches),
    },
  }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // localStorage quota exceeded — silently skip persistence
  }
}

export function loadUserSongs(): LessonSong[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: SerializedSong[] = JSON.parse(raw);
    return parsed.map((s) => ({
      ...s,
      keySignature: {
        ...s.keySignature,
        alteredPitches: new Set(s.keySignature.alteredPitches),
      },
    }));
  } catch {
    return [];
  }
}
