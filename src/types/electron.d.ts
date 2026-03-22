/**
 * Renderer-side type declaration for the Electron context bridge API.
 * Declared optional — the same React code runs in a plain browser (dev mode).
 */

type BitMidiFetchResult =
  | { type: 'json'; data: unknown }
  | { type: 'binary'; data: string }    // base-64 encoded binary
  | { type: 'error'; message: string };

type MidiFileResult =
  | { data: string; name: string }       // base-64 encoded file + filename
  | { error: string };

interface ElectronAPI {
  fetchBitMidi:   (url: string)      => Promise<BitMidiFetchResult>;
  readMidiFile:   (filePath: string) => Promise<MidiFileResult>;
  onOpenMidiFile: (callback: (filePath: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
