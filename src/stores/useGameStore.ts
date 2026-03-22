import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  DifficultyLevel,
  GameMode,
  HandMode,
  LessonSong,
  LoopRegion,
  NoteScore,
  OverallProgress,
  ScaffoldPhase,
  SessionStats,
  SongProgress,
  TempoMultiplier,
} from '../types/game.types';
import { TIMING_WINDOWS } from '../types/game.types';

export type SessionPhase = 'idle' | 'countdown' | 'playing' | 'finished';

// ─── localStorage helpers ─────────────────────────────────────────────────────

const SONG_PROGRESS_KEY    = 'piano-tutor-song-progress';
const OVERALL_PROGRESS_KEY = 'piano-tutor-overall-progress';

function isValidSongProgress(v: unknown): v is SongProgress {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.songId    === 'string' &&
    typeof o.bestScore === 'number' && isFinite(o.bestScore) &&
    typeof o.attempts  === 'number' && isFinite(o.attempts)
  );
}

function loadSongProgress(): Record<string, SongProgress> {
  try {
    const raw = localStorage.getItem(SONG_PROGRESS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, SongProgress> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidSongProgress(val)) result[key] = val;
    }
    return result;
  } catch { return {}; }
}

function saveSongProgress(p: Record<string, SongProgress>): void {
  try { localStorage.setItem(SONG_PROGRESS_KEY, JSON.stringify(p)); } catch { /* quota */ }
}

const DEFAULT_OVERALL: OverallProgress = {
  totalSessions: 0,
  totalNotesHit: 0,
  streak: 0,
  lastSessionDate: '',
  totalPracticeMinutes: 0,
};

function loadOverallProgress(): OverallProgress {
  try {
    const raw = localStorage.getItem(OVERALL_PROGRESS_KEY);
    if (!raw) return DEFAULT_OVERALL;
    const p = JSON.parse(raw) as Partial<OverallProgress>;
    // Validate and clamp every field — never trust raw storage values
    return {
      totalSessions:        Math.max(0, isFinite(p.totalSessions        ?? NaN) ? p.totalSessions!        : 0),
      totalNotesHit:        Math.max(0, isFinite(p.totalNotesHit        ?? NaN) ? p.totalNotesHit!        : 0),
      streak:               Math.max(0, isFinite(p.streak               ?? NaN) ? p.streak!               : 0),
      lastSessionDate:      typeof p.lastSessionDate === 'string'                ? p.lastSessionDate        : '',
      totalPracticeMinutes: Math.max(0, isFinite(p.totalPracticeMinutes ?? NaN) ? p.totalPracticeMinutes! : 0),
    };
  } catch { return DEFAULT_OVERALL; }
}

