import { useEffect, useRef, useState } from 'react';
import { parseMidiFile } from '../engine/MidiFileParser';
import { useMidiStore } from '../stores/useMidiStore';
import type { LessonSong } from '../types/game.types';

interface BitMidiResult {
  id: number;
  name: string;
  slug: string;
  plays: number;
  downloadUrl: string;
}

interface SearchResponse {
  result: {
    results: BitMidiResult[];
    total: number;
    pageTotal: number;
  };
}

interface Props {
  onSongParsed: (song: LessonSong) => void;
}

type ImportingState = { id: number } | { url: true } | null;

// ─── BitMidi fetch helper ──────────────────────────────────────────────────
// In Electron, requests go through the main-process IPC proxy (no CORS).
// In browser dev mode, they go through the Vite dev server proxy.

const IS_ELECTRON = typeof window !== 'undefined' && 'electronAPI' in window;

async function bitMidiFetch(proxyPath: string, directUrl: string): Promise<Response> {
  if (IS_ELECTRON && window.electronAPI) {
    const result = await window.electronAPI.fetchBitMidi(directUrl);
    if (result.type === 'error') throw new Error(result.message);
    if (result.type === 'json') {
      return new Response(JSON.stringify(result.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // binary — decode base-64 back to ArrayBuffer
    const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
    return new Response(bytes.buffer as ArrayBuffer, { status: 200 });
  }
  return fetch(proxyPath);
}

/**
 * MidiSearch
 *
 * In-app MIDI song search powered by BitMidi's undocumented public API.
 * In Electron: requests go through the main-process IPC proxy — no CORS issues.
 * In browser dev mode: requests route through the Vite dev server proxy.
 *
 * Falls back gracefully to a direct URL importer if the API is unavailable.
 */
export function MidiSearch({ onSongParsed }: Props) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<BitMidiResult[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [isSearching, setSearching] = useState(false);
  const [importing, setImporting]   = useState<ImportingState>(null);
  const [error, setError]           = useState<string | null>(null);
  const [apiDown, setApiDown]       = useState(false);
  const [urlInput, setUrlInput]     = useState('');

  // Keep latest query in ref for the debounce callback
  const queryRef = useRef(query);
  queryRef.current = query;

  // Debounced search — fires 400ms after the user stops typing
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      if (queryRef.current === query) runSearch(query, 0, true);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const runSearch = async (q: string, p: number, reset: boolean) => {
    setSearching(true);
    setError(null);
    try {
      const res = await bitMidiFetch(
        `/bitmidi-api/midi/search?q=${encodeURIComponent(q)}&page=${p}`,
        `https://bitmidi.com/api/midi/search?q=${encodeURIComponent(q)}&page=${p}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SearchResponse = await res.json();
      const items = data.result?.results ?? [];
      const totalCount = data.result?.total ?? 0;

      setResults((prev) => reset ? items : [...prev, ...items]);
      setTotal(totalCount);
      setPage(p);
    } catch {
      setApiDown(true);
      setError('BitMidi search is unavailable right now. Paste a direct .mid URL below instead.');
    } finally {
      setSearching(false);
    }
  };

  const importFromUrl = async (url: string, name: string) => {
    if (!url.trim()) return;

    // downloadUrl from API is a relative path like /uploads/12345.mid
    const normalised = url.startsWith('/')
      ? url                                            // already relative
      : url.replace('https://bitmidi.com', '');        // absolute bitmidi URL → strip origin

    const isBitMidi = normalised.startsWith('/uploads/');
    const proxyPath  = isBitMidi ? `/bitmidi-file${normalised}` : url;
    const directUrl  = isBitMidi ? `https://bitmidi.com${normalised}` : url;

    try {
      const res = await bitMidiFetch(proxyPath, directUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      const song   = parseMidiFile(buffer, name.endsWith('.mid') ? name : name + '.mid', keyboardRange);
      onSongParsed(song);
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  const handleImportResult = async (result: BitMidiResult) => {
    setImporting({ id: result.id });
    setError(null);
    try {
      await importFromUrl(result.downloadUrl, result.name);
    } catch (err) {
      setError(`Could not import "${result.name}": ${(err as Error).message}`);
    } finally {
      setImporting(null);
    }
  };

  const handleImportUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/\.midi?(\?[^/]*)?$/i.test(trimmed)) {
      setError('URL must point to a .mid or .midi file.');
      return;
    }
    setImporting({ url: true });
    setError(null);
    try {
      const name = trimmed.split('/').pop()?.split('?')[0] ?? 'song.mid';
      await importFromUrl(trimmed, name);
      setUrlInput('');
    } catch (err) {
      setError(`Could not fetch URL: ${(err as Error).message}`);
    } finally {
      setImporting(null);
    }
  };

  const hasMore      = results.length < total;
  const isImporting  = importing !== null;

  return (
    <div className="flex flex-col gap-3">

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder='Search for a song, e.g. "Fur Elise"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5
            text-sm text-white placeholder-gray-500
            focus:outline-none focus:border-indigo-500 transition-colors pr-10"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2
            w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Results list */}
      {results.length > 0 && (
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto rounded-lg">
          {results.map((r) => {
            const isThisImporting = isImporting && 'id' in importing && importing.id === r.id;
            return (
              <div
                key={r.id}
                className="flex items-center justify-between px-3 py-2.5
                  bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 truncate">{r.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {r.plays.toLocaleString()} plays
                  </p>
                </div>
                <button
                  onClick={() => handleImportResult(r)}
                  disabled={isImporting}
                  className="ml-3 flex-shrink-0 px-3 py-1.5 text-xs font-medium
                    bg-indigo-600 hover:bg-indigo-500 rounded-md text-white
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center gap-1.5 min-w-[72px] justify-center"
                >
                  {isThisImporting ? (
                    <>
                      <span className="w-3 h-3 border border-white border-t-transparent
                        rounded-full animate-spin" />
                      Importing
                    </>
                  ) : 'Import'}
                </button>
              </div>
            );
          })}

          {hasMore && (
            <button
              onClick={() => runSearch(query, page + 1, false)}
              disabled={isSearching}
              className="text-xs text-indigo-400 hover:text-indigo-300
                py-2 text-center transition-colors disabled:opacity-50"
            >
              Load more ({total - results.length} remaining)
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {query.trim() && !isSearching && results.length === 0 && !error && (
        <p className="text-gray-600 text-xs text-center py-2">No results found.</p>
      )}

      {/* URL fallback — always visible, prominent when API is down */}
      <div className={`flex flex-col gap-2 pt-2 ${apiDown ? '' : 'border-t border-gray-800'}`}>
        {!apiDown && (
          <p className="text-xs text-gray-600">
            Or paste a direct link to any <code className="text-gray-500">.mid</code> file:
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://bitmidi.com/uploads/..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImportUrl()}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
              text-sm text-white placeholder-gray-600
              focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={handleImportUrl}
            disabled={!urlInput.trim() || isImporting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm
              font-medium text-white transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting && 'url' in (importing ?? {}) ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent
                rounded-full animate-spin" />
            ) : 'Fetch'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs px-1">{error}</p>
      )}
    </div>
  );
}
