import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload — Context Bridge
 *
 * Exposes a typed, minimal API to the renderer.
 * Only what is explicitly listed here is accessible from window.electronAPI.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ── BitMidi proxy ──────────────────────────────────────────────────────
  fetchBitMidi: (url: string) => ipcRenderer.invoke('fetch-bitmidi', url),

  // ── File associations ──────────────────────────────────────────────────
  // Called when the user opens a .mid file via Finder / Explorer / File menu.
  onOpenMidiFile: (callback: (filePath: string) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('open-midi-file', wrapped);
    return () => ipcRenderer.off('open-midi-file', wrapped);
  },

  // Read a local file by path (needed because renderer can't access the filesystem).
  readMidiFile: (filePath: string) => ipcRenderer.invoke('read-midi-file', filePath),
});