function saveOverallProgress(p: OverallProgress): void {
  try { localStorage.setItem(OVERALL_PROGRESS_KEY, JSON.stringify(p)); } catch { /* quota */ }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface GameStoreState {
  mode: GameMode;
  difficulty: DifficultyLevel;
  timingWindowMs: number;
  scaffoldPhase: ScaffoldPhase;
  learnMode: boolean;
  tempoMultiplier: TempoMultiplier;
  handMode: HandMode;
  showNoteLabels: boolean;
  loopEnabled: boolean;
  loopRegion: LoopRegion;
  activeSong: LessonSong | null;
  isPlaying: boolean;
  sessionPhase: SessionPhase;
  songStartTime: number | null;
  noteScores: NoteScore[];
  sessionStats: SessionStats | null;
  songProgress: Record<string, SongProgress>;
  overallProgress: OverallProgress;

  setMode: (mode: GameMode) => void;
  setDifficulty: (level: DifficultyLevel) => void;
  setScaffoldPhase: (phase: ScaffoldPhase) => void;
  setLearnMode: (enabled: boolean) => void;
  setTempoMultiplier: (t: TempoMultiplier) => void;
  setHandMode: (mode: HandMode) => void;
  setShowNoteLabels: (show: boolean) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (region: LoopRegion) => void;
  loadSong: (song: LessonSong) => void;
  startSession: () => void;
  beginSession: () => void;
  stopSession: () => void;
  recordNoteScore: (score: NoteScore) => void;
  finalizeSession: () => void;
  clearProgress: () => void;
}

export const useGameStore = create<GameStoreState>()(
  subscribeWithSelector((set, get) => ({
    mode: 'rhythm-hero',
    difficulty: 'beginner',
    timingWindowMs: TIMING_WINDOWS.beginner,
    scaffoldPhase: 'crutch',
    learnMode: false,
    tempoMultiplier: 1.0,
    handMode: 'both',
    showNoteLabels: false,
    loopEnabled: false,
    loopRegion: { startPct: 0, endPct: 1 },
    activeSong: null,
    isPlaying: false,
    sessionPhase: 'idle',
    songStartTime: null,
    noteScores: [],
    sessionStats: null,
    songProgress: loadSongProgress(),
    overallProgress: loadOverallProgress(),

    setMode: (mode) => set({ mode }),
    setDifficulty: (level) =>
      set({ difficulty: level, timingWindowMs: TIMING_WINDOWS[level] }),
    setScaffoldPhase: (phase) => set({ scaffoldPhase: phase }),
    setLearnMode: (enabled) => set({ learnMode: enabled }),
    setTempoMultiplier: (t) => set({ tempoMultiplier: t }),
    setHandMode: (mode) => set({ handMode: mode }),
    setShowNoteLabels: (show) => set({ showNoteLabels: show }),
    setLoopEnabled: (enabled) => set({ loopEnabled: enabled }),
    setLoopRegion: (region) => set({ loopRegion: region }),

    loadSong: (song) =>
      set({
        activeSong: song,
        noteScores: [],
        sessionStats: null,
        sessionPhase: 'idle',
        loopRegion: { startPct: 0, endPct: 1 },
      }),

    startSession: () =>
      set({ sessionPhase: 'countdown', noteScores: [], sessionStats: null }),

    beginSession: () =>
      set({ isPlaying: true, sessionPhase: 'playing', songStartTime: performance.now() }),

    stopSession: () =>
      set({ isPlaying: false, sessionPhase: 'idle' }),

    recordNoteScore: (score) =>
      set((s) => ({ noteScores: [...s.noteScores, score] })),

    finalizeSession: () => {
      const { noteScores, activeSong, songProgress, overallProgress } = get();
      if (!activeSong) return;

      const total     = activeSong.notes.length;
      const correct   = noteScores.filter((s) => s.result === 'correct').length;
      const wrongNote = noteScores.filter((s) => s.result === 'wrong-note').length;
      const missed    = total - noteScores.filter((s) => s.result !== 'wrong-note').length;

      const avg = (fn: (s: NoteScore) => number) =>
        noteScores.length > 0
          ? noteScores.reduce((acc, s) => acc + fn(s), 0) / noteScores.length
          : 0;

      const stats: SessionStats = {
        totalNotes: total,
        correct,
        wrongNote,
        missed,
        averageTimingAccuracy:   avg((s) => s.timingAccuracy),
        averageVelocityAccuracy: avg((s) => s.velocityAccuracy),
        averageCombinedScore:    avg((s) => s.combinedScore),
      };

      const existingProg = songProgress[activeSong.id];
      const isBestRun = stats.averageCombinedScore > (existingProg?.bestScore ?? 0);
      const updatedSongProgress: Record<string, SongProgress> = {
        ...songProgress,
        [activeSong.id]: {
          songId:      activeSong.id,
          bestScore:   isBestRun ? stats.averageCombinedScore : (existingProg?.bestScore ?? 0),
          attempts:    (existingProg?.attempts ?? 0) + 1,
          completedAt: isBestRun ? Date.now() : existingProg?.completedAt,
        },
      };
      saveSongProgress(updatedSongProgress);

      const today     = todayStr();
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const wasYesterday = overallProgress.lastSessionDate === yesterday;
      const isToday      = overallProgress.lastSessionDate === today;

      const updatedOverall: OverallProgress = {
        totalSessions:        overallProgress.totalSessions + 1,
        totalNotesHit:        overallProgress.totalNotesHit + correct,
        streak:               isToday      ? overallProgress.streak
                            : wasYesterday ? overallProgress.streak + 1
                            : 1,
        lastSessionDate:      today,
        totalPracticeMinutes: overallProgress.totalPracticeMinutes + Math.max(1, Math.round(total / 10)),
      };
      saveOverallProgress(updatedOverall);

      set({
        sessionStats:    stats,
        isPlaying:       false,
        sessionPhase:    'finished',
        songProgress:    updatedSongProgress,
        overallProgress: updatedOverall,
      });
    },

    clearProgress: () => {
      saveSongProgress({});
      saveOverallProgress(DEFAULT_OVERALL);
      set({ songProgress: {}, overallProgress: DEFAULT_OVERALL });
    },
  }))
);
