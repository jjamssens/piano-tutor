import type { LessonSong, FallingNote, NoteResult } from '../types/game.types';
import type { NoteNumber } from '../types/midi.types';


const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function midiNoteName(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

const CANVAS_HEIGHT = 500;
// How many ms of song are visible in the canvas at once
const LOOKAHEAD_MS = 2000;

const RESULT_COLORS: Record<NoteResult, string> = {
  'correct':    '#4ade80', // green-400
  'wrong-note': '#f87171', // red-400
  'too-early':  '#facc15', // yellow-400
  'too-late':   '#facc15',
  'missed':     '#6b7280', // gray-500
};

const NOTE_BASE_RGB = '129,140,248'; // indigo-400

const BLACK_KEY_OFFSETS = new Set([1, 3, 6, 8, 10]);

function isBlackKey(note: number): boolean {
  return BLACK_KEY_OFFSETS.has(note % 12);
}

/**
 * FallingNotesRenderer
 *
 * Canvas-based falling notes visualizer.
 * Runs its own RAF loop, independent of React.
 *
 * Accepts a getElapsedMs callback from GameEngine so note positions
 * stay frozen during Learn Mode pauses (clock stops advancing).
 *
 * Lane X positions are pre-computed in the constructor for O(1) lookup
 * during the render loop, avoiding repeated iteration over the key range.
 */
export class FallingNotesRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private song: LessonSong;
  private getElapsedMs: () => number;

  private ghostAlpha: number;
  private showNoteLabels: boolean;
  private keyboardRange: { min: number; max: number };

  private fallingNotes: FallingNote[] = [];
  private rafId: number | null = null;
  private isRunning = false;

  private laneWidth: number;
  private hitLineY: number;

  // Pre-computed: MIDI note → left-edge X position in canvas pixels
  private laneXByNote: Map<NoteNumber, number>;

  constructor(
    canvas: HTMLCanvasElement,
    song: LessonSong,
    getElapsedMs: () => number,
    ghostAlpha = 0,
    showNoteLabels = false,
    keyboardRange: { min: number; max: number } = { min: 36, max: 96 }
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('[FallingNotesRenderer] Could not get 2D canvas context.');

    this.canvas         = canvas;
    this.ctx            = ctx;
    this.song           = song;
    this.getElapsedMs   = getElapsedMs;
    this.ghostAlpha     = ghostAlpha;
    this.showNoteLabels = showNoteLabels;
    this.keyboardRange  = keyboardRange;

    const whiteKeyCount = this.countWhiteKeys();
    this.laneWidth = canvas.width / whiteKeyCount;
    this.hitLineY  = CANVAS_HEIGHT - 60;

    // Pre-compute lane positions once at construction
    this.laneXByNote = this.buildLaneXMap();

    this.buildFallingNotes();
  }

  // ─── Pre-computation ──────────────────────────────────────────────────────

  private countWhiteKeys(): number {
    let count = 0;
    for (let n = this.keyboardRange.min; n <= this.keyboardRange.max; n++) {
      if (!isBlackKey(n)) count++;
    }
    return count;
  }

  /**
   * Build a Map<NoteNumber, laneX> for every note in keyboard range.
   * O(n) once at construction; subsequent lookups are O(1).
   */
  private buildLaneXMap(): Map<NoteNumber, number> {
    const map = new Map<NoteNumber, number>();
    let whiteIndex = 0;

    for (let n = this.keyboardRange.min; n <= this.keyboardRange.max; n++) {
      if (isBlackKey(n)) {
        // Black key: centered in the gap after the previous white key
        map.set(n, whiteIndex * this.laneWidth - this.laneWidth * 0.25);
      } else {
        map.set(n, whiteIndex * this.laneWidth);
        whiteIndex++;
      }
    }
    return map;
  }

  // ─── Note Population ──────────────────────────────────────────────────────

  private buildFallingNotes(): void {
    this.fallingNotes = this.song.notes.map((sn) => ({
      scheduledNote: sn,
      y: -20,
      evaluated: false,
      result: null,
    }));
  }

  // ─── RAF Loop ─────────────────────────────────────────────────────────────

  start(): void {
    this.isRunning = true;
    this.rafId = requestAnimationFrame(this.tick.bind(this));
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick(): void {
    if (!this.isRunning) return;

    // getElapsedMs() is pause-aware — notes freeze during Learn Mode waits
    const elapsed = this.getElapsedMs();
    this.update(elapsed);
    this.draw();

    this.rafId = requestAnimationFrame(this.tick.bind(this));
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  private update(elapsedMs: number): void {
    for (const fn of this.fallingNotes) {
      const sn = fn.scheduledNote;
      // hitLineY when elapsed === targetTimestamp; negative when in future
      const msUntilTarget = sn.targetTimestamp - elapsedMs;
      fn.y = this.hitLineY - (msUntilTarget / LOOKAHEAD_MS) * this.hitLineY;
    }
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawLaneLines();
    this.drawHitLine();
    this.drawNotes();
  }

  private drawLaneLines(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;

    let x = 0;
    for (let note = this.keyboardRange.min; note <= this.keyboardRange.max; note++) {
      if (!isBlackKey(note)) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
        ctx.stroke();
        x += this.laneWidth;
      }
    }
  }

  private drawHitLine(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(99,102,241,0.8)';
    ctx.lineWidth = 2;

    ctx.shadowColor = '#6366f1';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.moveTo(0, this.hitLineY);
    ctx.lineTo(this.canvas.width, this.hitLineY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private drawNotes(): void {
    const ctx          = this.ctx;
    const noteHeightPx = this.showNoteLabels ? 18 : 12;

    for (const fn of this.fallingNotes) {
      const sn = fn.scheduledNote;

      if (fn.y < -noteHeightPx || fn.y > this.canvas.height + noteHeightPx) continue;

      const x = this.laneXByNote.get(sn.note);
      if (x === undefined) continue;

      const w = isBlackKey(sn.note) ? this.laneWidth * 0.5 : this.laneWidth - 2;

      let color: string;
      if (fn.result !== null) {
        color = RESULT_COLORS[fn.result];
      } else {
        // ghostAlpha: 0 = fully solid (crutch), 1 = invisible (independence)
        const opacity = 1 - this.ghostAlpha;
        color = `rgba(${NOTE_BASE_RGB},${opacity})`;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x + 1, fn.y - noteHeightPx / 2, w, noteHeightPx, 4);
      } else {
        ctx.rect(x + 1, fn.y - noteHeightPx / 2, w, noteHeightPx);
      }
      ctx.fill();

      // Note name label
      if (this.showNoteLabels && w > 10) {
        const label = midiNoteName(sn.note);
        ctx.fillStyle = fn.result !== null ? 'rgba(0,0,0,0.7)' : '#fff';
        ctx.font = `bold ${Math.min(10, w * 0.55)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 1 + w / 2, fn.y);
      }
    }
  }

  // ─── External API ─────────────────────────────────────────────────────────

  markResult(noteId: string, result: NoteResult): void {
    const fn = this.fallingNotes.find((n) => n.scheduledNote.id === noteId);
    if (fn) {
      fn.result    = result;
      fn.evaluated = true;
    }
  }

  setGhostAlpha(alpha: number): void {
    this.ghostAlpha = alpha;
  }

  setShowNoteLabels(show: boolean): void {
    this.showNoteLabels = show;
  }
}
