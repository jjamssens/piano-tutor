import type { NoteNumber } from './midi.types';

// ─── Difficulty ────────────────────────────────────────────────────────────────

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export const TIMING_WINDOWS: Record<DifficultyLevel, number> = {
  beginner:     200, // ±200ms
  intermediate: 100, // ±100ms
  advanced:      50, // ±50ms
};

export const VELOCITY_BONUS_MAX_MS = 30;

// ─── Lesson / Song ────────────────────────────────────────────────────────

export type GameMode = 'rhythm-hero' | 'master-class';

export type ScaffoldPhase = 'crutch' | 'transition' | 'independence';

/** Right hand plays notes >= HAND_SPLIT_NOTE; left plays notes below */
export type HandMode = 'both' | 'right' | 'left';
export const HAND_SPLIT_NOTE = 60; // Middle C (C4)

/** Tempo speed presets (fraction of original BPM) */
export const TEMPO_PRESETS = [0.5, 0.75, 1.0, 1.25] as const;
export type TempoMultiplier = (typeof TEMPO_PRESETS)[number];

export interface ScheduledNote {
  id: string;
  note: NoteNumber;
  targetTimestamp: number;
  durationMs: number;
  targetVelocity: number;    // 0–127
}

export interface LessonSong {
  id: string;
  title: string;
  bpm: number;
  keySignature: KeySignatureSpec;
  notes: ScheduledNote[];
  difficultyLevel?: number;  // 1–10
}

export interface KeySignatureSpec {
  root: string;
  mode: 'major' | 'minor';
  alteredPitches: Set<number>;
}

// ─── Loop Region ──────────────────────────────────────────────────────────────

export interface LoopRegion {
  startPct: number;  // 0–1, fraction of song duration
  endPct: number;    // 0–1
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface SongProgress {
  songId: string;
  bestScore: number;    // 0–1
  attempts: number;
  completedAt?: number; // ms timestamp of best run
}

export interface OverallProgress {
  totalSessions: number;
  totalNotesHit: number;
  streak: number;
  lastSessionDate: string;      // 'YYYY-MM-DD'
  totalPracticeMinutes: number;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export type NoteResult = 'correct' | 'wrong-note' | 'too-early' | 'too-late' | 'missed';

export interface NoteScore {
  noteId: string;
  result: NoteResult;
  timingOffsetMs: number;
  timingAccuracy: number;
  velocityAccuracy: number;
  combinedScore: number;
}

export interface SessionStats {
  totalNotes: number;
  correct: number;
  wrongNote: number;
  missed: number;
  averageTimingAccuracy: number;
  averageVelocityAccuracy: number;
  averageCombinedScore: number;
}

// ─── Falling Notes ────────────────────────────────────────────────────────

export interface FallingNote {
  scheduledNote: ScheduledNote;
  y: number;
  evaluated: boolean;
  result: NoteResult | null;
}
