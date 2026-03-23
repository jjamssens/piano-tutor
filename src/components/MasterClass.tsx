import { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { useMidiGameEngine } from '../hooks/useMidiGameEngine';
import { CountdownOverlay } from './CountdownOverlay';
import { useGameStore } from '../stores/useGameStore';
import { LEAD_IN_MS } from '../types/game.types';
import type { NoteScore } from '../types/game.types';

function midiToVexPitch(midi: number): string {
  const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  const name   = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}/${octave}`;
}

/**
 * MasterClass
 *
 * VexFlow sheet music renderer with live note highlighting.
 *
 * Session flow mirrors RhythmHero: idle → countdown → playing → finished.
 *
 * VexFlow SVG highlighting:
 *   After voice.draw(), all .vf-stavenote elements are tagged with
 *   data-lesson-id in render order (same order notes were added to the Voice).
 *   applyHighlights() walks these elements and sets fill/stroke colors.
 */
export function MasterClass() {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightMap = useRef<Map<string, string>>(new Map());

  const {
    activeSong,
    isPlaying,
    sessionPhase,
    timingWindowMs,
    learnMode,
    songStartTime,
    tempoMultiplier,
    handMode,
    autoPlayEnabled,
    beginSession,
    recordNoteScore,
    finalizeSession,
  } = useGameStore();

  // Engine + MIDI + lighting — shared hook
  useMidiGameEngine({
    song: activeSong,
    timingWindowMs,
    learnMode,
    isPlaying,
    songStartTime,
    tempoMultiplier,
    handMode,
    autoPlayEnabled,
    onScore: (score: NoteScore) => {
      recordNoteScore(score);
      const color =
        score.result === 'correct'    ? '#4ade80' :
        score.result === 'wrong-note' ? '#f87171' :
                                        '#facc15';
      highlightMap.current.set(score.noteId, color);
      if (containerRef.current) applyHighlights(containerRef.current, highlightMap.current);
    },
    onMiss: (missed) => {
      highlightMap.current.set(missed.id, '#6b7280');
      if (containerRef.current) applyHighlights(containerRef.current, highlightMap.current);
    },
  });

  // ─── Song end timer ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying || !activeSong) return;
    const songDurationMs =
      Math.max(...activeSong.notes.map((n) => n.targetTimestamp + n.durationMs));
    const realDurationMs = songDurationMs / tempoMultiplier;
    const endTimer = setTimeout(() => finalizeSession(), realDurationMs + LEAD_IN_MS + 600);
    return () => clearTimeout(endTimer);
  }, [isPlaying, activeSong, finalizeSession]);

  // ─── Render staff whenever song changes ───────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || !activeSong) return;

    const container = containerRef.current;
    container.innerHTML = '';
    highlightMap.current.clear();

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(900, 200);
    const context = renderer.getContext();
    context.setFont('Arial', 10);

    const stave = new Stave(10, 40, 860);
    stave.addClef('treble');
    stave.addTimeSignature('4/4');
    stave.addKeySignature(activeSong.keySignature.root);
    stave.setContext(context).draw();

    // Build VexFlow notes with accidental handling
    const measureTracker = new Map<number, string>();

    const vexNotes = activeSong.notes.map((sn) => {
      const pitch      = midiToVexPitch(sn.note);
      const pitchClass = sn.note % 12;
      const pitchName  = pitch.split('/')[0];

      const staveNote = new StaveNote({
        keys: [pitch],
        duration: durationFromMs(sn.durationMs, activeSong.bpm),
      });

      const prevAccidental    = measureTracker.get(pitchClass);
      const isAlteredByKeySig = activeSong.keySignature.alteredPitches.has(pitchClass);
      const noteIsSharpOrFlat = pitchName.includes('#') || pitchName.includes('b');

      if (noteIsSharpOrFlat && !isAlteredByKeySig) {
        const acc = pitchName.includes('#') ? '#' : 'b';
        staveNote.addModifier(new Accidental(acc));
        measureTracker.set(pitchClass, acc);
      } else if (!noteIsSharpOrFlat && prevAccidental) {
        staveNote.addModifier(new Accidental('n'));
        measureTracker.delete(pitchClass);
      }

      return staveNote;
    });

    if (vexNotes.length > 0) {
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
      voice.addTickables(vexNotes);
      new Formatter().joinVoices([voice]).format([voice], 820);
      voice.draw(context, stave);
    }

    // Tag each .vf-stavenote by index → correlates with activeSong.notes order
    const noteEls = container.querySelectorAll<SVGElement>('.vf-stavenote');
    noteEls.forEach((el, i) => {
      const lessonNote = activeSong.notes[i];
      if (lessonNote) el.setAttribute('data-lesson-id', lessonNote.id);
    });
  }, [activeSong]);

  const showCountdown = sessionPhase === 'countdown';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div
          ref={containerRef}
          className="rounded-xl border border-gray-700 bg-white"
          style={{ width: 900, minHeight: 200, maxWidth: '100%' }}
        />
        {showCountdown && (
          <CountdownOverlay onComplete={beginSession} />
        )}
      </div>
      {!activeSong && (
        <p className="text-gray-500 text-sm">No lesson loaded.</p>
      )}
      {learnMode && isPlaying && (
        <p className="text-violet-400 text-sm">
          Learn Mode — song pauses until you play the correct key.
        </p>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyHighlights(container: HTMLElement, map: Map<string, string>): void {
  const noteEls = container.querySelectorAll<SVGElement>('[data-lesson-id]');
  for (const el of noteEls) {
    const id = el.getAttribute('data-lesson-id');
    if (id && map.has(id)) {
      el.style.fill   = map.get(id)!;
      el.style.stroke = map.get(id)!;
    }
  }
}

function durationFromMs(durationMs: number, bpm: number): string {
  const beatMs = (60 / bpm) * 1000;
  const beats  = durationMs / beatMs;
  if (beats >= 3.5)   return 'w';
  if (beats >= 1.75)  return 'h';
  if (beats >= 0.875) return 'q';
  return '8';
}
