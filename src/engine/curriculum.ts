import type { LessonSong, KeySignatureSpec } from '../types/game.types';

const C_MAJOR: KeySignatureSpec = {
  root: 'C',
  mode: 'major',
  alteredPitches: new Set(),
};

const G_MAJOR: KeySignatureSpec = {
  root: 'G',
  mode: 'major',
  alteredPitches: new Set([6]), // F#
};

const A_MINOR: KeySignatureSpec = {
  root: 'A',
  mode: 'minor',
  alteredPitches: new Set(), // same signature as C major
};

const D_MAJOR: KeySignatureSpec = {
  root: 'D',
  mode: 'major',
  alteredPitches: new Set([6, 1]), // F#, C#
};

const id = (lesson: number, index: number) => `L${lesson}-N${index}`;

// ─── Shared helper ────────────────────────────────────────────────────────────

function buildNotes(
  lesson: number,
  notes: number[],
  durations: number[],
  velocities: number[],
  beatMs: number,
) {
  let t = 0;
  return notes.map((note, i) => {
    const n = {
      id: id(lesson, i),
      note,
      targetTimestamp: t,
      durationMs: durations[i] * beatMs * 0.85,
      targetVelocity: velocities[i],
    };
    t += durations[i] * beatMs;
    return n;
  });
}

// ─── Lesson 1 (Level 1): One Note Wonder ──────────────────────────────────────

const BPM1 = 70;
const BEAT1 = (60 / BPM1) * 1000;

export const lesson1: LessonSong = {
  id: 'c-major-1',
  title: 'Lesson 1 — One Note Wonder (C4)',
  bpm: BPM1,
  keySignature: C_MAJOR,
  difficultyLevel: 1,
  notes: Array.from({ length: 8 }, (_, i) => ({
    id: id(1, i),
    note: 60,
    targetTimestamp: i * BEAT1 * 2,
    durationMs: BEAT1 * 0.8,
    targetVelocity: 64,
  })),
};

// ─── Lesson 2 (Level 2): C-D-E ────────────────────────────────────────────────

const BPM2 = 75;
const BEAT2 = (60 / BPM2) * 1000;
const CDE = [60, 62, 64, 62, 60];

export const lesson2: LessonSong = {
  id: 'c-major-2',
  title: 'Lesson 2 — Three Amigos (C-D-E)',
  bpm: BPM2,
  keySignature: C_MAJOR,
  difficultyLevel: 2,
  notes: CDE.flatMap((note, i) => [
    { id: id(2, i * 2),     note, targetTimestamp: i * BEAT2,                          durationMs: BEAT2 * 0.85, targetVelocity: 64 },
    { id: id(2, i * 2 + 1), note, targetTimestamp: (CDE.length + 1 + i) * BEAT2,       durationMs: BEAT2 * 0.85, targetVelocity: 64 },
  ]),
};

// ─── Lesson 3 (Level 3): C Major Scale ───────────────────────────────────────

const BPM3 = 80;
const BEAT3 = (60 / BPM3) * 1000;
const SCALE_UP   = [60, 62, 64, 65, 67, 69, 71, 72];
const SCALE_DOWN = [...SCALE_UP].reverse();

export const lesson3: LessonSong = {
  id: 'c-major-3',
  title: 'Lesson 3 — The C Major Scale',
  bpm: BPM3,
  keySignature: C_MAJOR,
  difficultyLevel: 3,
  notes: [
    ...SCALE_UP.map((note, i)  => ({ id: id(3, i),                    note, targetTimestamp: i * BEAT3,                      durationMs: BEAT3 * 0.85, targetVelocity: 64 })),
    ...SCALE_DOWN.map((note, i) => ({ id: id(3, SCALE_UP.length + i),  note, targetTimestamp: (SCALE_UP.length + 1 + i) * BEAT3, durationMs: BEAT3 * 0.85, targetVelocity: 64 })),
  ],
};

// ─── Lesson 4 (Level 4): Mary Had a Little Lamb ──────────────────────────────

const BPM4 = 80;
const BEAT4 = (60 / BPM4) * 1000;
const MARY_NOTES = [64,62,60,62,64,64,64, 62,62,62, 64,67,67, 64,62,60,62,64,64,64, 62,62,64,62,60];
const MARY_DUR   = [1,1,1,1,1,1,2, 1,1,2, 1,1,2, 1,1,1,1,1,1,2, 1,1,1,1,2];
const MARY_VEL   = [72,64,72,64,80,72,80, 64,64,72, 72,72,80, 72,64,72,64,80,72,80, 64,64,72,64,80];

