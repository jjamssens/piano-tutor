import type { LessonSong, KeySignatureSpec } from '../types/game.types';

const C_MAJOR: KeySignatureSpec = { root: 'C', mode: 'major', alteredPitches: new Set() };
const G_MAJOR: KeySignatureSpec = { root: 'G', mode: 'major', alteredPitches: new Set([6]) }; // F#
const A_MINOR: KeySignatureSpec = { root: 'A', mode: 'minor', alteredPitches: new Set() };
const D_MAJOR: KeySignatureSpec = { root: 'D', mode: 'major', alteredPitches: new Set([6, 1]) }; // F#, C#

const id = (lesson: number | string, index: number) => `L${lesson}-N${index}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNotes(
  lesson: number | string,
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

/**
 * Build a two-hand lesson from explicit beat-position arrays.
 * Each entry: [midiNote, beatPosition, durationBeats, velocity].
 * RH notes should be ≥ 60 (C4); LH notes should be < 60.
 */
function twoHandNotes(
  lessonId: string,
  beatMs: number,
  rh: Array<[number, number, number, number]>,
  lh: Array<[number, number, number, number]>,
): LessonSong['notes'] {
  const all: LessonSong['notes'] = [];
  rh.forEach(([note, beat, dur, vel], i) =>
    all.push({ id: `${lessonId}-R${i}`, note, targetTimestamp: beat * beatMs, durationMs: dur * beatMs * 0.85, targetVelocity: vel }),
  );
  lh.forEach(([note, beat, dur, vel], i) =>
    all.push({ id: `${lessonId}-L${i}`, note, targetTimestamp: beat * beatMs, durationMs: dur * beatMs * 0.85, targetVelocity: vel }),
  );
  return all.sort((a, b) => a.targetTimestamp - b.targetTimestamp || a.note - b.note);
}

// ─── Section 1: Single Hand Basics ────────────────────────────────────────────

// Lesson 1 — Five-Finger Position ─────────────────────────────────────────────
// C-D-E-F-G ascending and descending, twice through. Teaches hand position.

const BPM1 = 65;
const BEAT1 = (60 / BPM1) * 1000;
const FIVE_UP   = [60, 62, 64, 65, 67];
const FIVE_DOWN = [67, 65, 64, 62, 60];

export const lesson1: LessonSong = {
  id: 'c-major-1',
  title: 'Lesson 1 — Five-Finger Position',
  bpm: BPM1,
  keySignature: C_MAJOR,
  difficultyLevel: 1,
  notes: buildNotes(1,
    [...FIVE_UP, ...FIVE_DOWN, ...FIVE_UP, ...FIVE_DOWN],
    [1,1,1,1,1, 1,1,1,1,3, 1,1,1,1,1, 1,1,1,1,4],
    [...Array(20)].map((_, i) => i < 10 ? 64 : 70),
    BEAT1,
  ),
};

// Lesson 2 — Expanding Fingers ────────────────────────────────────────────────
// Builds range phrase by phrase: C → C-D-C → C-D-E-D-C → full five-finger.

const BPM2 = 70;
const BEAT2 = (60 / BPM2) * 1000;

export const lesson2: LessonSong = {
  id: 'c-major-2',
  title: 'Lesson 2 — Expanding Fingers',
  bpm: BPM2,
  keySignature: C_MAJOR,
  difficultyLevel: 2,
  notes: buildNotes(2,
    [60,60, 60,62,60, 60,62,64,62,60, 60,62,64,65,67,65,64,62,60],
    [1,3,   1,1,3,    1,1,1,1,3,      1,1,1,1,1,1,1,1,4],
    [...Array(19)].map(() => 64),
    BEAT2,
  ),
};

// Lesson 3 — Legato & Staccato ────────────────────────────────────────────────
// Two passes: first smooth (long notes), then detached (short notes).
// The visual bar length changes — students learn to match it.

const BPM_LS = 76;
const BEAT_LS = (60 / BPM_LS) * 1000;
const LS_SCALE = [60, 62, 64, 65, 67, 65, 64, 62, 60];

const lessonLegatoStaccatoNotes: LessonSong['notes'] = [
  // Pass 1: legato — long, smooth notes
  ...LS_SCALE.map((note, i) => ({
    id: `LS-leg-${i}`,
    note,
    targetTimestamp: i * BEAT_LS,
    durationMs: (i === LS_SCALE.length - 1 ? 3 : 1) * BEAT_LS * 0.92,
    targetVelocity: 68,
  })),
  // Pass 2: staccato — crisp, detached (starts 2 beats after legato ends)
  ...LS_SCALE.map((note, i) => ({
    id: `LS-sta-${i}`,
    note,
    targetTimestamp: (LS_SCALE.length + 2 + i) * BEAT_LS,
    durationMs: BEAT_LS * 0.22,
    targetVelocity: 80,
  })),
];

export const lessonLegatoStaccato: LessonSong = {
  id: 'technique-legato-staccato',
  title: 'Lesson 3 — Legato & Staccato',
  bpm: BPM_LS,
  keySignature: C_MAJOR,
  difficultyLevel: 3,
  notes: lessonLegatoStaccatoNotes,
};

// Lesson 4 — Rhythm Basics ────────────────────────────────────────────────────
// All on C4: quarter → half → whole, twice. Focus entirely on counting.

const BPM_R1 = 80;
const BEAT_R1 = (60 / BPM_R1) * 1000;

export const lessonRhythm: LessonSong = {
  id: 'technique-rhythm',
  title: 'Lesson 4 — Rhythm Basics (♩ ♩ ♩𝄺 ♩ ♩ ♩𝄺 ♩ ♩ ♩ ♩ 𝅝)',
  bpm: BPM_R1,
  keySignature: C_MAJOR,
  difficultyLevel: 4,
  notes: buildNotes('R1',
    Array<number>(22).fill(60),
    [1,1,2, 1,1,2, 1,1,1,1,4, 1,1,2, 1,1,2, 1,1,1,1,4],
    Array<number>(22).fill(68).map((v, i) => i === 0 || i === 11 ? 84 : v),
    BEAT_R1,
  ),
};

// Lesson 5 — Eighth Notes ─────────────────────────────────────────────────────
// Phase 1: same C scale as quarter notes. Phase 2: same scale as eighth notes.
// Side-by-side comparison shows the note value relationship.

const BPM_EN = 80;
const BEAT_EN = (60 / BPM_EN) * 1000;
const EN_SCALE = [60, 62, 64, 65, 67, 65, 64, 62, 60];

const lessonEighthNotesNotes: LessonSong['notes'] = [
  // Phase 1: quarter notes (t = 0..8, last held to t = 11)
  ...EN_SCALE.map((note, i) => ({
    id: `EN-q${i}`,
    note,
    targetTimestamp: i * BEAT_EN,
    durationMs: (i === EN_SCALE.length - 1 ? 3 : 1) * BEAT_EN * 0.88,
    targetVelocity: 68,
  })),
  // Phase 2: eighth notes (t = 11..15, last held to t = 17)
  ...EN_SCALE.map((note, i) => ({
    id: `EN-e${i}`,
    note,
    targetTimestamp: (11 + i * 0.5) * BEAT_EN,
    durationMs: (i === EN_SCALE.length - 1 ? 2 : 0.5) * BEAT_EN * 0.88,
    targetVelocity: 72,
  })),
];

export const lessonEighthNotes: LessonSong = {
  id: 'technique-eighth-notes',
  title: 'Lesson 5 — Eighth Notes (♩ vs ♪)',
  bpm: BPM_EN,
  keySignature: C_MAJOR,
  difficultyLevel: 5,
  notes: lessonEighthNotesNotes,
};

// Lesson 6 — C Major Scale ────────────────────────────────────────────────────

const BPM3 = 80;
const BEAT3 = (60 / BPM3) * 1000;
const SCALE_UP   = [60, 62, 64, 65, 67, 69, 71, 72];
const SCALE_DOWN = [...SCALE_UP].reverse();

export const lesson3: LessonSong = {
  id: 'c-major-3',
  title: 'Lesson 6 — The C Major Scale',
  bpm: BPM3,
  keySignature: C_MAJOR,
  difficultyLevel: 6,
  notes: [
    ...SCALE_UP.map((note, i)  => ({ id: id(3, i),                    note, targetTimestamp: i * BEAT3,                          durationMs: BEAT3 * 0.85, targetVelocity: 64 })),
    ...SCALE_DOWN.map((note, i) => ({ id: id(3, SCALE_UP.length + i),  note, targetTimestamp: (SCALE_UP.length + 1 + i) * BEAT3,  durationMs: BEAT3 * 0.85, targetVelocity: 64 })),
  ],
};

// Lesson 7 — Mary Had a Little Lamb ──────────────────────────────────────────

const BPM4 = 80;
const BEAT4 = (60 / BPM4) * 1000;
const MARY_NOTES = [64,62,60,62,64,64,64, 62,62,62, 64,67,67, 64,62,60,62,64,64,64, 62,62,64,62,60];
const MARY_DUR   = [1,1,1,1,1,1,2, 1,1,2, 1,1,2, 1,1,1,1,1,1,2, 1,1,1,1,2];
const MARY_VEL   = [72,64,72,64,80,72,80, 64,64,72, 72,72,80, 72,64,72,64,80,72,80, 64,64,72,64,80];

export const lesson4: LessonSong = {
  id: 'c-major-4',
  title: 'Lesson 7 — Mary Had a Little Lamb',
  bpm: BPM4,
  keySignature: C_MAJOR,
  difficultyLevel: 7,
  notes: buildNotes(4, MARY_NOTES, MARY_DUR, MARY_VEL, BEAT4),
};

// Lesson 8 — Ode to Joy (4-bar) ───────────────────────────────────────────────

const BPM5 = 80;
const BEAT5 = (60 / BPM5) * 1000;
const ODE_NOTES = [64,64,65,67, 67,65,64,62, 60,60,62,64, 64,62,62];
const ODE_DUR   = [1,1,1,1, 1,1,1,1, 1,1,1,1, 1.5,0.5,2];
const ODE_VEL   = [72,72,72,80, 80,72,80,72, 72,72,72,80, 80,72,80];

export const lesson5: LessonSong = {
  id: 'c-major-5',
  title: 'Lesson 8 — Ode to Joy (4-bar)',
  bpm: BPM5,
  keySignature: C_MAJOR,
  difficultyLevel: 8,
  notes: buildNotes(5, ODE_NOTES, ODE_DUR, ODE_VEL, BEAT5),
};

// ─── Section 2: Two Hands ─────────────────────────────────────────────────────

// Lesson 9 — Hands Together: Basic Coordination ───────────────────────────────
// Phase 1: LH steady C3, RH plays C major scale up/down.
// Phase 2: LH alternates C3/G3, RH plays E–D–C melody.
// Phase 3: LH steady C3, RH plays C–E–G–E arpeggio.

const BPM_HT = 72;
const BEAT_HT = (60 / BPM_HT) * 1000;

const HT_RH: Array<[number, number, number, number]> = [
  [60,0,1,70],[62,1,1,70],[64,2,1,70],[65,3,1,70],[67,4,1,70],[65,5,1,70],[64,6,1,70],[62,7,1,70],[60,8,2,70],
  [64,12,2,72],[62,14,2,68],[60,16,2,72],
  [60,20,1,68],[64,21,1,68],[67,22,1,68],[64,23,1,68],[60,24,1,68],[64,25,1,68],[67,26,1,68],[64,27,1,68],[60,28,2,68],
];
const HT_LH: Array<[number, number, number, number]> = [
  [48,0,1,56],[48,1,1,56],[48,2,1,56],[48,3,1,56],[48,4,1,56],[48,5,1,56],[48,6,1,56],[48,7,1,56],[48,8,1,56],[48,9,1,56],
  [48,12,1,56],[55,13,1,56],[48,14,1,56],[55,15,1,56],[48,16,1,56],[55,17,1,56],
  [48,20,1,56],[48,21,1,56],[48,22,1,56],[48,23,1,56],[48,24,1,56],[48,25,1,56],[48,26,1,56],[48,27,2,56],
];

export const lessonHandsTogether: LessonSong = {
  id: 'technique-hands-together',
  title: 'Lesson 9 — Hands Together (Basic Coordination)',
  bpm: BPM_HT,
  keySignature: C_MAJOR,
  difficultyLevel: 9,
  notes: twoHandNotes('HT', BEAT_HT, HT_RH, HT_LH),
};

// Lesson 10 — Alberti Bass ────────────────────────────────────────────────────
// The classic piano accompaniment pattern: C3-G3-E3-G3 (root-fifth-third-fifth).
// RH holds half-note melody while LH plays the rolling eighth-note pattern.

const BPM_ALB = 88;
const BEAT_ALB = (60 / BPM_ALB) * 1000;

const ALB_RH: Array<[number, number, number, number]> = [
  [60,0,2,72],[64,2,2,72],[67,4,2,72],[64,6,2,72],[60,8,4,72],
];
const ALB_LH: Array<[number, number, number, number]> = [
  // C3-G3-E3-G3 pattern as eighth notes (0.5 beats each) × 24 notes = 12 beats
  [48,0,0.5,56],[55,0.5,0.5,48],[52,1,0.5,48],[55,1.5,0.5,48],
  [48,2,0.5,56],[55,2.5,0.5,48],[52,3,0.5,48],[55,3.5,0.5,48],
  [48,4,0.5,56],[55,4.5,0.5,48],[52,5,0.5,48],[55,5.5,0.5,48],
  [48,6,0.5,56],[55,6.5,0.5,48],[52,7,0.5,48],[55,7.5,0.5,48],
  [48,8,0.5,56],[55,8.5,0.5,48],[52,9,0.5,48],[55,9.5,0.5,48],
  [48,10,0.5,56],[55,10.5,0.5,48],[52,11,0.5,48],[55,11.5,0.5,48],
];

export const lessonAlberti: LessonSong = {
  id: 'technique-alberti',
  title: 'Lesson 10 — Alberti Bass',
  bpm: BPM_ALB,
  keySignature: C_MAJOR,
  difficultyLevel: 10,
  notes: twoHandNotes('ALB', BEAT_ALB, ALB_RH, ALB_LH),
};

// Lesson 11 — Lightly Row (Two Hands) ─────────────────────────────────────────
// RH: ABA' melody. LH: whole-note bass (C3 / G3). 64 beats total.

const BPM_LR = 84;
const BEAT_LR = (60 / BPM_LR) * 1000;

const LR_RH: Array<[number, number, number, number]> = [
  [67,0,1,72],[67,1,1,68],[65,2,1,68],[64,3,1,68],[64,4,1,68],[62,5,1,68],[60,6,1,72],[64,7,1,68],[67,8,4,72],
  [67,12,1,72],[67,13,1,68],[65,14,1,68],[64,15,1,68],[64,16,1,68],[62,17,1,68],[60,18,6,72],
  [62,24,1,68],[62,25,1,68],[62,26,1,68],[62,27,1,68],[62,28,1,68],[64,29,1,72],[65,30,2,68],
  [64,32,1,68],[64,33,1,68],[64,34,1,68],[64,35,1,68],[64,36,1,68],[65,37,1,72],[67,38,2,68],
  [67,40,1,72],[67,41,1,68],[65,42,1,68],[64,43,1,68],[64,44,1,68],[62,45,1,68],[60,46,1,72],[64,47,1,68],[67,48,4,72],
  [67,52,1,72],[67,53,1,68],[65,54,1,68],[64,55,1,68],[64,56,1,68],[62,57,1,68],[60,58,6,72],
];
const LR_LH: Array<[number, number, number, number]> = [
  [48,0,4,52],[48,4,4,52],[48,8,4,52],[48,12,4,52],[55,16,4,52],[48,20,4,52],
  [55,24,4,52],[55,28,4,52],[55,32,4,52],[55,36,4,52],
  [48,40,4,52],[48,44,4,52],[48,48,4,52],[48,52,4,52],[55,56,4,52],[48,60,4,52],
];

export const lessonLightlyRow: LessonSong = {
  id: 'song-lightly-row',
  title: 'Lesson 11 — Lightly Row (Two Hands)',
  bpm: BPM_LR,
  keySignature: C_MAJOR,
  difficultyLevel: 11,
  notes: twoHandNotes('LR', BEAT_LR, LR_RH, LR_LH),
};

// Lesson 12 — When the Saints Go Marching In (Two Hands) ──────────────────────
// RH: quarter-note melody. LH: half-note bass. 8 bars × 4 beats = 32 beats.

const BPM_WS = 96;
const BEAT_WS = (60 / BPM_WS) * 1000;

const WS_RH: Array<[number, number, number, number]> = [
  [60,0,1,76],[64,1,1,72],[65,2,1,72],[67,3,1,72],
  [60,4,1,76],[64,5,1,72],[65,6,1,72],[67,7,1,72],
  [60,8,1,76],[64,9,1,72],[65,10,1,72],[67,11,1,72],
  [64,12,1,72],[60,13,1,72],[64,14,1,72],[62,15,1,72],
  [60,16,1,76],[64,17,1,72],[67,18,1,72],[67,19,1,72],
  [65,20,1,72],[65,21,1,72],[65,22,1,72],[64,23,1,72],
  [65,24,1,72],[67,25,1,72],[60,26,1,76],[62,27,1,72],
  [60,28,4,76],
];
const WS_LH: Array<[number, number, number, number]> = [
  [48,0,2,52],[48,2,2,52],[48,4,2,52],[48,6,2,52],
  [48,8,2,52],[48,10,2,52],[55,12,2,52],[55,14,2,52],
  [48,16,2,52],[48,18,2,52],[48,20,2,52],[48,22,2,52],
  [55,24,2,52],[55,26,2,52],[48,28,4,52],
];

export const lessonSaints: LessonSong = {
  id: 'song-when-the-saints',
  title: 'Lesson 12 — When the Saints Go Marching In (Two Hands)',
  bpm: BPM_WS,
  keySignature: C_MAJOR,
  difficultyLevel: 12,
  notes: twoHandNotes('WS', BEAT_WS, WS_RH, WS_LH),
};

// Lesson 13 — Ode to Joy with Moving Bass ─────────────────────────────────────
// Familiar melody (already learned) — now add a quarter-note bass that actually
// moves with the harmony instead of just sitting on C.

const BPM_OB = 80;
const BEAT_OB = (60 / BPM_OB) * 1000;

const OB_RH = buildNotes('OB-R', ODE_NOTES, ODE_DUR, ODE_VEL, BEAT_OB);
// LH: 16 quarter notes outlining C and G chord roots
const OB_LH_NOTES = [48,48,55,55, 55,55,55,48, 48,48,55,55, 48,55,48,48];
const OB_LH = OB_LH_NOTES.map((note, i) => ({
  id: `OB-L${i}`,
  note,
  targetTimestamp: i * BEAT_OB,
  durationMs: BEAT_OB * 0.85,
  targetVelocity: 52,
}));

export const lessonOdeBass: LessonSong = {
  id: 'song-ode-bass',
  title: 'Lesson 13 — Ode to Joy with Moving Bass (Two Hands)',
  bpm: BPM_OB,
  keySignature: C_MAJOR,
  difficultyLevel: 13,
  notes: [...OB_RH, ...OB_LH].sort((a, b) => a.targetTimestamp - b.targetTimestamp || a.note - b.note),
};

// Lesson 14 — Minuet in G (Two Hands) ─────────────────────────────────────────
// Petzold Minuet in G, simplified first 8 bars. 3/4 time — introduces waltz meter.

const BPM_MG = 108;
const BEAT_MG = (60 / BPM_MG) * 1000;

const MG_RH: Array<[number, number, number, number]> = [
  [74,0,1,76],[67,1,1,68],[69,2,1,68],
  [71,3,1,76],[72,4,1,68],[74,5,1,68],
  [76,6,1,68],[74,7,1,68],[72,8,1,68],
  [71,9,2,76],[71,11,1,68],
  [72,12,1,76],[74,13,1,68],[76,14,1,68],
  [78,15,1,76],[76,16,1,68],[74,17,1,68],
  [79,18,1,68],[76,19,1,68],[74,20,1,68],
  [67,21,3,76],
];
const MG_LH: Array<[number, number, number, number]> = [
  [55,0,3,52],[50,3,3,52],[55,6,3,52],[55,9,3,52],
  [48,12,3,52],[50,15,3,52],[55,18,3,52],[55,21,3,52],
];

export const lessonMinuetG: LessonSong = {
  id: 'song-minuet-g',
  title: 'Lesson 14 — Minuet in G (Two Hands)',
  bpm: BPM_MG,
  keySignature: G_MAJOR,
  difficultyLevel: 14,
  notes: twoHandNotes('MG', BEAT_MG, MG_RH, MG_LH),
};

// Lesson 15 — Twinkle Twinkle Little Star ─────────────────────────────────────

const BPM6 = 90;
const BEAT6 = (60 / BPM6) * 1000;
const TWINKLE_NOTES = [
  60,60,67,67,69,69,67, 65,65,64,64,62,62,60,
  67,67,65,65,64,64,62, 67,67,65,65,64,64,62,
  60,60,67,67,69,69,67, 65,65,64,64,62,62,60,
];
const TWINKLE_DUR = [
  1,1,1,1,1,1,2, 1,1,1,1,1,1,2,
  1,1,1,1,1,1,2, 1,1,1,1,1,1,2,
  1,1,1,1,1,1,2, 1,1,1,1,1,1,2,
];

export const lesson6: LessonSong = {
  id: 'c-major-6',
  title: 'Lesson 15 — Twinkle Twinkle Little Star',
  bpm: BPM6,
  keySignature: C_MAJOR,
  difficultyLevel: 15,
  notes: buildNotes(6, TWINKLE_NOTES, TWINKLE_DUR, TWINKLE_NOTES.map(() => 68), BEAT6),
};

// ─── Section 3: Advanced ──────────────────────────────────────────────────────

// Lesson 16 — Block Chords (C, G, F Major) ────────────────────────────────────
// First lesson with chords — press C+E+G simultaneously.
// Two passes through C → G → F → C. Each chord held 2 beats, 1 beat rest.

const BPM_BC = 72;
const BEAT_BC = (60 / BPM_BC) * 1000;

const CHORD_DEFS = [
  [60, 64, 67],  // C major (C4 E4 G4)
  [67, 71, 74],  // G major (G4 B4 D5)
  [65, 69, 72],  // F major (F4 A4 C5)
  [60, 64, 67],  // C major (return)
];

const lessonBlockChordsNotes: LessonSong['notes'] = [];
CHORD_DEFS.forEach((pitches, ci) => {
  pitches.forEach((note, ni) => {
    lessonBlockChordsNotes.push({ id: `BC-1-${ci}-${ni}`, note, targetTimestamp: ci * 3 * BEAT_BC, durationMs: 2 * BEAT_BC * 0.85, targetVelocity: 76 });
    const dur = ci === 3 ? 4 : 2;
    lessonBlockChordsNotes.push({ id: `BC-2-${ci}-${ni}`, note, targetTimestamp: (12 + ci * 3) * BEAT_BC, durationMs: dur * BEAT_BC * 0.85, targetVelocity: 76 });
  });
});
lessonBlockChordsNotes.sort((a, b) => a.targetTimestamp - b.targetTimestamp || a.note - b.note);

export const lessonBlockChords: LessonSong = {
  id: 'technique-block-chords',
  title: 'Lesson 16 — Block Chords (C · G · F)',
  bpm: BPM_BC,
  keySignature: C_MAJOR,
  difficultyLevel: 16,
  notes: lessonBlockChordsNotes,
};

// Lesson 17 — Dotted Rhythms ──────────────────────────────────────────────────
// Dotted quarter + eighth pairs. Prepares students for Frère Jacques.

const BPM_R2 = 88;
const BEAT_R2 = (60 / BPM_R2) * 1000;

export const lessonDotted: LessonSong = {
  id: 'technique-dotted',
  title: 'Lesson 17 — Dotted Rhythms (♩. ♪)',
  bpm: BPM_R2,
  keySignature: C_MAJOR,
  difficultyLevel: 17,
  notes: buildNotes('R2',
    [60,62, 64,62, 64,65, 67, 67,65, 64,62, 60,62, 60],
    [1.5,0.5, 1.5,0.5, 1.5,0.5, 2, 1.5,0.5, 1.5,0.5, 1.5,0.5, 4],
    [60,62,64,62,64,65,67,67,65,64,62,60,62,60].map((_, i) => i % 2 === 0 ? 76 : 60),
    BEAT_R2,
  ),
};

// Lesson 18 — Walking Bass ────────────────────────────────────────────────────
// Contrary motion: LH walks C→G (up), RH descends E→C. Then reverse.
// Trains true independence — each hand moves in opposite directions simultaneously.

const BPM_WB = 84;
const BEAT_WB = (60 / BPM_WB) * 1000;

const WB_RH: Array<[number, number, number, number]> = [
  // Pass 1: RH descends while LH ascends
  [64,0,1,72],[62,1,1,68],[60,2,1,72],[62,3,1,68],[64,4,1,72],
  // Pass 1 reversed: RH ascends while LH descends
  [60,5,1,72],[62,6,1,68],[64,7,1,72],[65,8,1,68],[67,9,1,72],
  // Pass 2 (repeat)
  [64,10,1,72],[62,11,1,68],[60,12,1,72],[62,13,1,68],[64,14,1,72],
  [60,15,1,72],[62,16,1,68],[64,17,1,72],[65,18,1,68],[67,19,4,76],
];
const WB_LH: Array<[number, number, number, number]> = [
  [48,0,1,56],[50,1,1,52],[52,2,1,52],[53,3,1,52],[55,4,1,52],
  [55,5,1,52],[53,6,1,52],[52,7,1,52],[50,8,1,52],[48,9,1,52],
  [48,10,1,56],[50,11,1,52],[52,12,1,52],[53,13,1,52],[55,14,1,52],
  [55,15,1,52],[53,16,1,52],[52,17,1,52],[50,18,1,52],[48,19,4,56],
];

export const lessonWalkingBass: LessonSong = {
  id: 'technique-walking-bass',
  title: 'Lesson 18 — Walking Bass (Contrary Motion)',
  bpm: BPM_WB,
  keySignature: C_MAJOR,
  difficultyLevel: 18,
  notes: twoHandNotes('WB', BEAT_WB, WB_RH, WB_LH),
};

// Lesson 19 — Frère Jacques ───────────────────────────────────────────────────

const BPM7 = 90;
const BEAT7 = (60 / BPM7) * 1000;
const FRERE_NOTES = [
  60,62,64,60, 60,62,64,60, 64,65,67, 64,65,67,
  67,69,67,65,64,60, 67,69,67,65,64,60, 60,55,60, 60,55,60,
];
const FRERE_DUR = [
  1,1,1,1, 1,1,1,1, 1,1,2, 1,1,2,
  0.5,0.5,0.5,0.5,1,1, 0.5,0.5,0.5,0.5,1,1, 1,1,2, 1,1,2,
];
const FRERE_VEL = FRERE_NOTES.map((_, i) => i % 4 === 0 ? 76 : 64);

export const lesson7: LessonSong = {
  id: 'c-major-7',
  title: 'Lesson 19 — Frère Jacques',
  bpm: BPM7,
  keySignature: C_MAJOR,
  difficultyLevel: 19,
  notes: buildNotes(7, FRERE_NOTES, FRERE_DUR, FRERE_VEL, BEAT7),
};

// Lesson 20 — Frère Jacques (Two Hands) ───────────────────────────────────────
// Same melody as Lesson 19 but with LH half-note bass added.
// The G3 notes (55) in the final phrase are raised to G4 (67) to stay in the RH.

const BPM_FJT = 90;
const BEAT_FJT = (60 / BPM_FJT) * 1000;

const FRERE_TWO_NOTES = [...FRERE_NOTES];
FRERE_TWO_NOTES[27] = 67; // G3 → G4
FRERE_TWO_NOTES[30] = 67; // G3 → G4

const FJT_RH_BUILT = buildNotes('FJT-R', FRERE_TWO_NOTES, FRERE_DUR, FRERE_VEL, BEAT_FJT);

// LH: half-note bass (C3/G3) for 32 beats
const FJT_LH_PITCHES = [48,48,48,48, 48,48,48,48, 48,55,48,55, 55,55,55,48];
const FJT_LH = FJT_LH_PITCHES.map((note, i) => ({
  id: `FJT-L${i}`,
  note,
  targetTimestamp: i * 2 * BEAT_FJT,
  durationMs: 2 * BEAT_FJT * 0.85,
  targetVelocity: 52,
}));

export const lessonFrereTwo: LessonSong = {
  id: 'song-frere-two-hands',
  title: 'Lesson 20 — Frère Jacques (Two Hands)',
  bpm: BPM_FJT,
  keySignature: C_MAJOR,
  difficultyLevel: 20,
  notes: [...FJT_RH_BUILT, ...FJT_LH].sort((a, b) => a.targetTimestamp - b.targetTimestamp || a.note - b.note),
};

// Lesson 21 — Jingle Bells (chorus) ──────────────────────────────────────────

const BPM8 = 110;
const BEAT8 = (60 / BPM8) * 1000;
const JINGLE_NOTES = [64,64,64, 64,64,64, 64,67,60,62, 64, 65,65,65,65, 65,64,64, 67,67,65,62, 60];
const JINGLE_DUR   = [1,1,2, 1,1,2, 1,1,1,1, 4, 1,1,1,1, 1,1,2, 1,1,1,1, 4];

export const lesson8: LessonSong = {
  id: 'c-major-8',
  title: 'Lesson 21 — Jingle Bells (chorus)',
  bpm: BPM8,
  keySignature: C_MAJOR,
  difficultyLevel: 21,
  notes: buildNotes(8, JINGLE_NOTES, JINGLE_DUR, JINGLE_NOTES.map(() => 80), BEAT8),
};

// Lesson 22 — G Major Scale ───────────────────────────────────────────────────
// Introduces a second key with one sharp (F#). Scales with sharps feel different.

const BPM_GS = 84;
const BEAT_GS = (60 / BPM_GS) * 1000;
const G_SCALE_UP   = [67, 69, 71, 72, 74, 76, 78, 79];
const G_SCALE_DOWN = [...G_SCALE_UP].reverse();

export const lessonGScale: LessonSong = {
  id: 'technique-g-scale',
  title: 'Lesson 22 — G Major Scale',
  bpm: BPM_GS,
  keySignature: G_MAJOR,
  difficultyLevel: 22,
  notes: [
    ...G_SCALE_UP.map((note, i)   => ({ id: id('GS', i),                      note, targetTimestamp: i * BEAT_GS,                            durationMs: BEAT_GS * 0.85, targetVelocity: 64 })),
    ...G_SCALE_DOWN.map((note, i)  => ({ id: id('GS', G_SCALE_UP.length + i),  note, targetTimestamp: (G_SCALE_UP.length + 1 + i) * BEAT_GS,  durationMs: BEAT_GS * 0.85, targetVelocity: 64 })),
  ],
};

// Lesson 23 — A Natural Minor Scale ──────────────────────────────────────────
// A3→A4 and back. Introduces minor tonality before Für Elise.

const BPM_R3 = 72;
const BEAT_R3 = (60 / BPM_R3) * 1000;
const MINOR_UP   = [57, 59, 60, 62, 64, 65, 67, 69];
const MINOR_DOWN = [...MINOR_UP].reverse();

export const lessonMinor: LessonSong = {
  id: 'technique-minor',
  title: 'Lesson 23 — A Natural Minor Scale',
  bpm: BPM_R3,
  keySignature: A_MINOR,
  difficultyLevel: 23,
  notes: [
    ...MINOR_UP.map((note, i)   => ({ id: id('R3', i),                      note, targetTimestamp: i * BEAT_R3,                             durationMs: BEAT_R3 * 0.85, targetVelocity: 64 })),
    ...MINOR_DOWN.map((note, i)  => ({ id: id('R3', MINOR_UP.length + i),   note, targetTimestamp: (MINOR_UP.length + 1 + i) * BEAT_R3,     durationMs: BEAT_R3 * 0.85, targetVelocity: 64 })),
  ],
};

// Lesson 24 — Arpeggios (C, G, Am) ────────────────────────────────────────────
// Broken chords — C major, G major, A minor, each up and down.
// Direct preparation for the LH arpeggio pattern in Für Elise.

const BPM_ARP = 76;
const BEAT_ARP = (60 / BPM_ARP) * 1000;

export const lessonArpeggios: LessonSong = {
  id: 'technique-arpeggios',
  title: 'Lesson 24 — Arpeggios (C · G · Am)',
  bpm: BPM_ARP,
  keySignature: C_MAJOR,
  difficultyLevel: 24,
  notes: [
    // C major: up then down, last note held 3 beats
    {id:'ARP-0',note:60,targetTimestamp:0*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-1',note:64,targetTimestamp:1*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-2',note:67,targetTimestamp:2*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-3',note:72,targetTimestamp:3*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:72},
    {id:'ARP-4',note:72,targetTimestamp:4*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-5',note:67,targetTimestamp:5*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-6',note:64,targetTimestamp:6*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-7',note:60,targetTimestamp:7*BEAT_ARP,durationMs:3*BEAT_ARP*0.85,targetVelocity:72},
    // G major (starts at beat 10)
    {id:'ARP-8',note:67,targetTimestamp:10*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-9',note:71,targetTimestamp:11*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-10',note:74,targetTimestamp:12*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-11',note:79,targetTimestamp:13*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:72},
    {id:'ARP-12',note:79,targetTimestamp:14*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-13',note:74,targetTimestamp:15*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-14',note:71,targetTimestamp:16*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-15',note:67,targetTimestamp:17*BEAT_ARP,durationMs:3*BEAT_ARP*0.85,targetVelocity:72},
    // A minor (starts at beat 20)
    {id:'ARP-16',note:57,targetTimestamp:20*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-17',note:60,targetTimestamp:21*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-18',note:64,targetTimestamp:22*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-19',note:69,targetTimestamp:23*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:72},
    {id:'ARP-20',note:69,targetTimestamp:24*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-21',note:64,targetTimestamp:25*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-22',note:60,targetTimestamp:26*BEAT_ARP,durationMs:BEAT_ARP*0.85,targetVelocity:68},
    {id:'ARP-23',note:57,targetTimestamp:27*BEAT_ARP,durationMs:4*BEAT_ARP*0.85,targetVelocity:72},
  ],
};

// Lesson 25 — Für Elise (simplified) ─────────────────────────────────────────

const BPM9 = 72;
const BEAT9 = (60 / BPM9) * 1000;
const FUR_NOTES = [76,75,76,75,76,71,74,72, 69,60,64,69, 71,60,64,68, 69,60,64,69, 71,76,74,72, 60,60,64,67, 69,60,64,69];
const FUR_DUR   = FUR_NOTES.map(() => 0.5);
FUR_DUR[8]  = 1.5; FUR_DUR[12] = 1.5; FUR_DUR[16] = 1.5;
FUR_DUR[20] = 1.5; FUR_DUR[24] = 1.5; FUR_DUR[28] = 2;
const FUR_VEL = FUR_NOTES.map((_, i) => i === 0 ? 72 : 60);

export const lesson9: LessonSong = {
  id: 'c-major-9',
  title: 'Lesson 25 — Für Elise (simplified)',
  bpm: BPM9,
  keySignature: A_MINOR,
  difficultyLevel: 25,
  notes: buildNotes(9, FUR_NOTES, FUR_DUR, FUR_VEL, BEAT9),
};

// Lesson 26 — Für Elise (Two Hands) ──────────────────────────────────────────
// Same melody as Lesson 25 plus a simple A3/E3 alternating bass.
// Mirrors the actual Für Elise LH structure (A minor arpeggio roots).

const BPM_FET = 72;
const BEAT_FET = (60 / BPM_FET) * 1000;

const FET_RH = buildNotes('FET-R', FUR_NOTES, FUR_DUR, FUR_VEL, BEAT_FET);

// LH: A3(57) / E3(52) alternating half notes for ~23 beats
const FET_LH = [0,2,4,6,8,10,12,14,16,18,20,22].map((beat, i) => ({
  id: `FET-L${i}`,
  note: i % 2 === 0 ? 57 : 52,   // A3 / E3
  targetTimestamp: beat * BEAT_FET,
  durationMs: 2 * BEAT_FET * 0.85,
  targetVelocity: 52,
}));

export const lessonFurEliseTwo: LessonSong = {
  id: 'song-fur-elise-two-hands',
  title: 'Lesson 26 — Für Elise (Two Hands)',
  bpm: BPM_FET,
  keySignature: A_MINOR,
  difficultyLevel: 26,
  notes: [...FET_RH, ...FET_LH].sort((a, b) => a.targetTimestamp - b.targetTimestamp || a.note - b.note),
};

// Lesson 27 — Ode to Joy (full melody) ───────────────────────────────────────

const BPM10 = 96;
const BEAT10 = (60 / BPM10) * 1000;
const ODE_FULL_NOTES = [
  64,64,65,67, 67,65,64,62, 60,60,62,64, 64,62,62,
  64,64,65,67, 67,65,64,62, 60,60,62,64, 62,60,60,
  62,62,64,60, 62,64,65,64,60, 62,64,65,64,62, 60,62,67,
  64,64,65,67, 67,65,64,62, 60,60,62,64, 62,60,60,
];
const ODE_FULL_DUR = [
  1,1,1,1, 1,1,1,1, 1,1,1,1, 1.5,0.5,2,
  1,1,1,1, 1,1,1,1, 1,1,1,1, 1.5,0.5,2,
  1,1,1,1, 1,1,1,1,2, 1,1,1,1,2, 1,1,2,
  1,1,1,1, 1,1,1,1, 1,1,1,1, 1.5,0.5,2,
];
const ODE_FULL_VEL = ODE_FULL_NOTES.map((_, i) => Math.floor(i / 15) === 2 ? 80 : 72);

export const lesson10: LessonSong = {
  id: 'c-major-10',
  title: 'Lesson 27 — Ode to Joy (full melody)',
  bpm: BPM10,
  keySignature: D_MAJOR,
  difficultyLevel: 27,
  notes: buildNotes(10, ODE_FULL_NOTES, ODE_FULL_DUR, ODE_FULL_VEL, BEAT10),
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const CURRICULUM: LessonSong[] = [
  // ── Section 1: Single Hand Basics (indices 0–7) ───────────────────────────
  lesson1,              // Five-Finger Position       — 1
  lesson2,              // Expanding Fingers          — 2
  lessonLegatoStaccato, // Legato & Staccato          — 3
  lessonRhythm,         // Rhythm Basics              — 4
  lessonEighthNotes,    // Eighth Notes               — 5
  lesson3,              // C Major Scale              — 6
  lesson4,              // Mary Had a Little Lamb     — 7
  lesson5,              // Ode to Joy (4-bar)         — 8
  // ── Section 2: Two Hands (indices 8–14) ──────────────────────────────────
  lessonHandsTogether,  // Hands Together             — 9
  lessonAlberti,        // Alberti Bass               — 10
  lessonLightlyRow,     // Lightly Row                — 11
  lessonSaints,         // When the Saints            — 12
  lessonOdeBass,        // Ode to Joy + Moving Bass   — 13
  lessonMinuetG,        // Minuet in G                — 14
  lesson6,              // Twinkle Twinkle            — 15
  // ── Section 3: Advanced (indices 15–26) ──────────────────────────────────
  lessonBlockChords,    // Block Chords C·G·F         — 16
  lessonDotted,         // Dotted Rhythms             — 17
  lessonWalkingBass,    // Walking Bass               — 18
  lesson7,              // Frère Jacques              — 19
  lessonFrereTwo,       // Frère Jacques Two Hands    — 20
  lesson8,              // Jingle Bells               — 21
  lessonGScale,         // G Major Scale              — 22
  lessonMinor,          // A Natural Minor Scale      — 23
  lessonArpeggios,      // Arpeggios C·G·Am           — 24
  lesson9,              // Für Elise (simplified)     — 25
  lessonFurEliseTwo,    // Für Elise Two Hands        — 26
  lesson10,             // Ode to Joy (full)          — 27
];

/**
 * Visual scaffold phase per lesson index.
 * crutch:       full opaque falling notes (training wheels)
 * transition:   ghosted notes (building independence)
 * independence: nearly invisible notes (sheet music only)
 */
export const LESSON_SCAFFOLD = [
  // Section 1 — Single Hand Basics
  'crutch', 'crutch', 'crutch', 'crutch', 'crutch', 'crutch', 'crutch', 'crutch',
  // Section 2 — Two Hands
  'transition', 'transition', 'transition', 'transition', 'transition', 'transition', 'transition',
  // Section 3 — Advanced
  'independence', 'independence', 'independence', 'independence', 'independence',
  'independence', 'independence', 'independence', 'independence', 'independence',
  'independence', 'independence',
] as const;

/**
 * Section groupings for the lesson list UI.
 * `from` and `to` are inclusive indices into CURRICULUM.
 */
export const CURRICULUM_SECTIONS = [
  { title: 'Single Hand Basics', from: 0,  to: 7  },
  { title: 'Two Hands',          from: 8,  to: 14 },
  { title: 'Advanced',           from: 15, to: 26 },
] as const;

/** Score threshold (0–1) required to unlock the next lesson */
export const UNLOCK_THRESHOLD = 0.85;
