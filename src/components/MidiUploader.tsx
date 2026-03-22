import { useRef, useState } from 'react';
import { parseMidiFile } from '../engine/MidiFileParser';
import { useMidiStore } from '../stores/useMidiStore';
import type { LessonSong } from '../types/game.types';

interface Props {
  onSongParsed: (song: LessonSong) => void;
}

type UploadState = 'idle' | 'dragging' | 'processing' | 'error';

/**
 * MidiUploader
 *
 * Drag-and-drop (or click-to-browse) file uploader for .mid / .midi files.
 * Parses the file via MidiFileParser and calls onSongParsed with the result.
 *
 * Notes about what happens to the file:
 *   - Notes outside C2–C7 are octave-shifted to fit the 61-key board
 *   - All tracks are merged into a single note sequence
 *   - Key signature and BPM are read from MIDI meta events when present
 */
export function MidiUploader({ onSongParsed }: Props) {
  const inputRef              = useRef<HTMLInputElement>(null);
  const [state, setState]     = useState<UploadState>('idle');
  const [errorMsg, setError]  = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<string | null>(null);

  const MAX_MIDI_BYTES = 5 * 1024 * 1024; // 5 MB — far above any real MIDI file

  const processFile = async (file: File) => {
    if (!file.name.match(/\.midi?$/i)) {
      setState('error');
      setError('Only .mid / .midi files are supported.');
      return;
    }
    if (file.size > MAX_MIDI_BYTES) {
      setState('error');
      setError('File is too large. MIDI files should be under 5 MB.');
      return;
    }

    setState('processing');
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const song   = parseMidiFile(buffer, file.name, keyboardRange);
      setLastFile(song.title);
      setState('idle');
      onSongParsed(song);
    } catch (err) {
      setState('error');
      setError((err as Error).message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  const isDragging   = state === 'dragging';
  const isProcessing = state === 'processing';

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload MIDI file"
        onDragOver={(e) => { e.preventDefault(); setState('dragging'); }}
        onDragLeave={() => setState('idle')}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2
          border-2 border-dashed rounded-xl p-6 cursor-pointer
          transition-colors select-none
          ${isDragging
            ? 'border-indigo-400 bg-indigo-950/50'
            : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/30'}
          ${isProcessing ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mid,.midi"
          className="hidden"
          onChange={handleChange}
        />

        {isProcessing ? (
          <>
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-indigo-400">Parsing MIDI file…</span>
          </>
        ) : (
          <>
            {/* Upload icon */}
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-sm text-gray-400">
              {isDragging ? 'Drop to upload' : 'Drop a .mid file or click to browse'}
            </p>
            <p className="text-xs text-gray-600">
              All tracks merged · Out-of-range notes octave-shifted to fit 61 keys
            </p>
          </>
        )}
      </div>

      {/* Feedback */}
      {state === 'error' && errorMsg && (
        <p className="text-red-400 text-xs mt-2 px-1">{errorMsg}</p>
      )}
      {lastFile && state === 'idle' && (
        <p className="text-green-400 text-xs mt-2 px-1">
          ✓ Added: <span className="font-medium">{lastFile}</span>
        </p>
      )}
    </div>
  );
}
