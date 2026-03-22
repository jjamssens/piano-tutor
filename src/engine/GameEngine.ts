import type { NoteEvent, NoteNumber } from '../types/midi.types';
import type {
  LessonSong,
  NoteResult,
  NoteScore,
  ScheduledNote,
} from '../types/game.types';
import { VELOCITY_BONUS_MAX_MS } from '../types/game.types';

type ScoreCallback  = (score: NoteScore) => void;
type MissCallback   = (note: ScheduledNote) => void;
type LightCallback  = (note: NoteNumber) => void;

/**
 * GameEngine
 *
 * Pure timing and scoring logic — no React, no canvas.
 * Consumed by both RhythmHero (canvas) and MasterClass (VexFlow).
 *
 * Accuracy formula:
 *   Accuracy = 1 - (|t_input - t_target| / Window_max)
 *
 * Effective timing window (velocity reward):
 *   effectiveWindow = baseWindow + (velocityAccuracy × VELOCITY_BONUS_MAX_MS)
 *
 * Combined score (0–1):
 *   combinedScore = (timingAccuracy × 0.7) + (velocityAccuracy × 0.3)
 *
 * Learn Mode:
 *   When enabled, the engine pauses at each note's target time and waits for
 *   the correct key. The song clock stops accumulating during the wait, so
 *   FallingNotesRenderer.getElapsedMs() returns frozen time. On correct input,
 *   the clock resumes and the next note advances normally.
 *
 * Keyboard Lighting:
 *   onLight fires when a note enters its timing window (approach cue).
 *   onUnlight fires on correct play, miss, or engine destroy.
 */
export class GameEngine {
  private song: LessonSong;
  private baseWindowMs: number;
  private learnMode: boolean;
  private songStartTime: number;
  private tempoMultiplier: number;

  private pendingByNote: Map<number, ScheduledNote[]> = new Map();
  private missCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Learn Mode pause state
  private pausedAt: number | null = null;
  private totalPausedMs = 0;
  private waitingNote: ScheduledNote | null = null;

  // Track which note IDs we've lit to avoid duplicate light calls
  private litNoteIds: Set<string> = new Set();

  private onScore:   ScoreCallback;
  private onMiss:    MissCallback;
  private onLight?:  LightCallback;
  private onUnlight?: LightCallback;

  constructor(
    song: LessonSong,
    baseWindowMs: number,
    learnMode: boolean,
    songStartTime: number,
    onScore: ScoreCallback,
    onMiss: MissCallback,
    onLight?: LightCallback,
    onUnlight?: LightCallback,
    tempoMultiplier = 1.0
  ) {
    this.song            = song;
    this.baseWindowMs    = baseWindowMs;
    this.learnMode       = learnMode;
    this.songStartTime   = songStartTime;
    this.onScore         = onScore;
    this.onMiss          = onMiss;
    this.onLight         = onLight;
    this.onUnlight       = onUnlight;
    this.tempoMultiplier = tempoMultiplier;

    this.buildPendingIndex();
    this.startMissDetection();
  }

  // ─── Pause-aware clock ────────────────────────────────────────────────────

  /**
   * Elapsed ms since song start, minus any time spent paused in Learn Mode.
   * FallingNotesRenderer uses this to position notes correctly during pauses.
   */
  getElapsedMs(): number {
    const rawElapsed = performance.now() - this.songStartTime;
    if (this.pausedAt !== null) {
      return (this.pausedAt - this.songStartTime - this.totalPausedMs) * this.tempoMultiplier;
    }
    return (rawElapsed - this.totalPausedMs) * this.tempoMultiplier;
  }

  private pause(): void {
    if (this.pausedAt === null) {
      this.pausedAt = performance.now();
    }
  }