export const lesson4: LessonSong = {
  id: 'c-major-4',
  title: 'Lesson 4 — Mary Had a Little Lamb',
  bpm: BPM4,
  keySignature: C_MAJOR,
  difficultyLevel: 4,
  notes: buildNotes(4, MARY_NOTES, MARY_DUR, MARY_VEL, BEAT4),
};

// ─── Lesson 5 (Level 5): Ode to Joy ──────────────────────────────────────────

const BPM5 = 80;
const BEAT5 = (60 / BPM5) * 1000;
const ODE_NOTES = [64,64,65,67, 67,65,64,62, 60,60,62,64, 64,62,62];
const ODE_DUR   = [1,1,1,1, 1,1,1,1, 1,1,1,1, 1.5,0.5,2];
const ODE_VEL   = [72,72,72,80, 80,72,80,72, 72,72,72,80, 80,72,80];

export const lesson5: LessonSong = {
  id: 'c-major-5',
  title: 'Lesson 5 — Ode to Joy (4-bar)',
  bpm: BPM5,
  keySignature: C_MAJOR,
  difficultyLevel: 5,
  notes: buildNotes(5, ODE_NOTES, ODE_DUR, ODE_VEL, BEAT5),
};

// ─── Lesson 6 (Level 6): Twinkle Twinkle Little Star ─────────────────────────

const BPM6 = 90;
const BEAT6 = (60 / BPM6) * 1000;
// C C G G A A G  F F E E D D C  G G F F E E D  G G F F E E D  C C G G A A G  F F E E D D C
const TWINKLE_NOTES = [
  60,60,67,67,69,69,67,
  65,65,64,64,62,62,60,
  67,67,65,65,64,64,62,
  67,67,65,65,64,64,62,
  60,60,67,67,69,69,67,
  65,65,64,64,62,62,60,
];
const TWINKLE_DUR = [
  1,1,1,1,1,1,2,
  1,1,1,1,1,1,2,
  1,1,1,1,1,1,2,
  1,1,1,1,1,1,2,
  1,1,1,1,1,1,2,
  1,1,1,1,1,1,2,
];
const TWINKLE_VEL = TWINKLE_NOTES.map(() => 68);

export const lesson6: LessonSong = {
  id: 'c-major-6',
  title: 'Lesson 6 — Twinkle Twinkle Little Star',
  bpm: BPM6,
  keySignature: C_MAJOR,
  difficultyLevel: 6,
  notes: buildNotes(6, TWINKLE_NOTES, TWINKLE_DUR, TWINKLE_VEL, BEAT6),
};

// ─── Lesson 7 (Level 7): Frère Jacques ───────────────────────────────────────

const BPM7 = 90;
const BEAT7 = (60 / BPM7) * 1000;
// C D E C | C D E C | E F G(half) | E F G(half) |
// G A G F E C | G A G F E C | C G3 C(half) | C G3 C(half)
const FRERE_NOTES = [
  60,62,64,60,
  60,62,64,60,
  64,65,67,
  64,65,67,
  67,69,67,65,64,60,
  67,69,67,65,64,60,
  60,55,60,
  60,55,60,
];
const FRERE_DUR = [
  1,1,1,1,
  1,1,1,1,
  1,1,2,
  1,1,2,
  0.5,0.5,0.5,0.5,1,1,
  0.5,0.5,0.5,0.5,1,1,
  1,1,2,
  1,1,2,
];
const FRERE_VEL = FRERE_NOTES.map((_, i) => i % 4 === 0 ? 76 : 64);

export const lesson7: LessonSong = {
  id: 'c-major-7',
  title: 'Lesson 7 — Frère Jacques',
  bpm: BPM7,
  keySignature: C_MAJOR,
  difficultyLevel: 7,
  notes: buildNotes(7, FRERE_NOTES, FRERE_DUR, FRERE_VEL, BEAT7),
};

// ─── Lesson 8 (Level 8): Jingle Bells chorus ─────────────────────────────────

const BPM8 = 110;
const BEAT8 = (60 / BPM8) * 1000;
// E E E(half) | E E E(half) | E G C D | E(whole) |
// F F F F | F E E(half) | G G F D | C(whole)
const JINGLE_NOTES = [
  64,64,64,
  64,64,64,
  64,67,60,62,
  64,
  65,65,65,65,
  65,64,64,
  67,67,65,62,
  60,
];
const JINGLE_DUR = [
  1,1,2,
  1,1,2,
  1,1,1,1,
  4,
  1,1,1,1,
  1,1,2,
  1,1,1,1,
  4,
];
const JINGLE_VEL = JINGLE_NOTES.map(() => 80);

