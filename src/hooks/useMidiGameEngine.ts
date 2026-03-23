import { useEffect, useRef } from 'react';
import { GameEngine } from '../engine/GameEngine';
import { midiService } from '../services/MidiService';
import type { HandMode, LessonSong, NoteScore, ScheduledNote, TempoMultiplier } from '../types/game.types';
import { HAND_SPLIT_NOTE } from '../types/game.types';

interface UseMidiGameEngineOptions {
  song: LessonSong | null;
  timingWindowMs: number;
  learnMode: boolean;
  isPlaying: boolean;
  songStartTime: number | null;
  tempoMultiplier: TempoMultiplier;
  handMode: HandMode;
  autoPlayEnabled: boolean;
  onScore: (score: NoteScore) => void;
  onMiss: (note: ScheduledNote) => void;
}

/**
 * useMidiGameEngine
 *
 * Lifecycle wrapper for GameEngine shared by RhythmHero and MasterClass.
 *
 * - Filters song notes by handMode before passing to GameEngine
 * - Applies tempoMultiplier to the GameEngine clock
 * - Subscribes directly to midiService.onNoteEvent (real-time, not drain buffer)
 * - Wires LED lighting callbacks
 */
export function useMidiGameEngine({
  song,
  timingWindowMs,
  learnMode,
  isPlaying,
  songStartTime,
  tempoMultiplier,
  handMode,
  autoPlayEnabled,
  onScore,
  onMiss,
}: UseMidiGameEngineOptions) {
  const engineRef = useRef<GameEngine | null>(null);

  const onScoreRef = useRef(onScore);
  const onMissRef  = useRef(onMiss);
  onScoreRef.current = onScore;
  onMissRef.current  = onMiss;

  useEffect(() => {
    if (!isPlaying || !song || songStartTime === null) return;

    // ── Filter notes by hand mode ───────────────────────────────────────────
    let filteredNotes = song.notes;
    if (handMode === 'right') {
      filteredNotes = song.notes.filter((n) => n.note >= HAND_SPLIT_NOTE);
    } else if (handMode === 'left') {
      filteredNotes = song.notes.filter((n) => n.note < HAND_SPLIT_NOTE);
    }

    const effectiveSong: LessonSong = filteredNotes === song.notes
      ? song
      : { ...song, notes: filteredNotes };

    const engine = new GameEngine(
      effectiveSong,
      timingWindowMs,
      learnMode,
      songStartTime,
      (score) => onScoreRef.current(score),
      (missed) => onMissRef.current(missed),
      (note) => { if (autoPlayEnabled) midiService.lightKey(note); },
      (note) => midiService.unlightKey(note),
      tempoMultiplier,
    );

    const unsubMidi = midiService.onNoteEvent((evt) => {
      if (evt.type === 'noteOn') engine.processNoteEvent(evt);
    });

    engineRef.current = engine;

    return () => {
      unsubMidi();
      engine.destroy();
      midiService.unlightAll();
      engineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, song, songStartTime, timingWindowMs, learnMode, tempoMultiplier, handMode, autoPlayEnabled]);

  return engineRef;
}
