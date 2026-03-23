import { useEffect, useRef } from 'react';
import { FallingNotesRenderer } from '../engine/FallingNotesRenderer';
import { useMidiGameEngine } from '../hooks/useMidiGameEngine';
import { CountdownOverlay } from './CountdownOverlay';
import { useGameStore } from '../stores/useGameStore';
import { useMidiStore } from '../stores/useMidiStore';
import { LEAD_IN_MS } from '../types/game.types';

const CANVAS_WIDTH  = 900;
const CANVAS_HEIGHT = 500;

export function RhythmHero() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FallingNotesRenderer | null>(null);

  const keyboardRange = useMidiStore((s) => s.keyboardRange);

  const {
    activeSong,
    isPlaying,
    sessionPhase,
    timingWindowMs,
    learnMode,
    scaffoldPhase,
    songStartTime,
    tempoMultiplier,
    handMode,
    autoPlayEnabled,
    showNoteLabels,
    loopEnabled,
    loopRegion,
    beginSession,
    startSession,
    recordNoteScore,
    finalizeSession,
  } = useGameStore();

  // Build the "effective" song for hand separation and loop region
  const effectiveSong = (() => {
    if (!activeSong) return null;
    const songDuration = activeSong.notes.length > 0
      ? Math.max(...activeSong.notes.map((n) => n.targetTimestamp + n.durationMs))
      : 0;

    if (!loopEnabled || songDuration === 0) return activeSong;

    const startMs = loopRegion.startPct * songDuration;
    const endMs   = loopRegion.endPct   * songDuration;
    const filtered = activeSong.notes
      .filter((n) => n.targetTimestamp >= startMs && n.targetTimestamp <= endMs)
      .map((n) => ({ ...n, targetTimestamp: n.targetTimestamp - startMs }));

    return { ...activeSong, notes: filtered };
  })();

  const engineRef = useMidiGameEngine({
    song: effectiveSong,
    timingWindowMs,
    learnMode,
    isPlaying,
    songStartTime,
    tempoMultiplier,
    handMode,
    autoPlayEnabled,
    onScore: (score) => {
      recordNoteScore(score);
      rendererRef.current?.markResult(score.noteId, score.result);
    },
    onMiss: (missed) => {
      rendererRef.current?.markResult(missed.id, 'missed');
    },
  });

  // Create / destroy renderer when session starts
  useEffect(() => {
    if (!isPlaying || !effectiveSong || !canvasRef.current || !engineRef.current) return;

    // ghostAlpha drives note opacity: 0 = fully solid, 1 = invisible
    // Crutch: solid notes  |  Transition: clearly faded  |  Independence: near-invisible
    const ghostAlpha =
      scaffoldPhase === 'crutch'     ? 0    :
      scaffoldPhase === 'transition' ? 0.62 : 0.93;

    const renderer = new FallingNotesRenderer(
      canvasRef.current,
      effectiveSong,
      () => engineRef.current?.getElapsedMs() ?? 0,
      ghostAlpha,
      showNoteLabels,
      keyboardRange,
    );

    renderer.start();
    rendererRef.current = renderer;

    const songDurationMs = effectiveSong.notes.length > 0
      ? Math.max(...effectiveSong.notes.map((n) => n.targetTimestamp + n.durationMs))
      : 5000;

    // Divide by tempoMultiplier to get real-time duration at this speed
    const realDurationMs = songDurationMs / tempoMultiplier;
    const endTimer = setTimeout(() => finalizeSession(), realDurationMs + LEAD_IN_MS + 600);

    return () => {
      renderer.stop();
      clearTimeout(endTimer);
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, effectiveSong]);

  // Mid-session scaffold phase change
  useEffect(() => {
    if (!rendererRef.current) return;
    const alpha =
      scaffoldPhase === 'crutch'     ? 0    :
      scaffoldPhase === 'transition' ? 0.62 : 0.93;
    rendererRef.current.setGhostAlpha(alpha);
  }, [scaffoldPhase]);

  // Mid-session note label toggle
  useEffect(() => {
    rendererRef.current?.setShowNoteLabels(showNoteLabels);
  }, [showNoteLabels]);

  // Loop: auto-restart after session finishes
  useEffect(() => {
    if (sessionPhase === 'finished' && loopEnabled && activeSong) {
      const timer = setTimeout(() => startSession(), 800);
      return () => clearTimeout(timer);
    }
  }, [sessionPhase, loopEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const showCountdown = sessionPhase === 'countdown';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-xl border border-gray-700"
          style={{ maxWidth: '100%' }}
        />
        {showCountdown && <CountdownOverlay onComplete={beginSession} />}
      </div>

      {/* Loop region sliders */}
      {loopEnabled && activeSong && (
        <LoopSlider song={activeSong} />
      )}

      {sessionPhase === 'idle' && (
        <p className="text-gray-500 text-sm">Select a lesson and press Play to start.</p>
      )}
      {learnMode && isPlaying && (
        <p className="text-violet-400 text-sm">
          Learn Mode — song pauses until you play the correct key.
        </p>
      )}
      {loopEnabled && isPlaying && (
        <p className="text-amber-400 text-sm">
          Loop Mode — section loops automatically.
        </p>
      )}
    </div>
  );
}

// ─── Loop Slider ──────────────────────────────────────────────────────────────

import type { LessonSong } from '../types/game.types';

function LoopSlider({ song }: { song: LessonSong }) {
  const { loopRegion, setLoopRegion, isPlaying } = useGameStore();

  return (
    <div className="w-full max-w-[900px] px-2">
      <div className="bg-gray-800 rounded-lg p-3 flex flex-col gap-2">
        <p className="text-xs text-gray-400 font-medium">Loop Section</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-10 text-right">
            {Math.round(loopRegion.startPct * 100)}%
          </span>
          <input
            type="range" min={0} max={100} step={1}
            value={Math.round(loopRegion.startPct * 100)}
            disabled={isPlaying}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setLoopRegion({ startPct: Math.min(v, loopRegion.endPct - 0.05), endPct: loopRegion.endPct });
            }}
            className="flex-1 accent-amber-400"
          />
          <span className="text-xs text-gray-400">Start</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-10 text-right">
            {Math.round(loopRegion.endPct * 100)}%
          </span>
          <input
            type="range" min={0} max={100} step={1}
            value={Math.round(loopRegion.endPct * 100)}
            disabled={isPlaying}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setLoopRegion({ startPct: loopRegion.startPct, endPct: Math.max(v, loopRegion.startPct + 0.05) });
            }}
            className="flex-1 accent-amber-400"
          />
          <span className="text-xs text-gray-400">End</span>
        </div>
      </div>
    </div>
  );
}