export const lesson8: LessonSong = {
  id: 'c-major-8',
  title: 'Lesson 8 — Jingle Bells (chorus)',
  bpm: BPM8,
  keySignature: C_MAJOR,
  difficultyLevel: 8,
  notes: buildNotes(8, JINGLE_NOTES, JINGLE_DUR, JINGLE_VEL, BEAT8),
};

// ─── Lesson 9 (Level 9): Für Elise (simplified A section) ────────────────────
// E5 Eb5 E5 Eb5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 Ab4 B4 C5
// Uses A minor key sig but Eb/Ab are chromatic accidentals

const BPM9 = 72;
const BEAT9 = (60 / BPM9) * 1000;
const FUR_NOTES = [
  76,75,76,75,76,71,74,72,
  69,60,64,69,
  71,60,64,68,
  69,60,64,69,
  71,76,74,72,
  60,60,64,67,
  69,60,64,69,
];
// All eighth notes (0.5 beats) except some held longer
const FUR_DUR = FUR_NOTES.map(() => 0.5);
// The A4 at index 8 is held a bit longer
FUR_DUR[8]  = 1.5;
FUR_DUR[12] = 1.5;
FUR_DUR[16] = 1.5;
FUR_DUR[20] = 1.5;
FUR_DUR[24] = 1.5;
FUR_DUR[28] = 2;

const FUR_VEL = FUR_NOTES.map((_, i) => i === 0 ? 72 : 60);

export const lesson9: LessonSong = {
  id: 'c-major-9',
  title: 'Lesson 9 — Für Elise (simplified)',
  bpm: BPM9,
  keySignature: A_MINOR,
  difficultyLevel: 9,
  notes: buildNotes(9, FUR_NOTES, FUR_DUR, FUR_VEL, BEAT9),
};

// ─── Lesson 10 (Level 10): Ode to Joy (full melody) ──────────────────────────

const BPM10 = 96;
const BEAT10 = (60 / BPM10) * 1000;
// Full 4-phrase Ode to Joy in D major (standard key), transposed to our range
// E E F G | G F E D | C C D E | E. D D (phrase 1)
// E E F G | G F E D | C C D E | D. C C (phrase 2)
// D D E C | D E F E C | D E F E D | C D G (phrase 3)
// E E F G | G F E D | C C D E | D. C C (phrase 4)
const ODE_FULL_NOTES = [
  // Phrase 1
  64,64,65,67, 67,65,64,62, 60,60,62,64, 64,62,62,
  // Phrase 2
  64,64,65,67, 67,65,64,62, 60,60,62,64, 62,60,60,
  // Phrase 3 (bridge - slightly different)
  62,62,64,60, 62,64,65,64,60, 62,64,65,64,62, 60,62,67,
  // Phrase 4 (repeat phrase 2)
  64,64,65,67, 67,65,64,62, 60,60,62,64, 62,60,60,
];
const ODE_FULL_DUR = [
  1,1,1,1, 1,1,1,1, 1,1,1,1, 1.5,0.5,2,
  1,1,1,1, 1,1,1,1, 1,1,1,1, 1.5,0.5,2,
  1,1,1,1, 1,1,1,1,2, 1,1,1,1,2, 1,1,2,
  1,1,1,1, 1,1,1,1, 1,1,1,1, 1.5,0.5,2,
];
const ODE_FULL_VEL = ODE_FULL_NOTES.map((_, i) => {
  const phrase = Math.floor(i / 15);
  return phrase === 2 ? 80 : 72; // Bridge is louder
});

export const lesson10: LessonSong = {
  id: 'c-major-10',
  title: 'Lesson 10 — Ode to Joy (full melody)',
  bpm: BPM10,
  keySignature: D_MAJOR,
  difficultyLevel: 10,
  notes: buildNotes(10, ODE_FULL_NOTES, ODE_FULL_DUR, ODE_FULL_VEL, BEAT10),
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const CURRICULUM: LessonSong[] = [
  lesson1, lesson2, lesson3, lesson4, lesson5,
  lesson6, lesson7, lesson8, lesson9, lesson10,
];

/**
 * Recommended scaffold phase per lesson index (0-based).
 * Levels 1-3: full crutch (all visual aids)
 * Levels 4-6: transition (ghosted notes)
 * Levels 7-10: independence (sheet music only)
 */
export const LESSON_SCAFFOLD = [
  'crutch', 'crutch', 'crutch',
  'transition', 'transition', 'transition',
  'independence', 'independence', 'independence', 'independence',
] as const;

/** Score threshold (0-1) required to unlock the next song */
export const UNLOCK_THRESHOLD = 0.85;