  private resume(): void {
    if (this.pausedAt !== null) {
      this.totalPausedMs += performance.now() - this.pausedAt;
      this.pausedAt   = null;
      this.waitingNote = null;
    }
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  private buildPendingIndex(): void {
    for (const note of this.song.notes) {
      const existing = this.pendingByNote.get(note.note) ?? [];
      existing.push(note);
      existing.sort((a, b) => a.targetTimestamp - b.targetTimestamp);
      this.pendingByNote.set(note.note, existing);
    }
  }

  /**
   * Poll every 50ms to:
   *   1. Light keys that are entering their approach window
   *   2. Mark notes missed if their deadline passed (normal mode)
   *   3. Pause the clock at note target time (learn mode)
   */
  private startMissDetection(): void {
    this.missCheckInterval = setInterval(() => {
      const elapsed = this.getElapsedMs();

      for (const [, notes] of this.pendingByNote.entries()) {
        const surviving: ScheduledNote[] = [];

        for (const sn of notes) {
          // Light the key when the approach window opens (baseWindowMs before target)
          if (!this.litNoteIds.has(sn.id) && elapsed >= sn.targetTimestamp - this.baseWindowMs) {
            this.litNoteIds.add(sn.id);
            this.onLight?.(sn.note);
          }

          // Learn Mode: pause clock at target and wait for correct input
          if (this.learnMode && !this.waitingNote && elapsed >= sn.targetTimestamp) {
            this.waitingNote = sn;
            this.pause();
            surviving.push(sn);
            continue;
          }

          // Normal mode: mark note missed once past deadline
          if (!this.learnMode && elapsed > sn.targetTimestamp + this.baseWindowMs) {
            this.litNoteIds.delete(sn.id);
            this.onUnlight?.(sn.note);
            this.onMiss(sn);
          } else {
            surviving.push(sn);
          }
        }

        const noteNum = notes[0]?.note;
        if (noteNum !== undefined) {
          if (surviving.length > 0) {
            this.pendingByNote.set(noteNum, surviving);
          } else {
            this.pendingByNote.delete(noteNum);
          }
        }
      }
    }, 50);
  }

  // ─── Input Handling ───────────────────────────────────────────────────────

  processNoteEvent(event: NoteEvent): NoteScore | null {
    if (event.type !== 'noteOn') return null;

    const inputTime = this.getElapsedMs(); // pause-aware

    // ── Learn Mode: waiting for specific note ──────────────────────────────
    if (this.learnMode && this.waitingNote) {
      if (event.note === this.waitingNote.note) {
        const target = this.waitingNote;
        const velocityAccuracy = 1 - Math.abs(event.velocity - target.targetVelocity) / 127;
        const score: NoteScore = {
          noteId:           target.id,
          result:           'correct',
          timingOffsetMs:   0, // perfect by definition — we waited
          timingAccuracy:   1,
          velocityAccuracy,
          combinedScore:    0.7 + velocityAccuracy * 0.3,
        };
        const pendingForNote = this.pendingByNote.get(event.note);
        if (pendingForNote) {
          pendingForNote.shift();
          if (pendingForNote.length === 0) this.pendingByNote.delete(event.note);
        }
        this.litNoteIds.delete(target.id);
        this.onUnlight?.(target.note);
        this.resume();
        this.onScore(score);
        return score;
      } else {
        // Wrong note in learn mode — penalize but don't advance
        return this.scoreWrongNote(event);
      }
    }

    // ── Normal Mode ────────────────────────────────────────────────────────
    const pending = this.pendingByNote.get(event.note);
    if (!pending || pending.length === 0) {
      return this.scoreWrongNote(event);
    }

    const target           = pending[0];
    const velocityAccuracy = 1 - Math.abs(event.velocity - target.targetVelocity) / 127;
    const effectiveWindow  = this.baseWindowMs + velocityAccuracy * VELOCITY_BONUS_MAX_MS;
    const timingOffset     = inputTime - target.targetTimestamp;
    const absOffset        = Math.abs(timingOffset);

    let result:        NoteResult;
    let timingAccuracy: number;

    if (absOffset <= effectiveWindow) {
      result        = 'correct';
      timingAccuracy = 1 - absOffset / this.baseWindowMs;
    } else if (timingOffset < 0) {
      result        = 'too-early';
      timingAccuracy = 0;
    } else {
      result        = 'too-late';
      timingAccuracy = 0;
    }

    pending.shift();
    if (pending.length === 0) this.pendingByNote.delete(event.note);

    this.litNoteIds.delete(target.id);
    this.onUnlight?.(target.note);

    const score: NoteScore = {
      noteId:          target.id,
      result,
      timingOffsetMs:  timingOffset,
      timingAccuracy:  Math.max(0, timingAccuracy),
      velocityAccuracy,
      combinedScore:   Math.max(0, timingAccuracy) * 0.7 + velocityAccuracy * 0.3,
    };
    this.onScore(score);
    return score;
  }

  private scoreWrongNote(event: NoteEvent): NoteScore {
    const score: NoteScore = {
      noteId:          `wrong-${event.note}-${event.timestamp}`,
      result:          'wrong-note',
      timingOffsetMs:  0,
      timingAccuracy:  0,
      velocityAccuracy: 0,
      combinedScore:   0,
    };
    this.onScore(score);
    return score;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.missCheckInterval !== null) {
      clearInterval(this.missCheckInterval);
      this.missCheckInterval = null;
    }
    // Unlight any keys that were still lit when the session ended
    for (const [note] of this.pendingByNote.entries()) {
      this.onUnlight?.(note);
    }
  }
}
