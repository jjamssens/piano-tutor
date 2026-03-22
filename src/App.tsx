import { useEffect, useRef, useState } from 'react';
import { useMidiConnection } from './hooks/useMidiConnection';
import { PianoKeyboard } from './components/PianoKeyboard';
import { RhythmHero } from './components/RhythmHero';
import { MasterClass } from './components/MasterClass';
import { DifficultySelector } from './components/DifficultySelector';
import { ConnectionStatus } from './components/ConnectionStatus';
import { MidiUploader } from './components/MidiUploader';
import { MidiSearch } from './components/MidiSearch';
import { Onboarding, needsOnboarding } from './components/Onboarding';
import { Toast } from './components/Toast';
import { useGameStore } from './stores/useGameStore';
import { useMidiStore } from './stores/useMidiStore';
import { midiService } from './services/MidiService';
import { CURRICULUM, LESSON_SCAFFOLD, UNLOCK_THRESHOLD } from './engine/curriculum';
import { loadUserSongs, saveUserSongs, parseMidiFile } from './engine/MidiFileParser';
import type { LessonSong, ScaffoldPhase, TempoMultiplier } from './types/game.types';
import { TEMPO_PRESETS } from './types/game.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const LAST_SONG_KEY = 'piano-tutor-last-song';

type Tab = 'home' | 'play';

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  useMidiConnection();

  const {
    mode, setMode,
    activeSong, loadSong,
    isPlaying, sessionPhase,
    startSession, stopSession,
    setScaffoldPhase,
    sessionStats,
    songProgress,
    overallProgress,
    clearProgress,
  } = useGameStore();

  const device        = useMidiStore((s) => s.device);
  const keyboardRange = useMidiStore((s) => s.keyboardRange);

  // Show welcome screen every app launch (sessionStorage resets on each Electron start)
  const [showWelcome, setShowWelcome] = useState<boolean>(
    () => !sessionStorage.getItem('piano-tutor-welcomed')
  );
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);
  const [tab, setTab]                       = useState<Tab>('home');
  const [showSettings, setShowSettings]     = useState(false);
  const [showImport, setShowImport]         = useState(false);
  const [importTab, setImportTab]           = useState<'search' | 'upload'>('search');
  const [userSongs, setUserSongs]           = useState<LessonSong[]>(loadUserSongs);

  // Track last-played song across launches
  const [lastSongId, setLastSongId] = useState<string | null>(
    () => localStorage.getItem(LAST_SONG_KEY)
  );

  const isActive = isPlaying || sessionPhase === 'countdown';

  const goTab = (t: Tab) => { if (!isActive || t === 'play') setTab(t); };

  const handleSelectLesson = (song: LessonSong, scaffoldHint?: ScaffoldPhase) => {
    loadSong(song);
    if (scaffoldHint) setScaffoldPhase(scaffoldHint);
    setLastSongId(song.id);
    localStorage.setItem(LAST_SONG_KEY, song.id);
    setTab('play');
  };

  const handleSongParsed = (song: LessonSong) => {
    const updated = [...userSongs, song];
    setUserSongs(updated);
    saveUserSongs(updated);
    loadSong(song);
    setLastSongId(song.id);
    localStorage.setItem(LAST_SONG_KEY, song.id);
    setShowImport(false);
    setTab('play');
  };

  const handleSongParsedRef = useRef(handleSongParsed);
  handleSongParsedRef.current = handleSongParsed;
  const keyboardRangeRef = useRef(keyboardRange);
  keyboardRangeRef.current = keyboardRange;

  // Electron file association
  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onOpenMidiFile(async (filePath) => {
      const result = await window.electronAPI!.readMidiFile(filePath);
      if ('error' in result) return;
      const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
      const song = parseMidiFile(bytes.buffer as ArrayBuffer, result.name, keyboardRangeRef.current);
      handleSongParsedRef.current(song);
    });
  }, []);

  const handleRemoveUserSong = (id: string) => {
    const updated = userSongs.filter((s) => s.id !== id);
    setUserSongs(updated);
    saveUserSongs(updated);
  };

  const isUnlocked = (index: number) => {
    if (index === 0) return true;
    return (songProgress[CURRICULUM[index - 1].id]?.bestScore ?? 0) >= UNLOCK_THRESHOLD;
  };

  // Resolve last played song object
  const lastSong = lastSongId
    ? (CURRICULUM.find((s) => s.id === lastSongId) ?? userSongs.find((s) => s.id === lastSongId) ?? null)
    : null;

  // Completed lesson count
  const completedCount = CURRICULUM.filter(
    (s) => (songProgress[s.id]?.bestScore ?? 0) >= UNLOCK_THRESHOLD
  ).length;

  // Connection summary for header
  const keyCount = keyboardRange.max - keyboardRange.min + 1;
  const whiteKeyCount = Array.from({ length: keyCount }, (_, i) => keyboardRange.min + i)
    .filter((n) => ![1,3,6,8,10].includes(n % 12)).length;
  const sizeLabel = whiteKeyCount <= 15 ? '25-key' : whiteKeyCount <= 22 ? '37-key' :
    whiteKeyCount <= 29 ? '49-key' : whiteKeyCount <= 36 ? '61-key' :
    whiteKeyCount <= 44 ? '76-key' : '88-key';

  // ── Welcome screen ────────────────────────────────────────────────────────
  if (showWelcome && !showOnboarding) {
    return (
      <WelcomeScreen
        device={device}
        sizeLabel={sizeLabel}
        onContinue={() => {
          sessionStorage.setItem('piano-tutor-welcomed', 'true');
          setShowWelcome(false);
        }}
      />
    );
  }

  return (
    <>
      {showOnboarding && (
        <Onboarding onComplete={() => {
          setShowOnboarding(false);
          // Also mark welcome as seen so we don't double-show after onboarding
          sessionStorage.setItem('piano-tutor-welcomed', 'true');
          setShowWelcome(false);
        }} />
      )}
      <Toast />

      {/* Settings drawer */}
      <SettingsDrawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex-none flex items-center gap-3 px-4 h-12 border-b border-gray-800 bg-gray-950">
          <span className="font-bold text-white text-sm tracking-tight whitespace-nowrap">Piano Tutor</span>

          {/* Active song pill */}
          <div className="flex-1 flex justify-center min-w-0">
            {activeSong ? (
              <button
                onClick={() => !isActive && goTab('home')}
                disabled={isActive}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors disabled:pointer-events-none max-w-xs truncate"
              >
                <LevelBadge level={activeSong.difficultyLevel ?? 1} />
                <span className="text-xs text-gray-300 truncate">
                  {activeSong.title.replace(/^Lesson \d+ — /, '')}
                </span>
              </button>
            ) : (
              <span className="text-xs text-gray-700 hidden sm:inline">
                {completedCount > 0
                  ? `${completedCount} of ${CURRICULUM.length} lessons completed`
                  : 'Select a lesson to get started'}
              </span>
            )}
          </div>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 flex-shrink-0 group"
            title={device.isConnected
              ? `${device.inputName} · ${sizeLabel}`
              : device.lastError ?? 'No keyboard detected'}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${device.isConnected ? 'bg-green-400' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors hidden sm:inline">
              Settings
            </span>
          </button>
        </header>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <nav className="flex-none flex border-b border-gray-800">
          {([
            { id: 'home' as Tab, label: 'Home',  icon: '🏠' },
            { id: 'play' as Tab, label: 'Play',  icon: '🎹' },
          ]).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => goTab(id)}
              disabled={isActive && id !== 'play'}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed
                ${tab === id
                  ? 'text-white border-b-2 border-indigo-500 bg-gray-900/40'
                  : 'text-gray-600 hover:text-gray-300'}`}
            >
              <span className="mr-1">{icon}</span>{label}
            </button>
          ))}
        </nav>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {tab === 'home' && (
            <HomeTab
              overallProgress={overallProgress}
              songProgress={songProgress}
              completedCount={completedCount}
              lastSong={lastSong}
              lastSongId={lastSongId}
              userSongs={userSongs}
              isUnlocked={isUnlocked}
              showImport={showImport}
              setShowImport={setShowImport}
              importTab={importTab}
              setImportTab={setImportTab}
              handleSelectLesson={handleSelectLesson}
              handleSongParsed={handleSongParsed}
              handleRemoveUserSong={handleRemoveUserSong}
            />
          )}
          {tab === 'play' && (
            <PlayTab
              mode={mode} setMode={setMode}
              isActive={isActive} isPlaying={isPlaying}
              sessionPhase={sessionPhase}
              activeSong={activeSong}
              startSession={startSession} stopSession={stopSession}
              sessionStats={sessionStats}
              songProgress={songProgress}
              onGoHome={() => goTab('home')}
            />
          )}
        </main>

      </div>
    </>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────

function WelcomeScreen({
  device, sizeLabel, onContinue,
}: {
  device: { isConnected: boolean; inputName?: string | null };
  sizeLabel: string;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col items-center justify-center p-8">

      {/* Piano icon */}
      <svg viewBox="0 0 80 48" className="w-20 h-12 mx-auto mb-8 text-indigo-400" fill="currentColor">
        <rect x="0"  y="0" width="10" height="48" rx="2"/>
        <rect x="12" y="0" width="10" height="48" rx="2"/>
        <rect x="24" y="0" width="10" height="48" rx="2"/>
        <rect x="36" y="0" width="10" height="48" rx="2"/>
        <rect x="48" y="0" width="10" height="48" rx="2"/>
        <rect x="60" y="0" width="10" height="48" rx="2"/>
        <rect x="72" y="0" width="8"  height="48" rx="2"/>
        <rect x="8"  y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
        <rect x="20" y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
        <rect x="44" y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
        <rect x="56" y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
        <rect x="68" y="0" width="8"  height="30" rx="2" fill="#0f172a"/>
      </svg>

      <h1 className="text-3xl font-bold text-white mb-2 text-center">Piano Tutor</h1>
      <p className="text-gray-500 text-sm mb-10 text-center">Ready to practice?</p>

      {/* Keyboard status */}
      <div className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border mb-10 text-sm
        ${device.isConnected
          ? 'border-green-800 bg-green-950/40 text-green-400'
          : 'border-gray-800 bg-gray-900 text-gray-500'}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0
          ${device.isConnected ? 'bg-green-400' : 'bg-gray-600 animate-pulse'}`}
        />
        {device.isConnected
          ? `${device.inputName ?? 'Keyboard'} connected · ${sizeLabel}`
          : 'No keyboard detected — connect via USB and it will appear here'}
      </div>

      <button
        onClick={onContinue}
        className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-white transition-colors text-base"
      >
        Let's Practice
      </button>

      {!device.isConnected && (
        <p className="text-xs text-gray-700 mt-4 text-center">
          You can practice without a keyboard using your computer keyboard
        </p>
      )}

    </div>
  );
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────

function HomeTab({
  overallProgress, songProgress, completedCount,
  lastSong, lastSongId, userSongs, isUnlocked,
  showImport, setShowImport, importTab, setImportTab,
  handleSelectLesson, handleSongParsed, handleRemoveUserSong,
}: {
  overallProgress: import('./types/game.types').OverallProgress;
  songProgress: Record<string, import('./types/game.types').SongProgress>;
  completedCount: number;
  lastSong: LessonSong | null;
  lastSongId: string | null;
  userSongs: LessonSong[];
  isUnlocked: (i: number) => boolean;
  showImport: boolean;
  setShowImport: (v: boolean) => void;
  importTab: 'search' | 'upload';
  setImportTab: (t: 'search' | 'upload') => void;
  handleSelectLesson: (s: LessonSong, hint?: ScaffoldPhase) => void;
  handleSongParsed: (s: LessonSong) => void;
  handleRemoveUserSong: (id: string) => void;
}) {
  const lastSongIndex = lastSong ? CURRICULUM.findIndex((s) => s.id === lastSong.id) : -1;
  const lastSongScaffold = lastSongIndex >= 0 ? LESSON_SCAFFOLD[lastSongIndex] : undefined;
  const lastSongScore    = lastSongId ? (songProgress[lastSongId]?.bestScore ?? 0) : 0;

  // Next unlocked lesson (for new users or after finishing last)
  const nextLessonIndex = CURRICULUM.findIndex((_, i) => isUnlocked(i) &&
    (songProgress[CURRICULUM[i].id]?.bestScore ?? 0) < UNLOCK_THRESHOLD);
  const nextLesson = nextLessonIndex >= 0 ? CURRICULUM[nextLessonIndex] : null;

  return (
    <div className="room-enter max-w-xl mx-auto px-4 py-5 flex flex-col gap-6">

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <StatTile label="Streak"    value={`${overallProgress.streak}🔥`} />
        <StatTile label="Sessions"  value={String(overallProgress.totalSessions)} />
        <StatTile label="Notes"     value={String(overallProgress.totalNotesHit)} />
        <StatTile label="Minutes"   value={String(overallProgress.totalPracticeMinutes)} />
      </div>

      {/* ── Curriculum progress bar ───────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400">Curriculum Progress</span>
          <span className="text-xs text-indigo-400 font-bold">{completedCount}/{CURRICULUM.length} lessons</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / CURRICULUM.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Continue / Start card ─────────────────────────────────────────── */}
      {lastSong && (
        <div className="bg-gray-900 border border-indigo-900/60 rounded-xl px-5 py-4 flex flex-col gap-3">
          <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">Continue where you left off</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <LevelBadge level={lastSong.difficultyLevel ?? 1} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {lastSong.title.replace(/^Lesson \d+ — /, '')}
                </p>
                {lastSongScore > 0 && (
                  <p className="text-xs text-gray-500">Best score: {Math.round(lastSongScore * 100)}%</p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleSelectLesson(lastSong, lastSongScaffold as ScaffoldPhase | undefined)}
              className="flex-shrink-0 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold text-white transition-colors"
            >
              ▶ Play
            </button>
          </div>
        </div>
      )}

      {/* New user: no last song — show first available lesson as a CTA */}
      {!lastSong && nextLesson && (
        <div className="bg-gray-900 border border-indigo-900/60 rounded-xl px-5 py-4 flex flex-col gap-3">
          <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">Start here</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <LevelBadge level={nextLesson.difficultyLevel ?? 1} />
              <p className="text-sm font-semibold text-white truncate">
                {nextLesson.title.replace(/^Lesson \d+ — /, '')}
              </p>
            </div>
            <button
              onClick={() => handleSelectLesson(nextLesson, LESSON_SCAFFOLD[nextLessonIndex] as ScaffoldPhase)}
              className="flex-shrink-0 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold text-white transition-colors"
            >
              ▶ Start
            </button>
          </div>
        </div>
      )}

      {/* ── Song library — tabbed selector ───────────────────────────────── */}
      <SongLibrary
        songProgress={songProgress}
        userSongs={userSongs}
        isUnlocked={isUnlocked}
        showImport={showImport}
        setShowImport={setShowImport}
        importTab={importTab}
        setImportTab={setImportTab}
        handleSelectLesson={handleSelectLesson}
        handleSongParsed={handleSongParsed}
        handleRemoveUserSong={handleRemoveUserSong}
      />

    </div>
  );
}

// ─── Play Tab ─────────────────────────────────────────────────────────────────

function PlayTab({ mode, setMode, isActive, isPlaying, sessionPhase, activeSong, startSession, stopSession, sessionStats, songProgress, onGoHome }: {
  mode: 'rhythm-hero' | 'master-class';
  setMode: (m: 'rhythm-hero' | 'master-class') => void;
  isActive: boolean; isPlaying: boolean;
  sessionPhase: string;
  activeSong: LessonSong | null;
  startSession: () => void; stopSession: () => void;
  sessionStats: import('./types/game.types').SessionStats | null;
  songProgress: Record<string, import('./types/game.types').SongProgress>;
  onGoHome: () => void;
}) {
  // No song loaded — send user back to Home
  if (!activeSong) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-2xl">
          🎹
        </div>
        <p className="text-gray-400 text-sm">No song selected.</p>
        <button
          onClick={onGoHome}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold text-white transition-colors"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="room-enter flex flex-col items-center gap-3 px-4 pt-4 pb-6">

      {/* Inline settings */}
      <InlineSettings isActive={isActive} />

      {/* Mode selector */}
      <div className="flex gap-0.5 bg-gray-900 border border-gray-800 rounded-full p-0.5">
        {(['rhythm-hero', 'master-class'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            disabled={isActive}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-40
              ${mode === m ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {m === 'rhythm-hero' ? 'Falling Notes' : 'Sheet Music'}
          </button>
        ))}
      </div>

      {/* Game canvas */}
      {mode === 'rhythm-hero' ? <RhythmHero /> : <MasterClass />}

      {/* Play / Stop controls */}
      <div className="flex items-center gap-3">
        {!isActive ? (
          <button
            onClick={startSession}
            className="px-7 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-sm transition-colors"
          >
            ▶ Play
          </button>
        ) : (
          <button
            onClick={stopSession}
            className="px-7 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold text-sm transition-colors"
          >
            ■ Stop
          </button>
        )}
        <button
          onClick={onGoHome}
          disabled={isActive}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors disabled:pointer-events-none"
        >
          ← Change Song
        </button>
      </div>

      {/* Session results */}
      {sessionStats && sessionPhase === 'finished' && (
        <SessionResultCard
          stats={sessionStats}
          songId={activeSong.id}
          songProgress={songProgress}
          onPlayAgain={startSession}
          onChangeSong={onGoHome}
        />
      )}

      {/* Piano keyboard */}
      <div className="overflow-x-auto w-full flex justify-center pb-2 mt-1">
        <PianoKeyboard />
      </div>

    </div>
  );
}

// ─── Song Library (tabbed Lessons / My Songs) ────────────────────────────────

type LibraryTab = 'lessons' | 'my-songs';

function SongLibrary({
  songProgress, userSongs, isUnlocked,
  showImport, setShowImport, importTab, setImportTab,
  handleSelectLesson, handleSongParsed, handleRemoveUserSong,
}: {
  songProgress: Record<string, import('./types/game.types').SongProgress>;
  userSongs: LessonSong[];
  isUnlocked: (i: number) => boolean;
  showImport: boolean;
  setShowImport: (v: boolean) => void;
  importTab: 'search' | 'upload';
  setImportTab: (t: 'search' | 'upload') => void;
  handleSelectLesson: (s: LessonSong, hint?: ScaffoldPhase) => void;
  handleSongParsed: (s: LessonSong) => void;
  handleRemoveUserSong: (id: string) => void;
}) {
  const [libTab, setLibTab] = useState<LibraryTab>('lessons');

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

      {/* Tab selector */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setLibTab('lessons')}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors
            ${libTab === 'lessons'
              ? 'text-white border-b-2 border-indigo-500 bg-gray-800/60'
              : 'text-gray-600 hover:text-gray-300'}`}
        >
          Lessons
        </button>
        <button
          onClick={() => setLibTab('my-songs')}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors
            ${libTab === 'my-songs'
              ? 'text-white border-b-2 border-indigo-500 bg-gray-800/60'
              : 'text-gray-600 hover:text-gray-300'}`}
        >
          My Songs {userSongs.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-gray-700 rounded text-gray-400 text-xs font-normal normal-case tracking-normal">
              {userSongs.length}
            </span>
          )}
        </button>
      </div>

      {/* Lessons panel */}
      {libTab === 'lessons' && (
        <div className="flex flex-col gap-1.5 p-3">
          {CURRICULUM.map((song, i) => {
            const unlocked = isUnlocked(i);
            const best     = songProgress[song.id]?.bestScore ?? 0;
            return (
              <SongRow
                key={song.id}
                song={song}
                isActive={false}
                disabled={!unlocked}
                locked={!unlocked}
                best={best}
                meta={unlocked
                  ? `${LESSON_SCAFFOLD[i]} · ${song.notes.length} notes`
                  : `Score ${Math.round(UNLOCK_THRESHOLD * 100)}%+ on Level ${i} to unlock`}
                onSelect={() => handleSelectLesson(song, LESSON_SCAFFOLD[i] as ScaffoldPhase)}
              />
            );
          })}
        </div>
      )}

      {/* My Songs panel */}
      {libTab === 'my-songs' && (
        <div className="flex flex-col gap-1.5 p-3">
          {userSongs.length > 0 && userSongs.map((song) => (
            <SongRow
              key={song.id}
              song={song}
              isActive={false}
              disabled={false}
              best={songProgress[song.id]?.bestScore ?? 0}
              meta={`${song.bpm} BPM · ${song.notes.length} notes` + (song.difficultyLevel ? ` · Lvl ${song.difficultyLevel}` : '')}
              onSelect={() => handleSelectLesson(song)}
              onRemove={() => handleRemoveUserSong(song.id)}
            />
          ))}

          {userSongs.length === 0 && !showImport && (
            <p className="text-xs text-gray-600 text-center py-4">No imported songs yet.</p>
          )}

          {/* Import toggle */}
          <button
            onClick={() => setShowImport(!showImport)}
            className={`w-full py-2.5 text-xs font-medium rounded-lg border transition-colors mt-1
              ${showImport
                ? 'border-indigo-700 bg-indigo-950/40 text-indigo-400'
                : 'border-gray-800 bg-gray-900/60 text-gray-500 hover:text-gray-300 hover:border-gray-700'}`}
          >
            {showImport ? '▲ Hide Import' : '+ Import a Song'}
          </button>

          {showImport && (
            <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden mt-1">
              <div className="flex border-b border-gray-800">
                {(['search', 'upload'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setImportTab(t)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors
                      ${importTab === t
                        ? 'text-white border-b-2 border-indigo-500 bg-gray-800'
                        : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {t === 'search' ? '🔍 Search BitMidi' : '📁 Upload File'}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {importTab === 'search'
                  ? <MidiSearch onSongParsed={handleSongParsed} />
                  : <MidiUploader onSongParsed={handleSongParsed} />
                }
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ─── Inline Settings ──────────────────────────────────────────────────────────

const INLINE_DIFFICULTIES = [
  { level: 'beginner'     as const, label: 'Beginner'     },
  { level: 'intermediate' as const, label: 'Intermediate' },
  { level: 'advanced'     as const, label: 'Advanced'     },
];

const INLINE_HAND_MODES = [
  { mode: 'both'  as const, label: 'Both'  },
  { mode: 'right' as const, label: 'Right' },
  { mode: 'left'  as const, label: 'Left'  },
];

function InlineSettings({ isActive }: { isActive: boolean }) {
  const {
    tempoMultiplier, setTempoMultiplier,
    difficulty, setDifficulty,
    handMode, setHandMode,
  } = useGameStore();

  return (
    <div className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex flex-col gap-2.5">

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 w-14 flex-shrink-0">Tempo</span>
        <div className="flex gap-1.5 flex-wrap">
          {TEMPO_PRESETS.map((t) => (
            <button key={t} onClick={() => setTempoMultiplier(t as TempoMultiplier)}
              disabled={isActive}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${tempoMultiplier === t ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
              {t === 1.0 ? '1×' : `${t}×`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 w-14 flex-shrink-0">Timing</span>
        <div className="flex gap-1.5 flex-wrap">
          {INLINE_DIFFICULTIES.map(({ level, label }) => (
            <button key={level} onClick={() => setDifficulty(level)}
              disabled={isActive}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${difficulty === level ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 w-14 flex-shrink-0">Hands</span>
        <div className="flex gap-1.5 flex-wrap">
          {INLINE_HAND_MODES.map(({ mode, label }) => (
            <button key={mode} onClick={() => setHandMode(mode)}
              disabled={isActive}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${handMode === mode ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Settings Drawer ──────────────────────────────────────────────────────────

function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-96 max-w-full bg-gray-950 border-l border-gray-800
        overflow-y-auto transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-950 z-10">
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none transition-colors">×</button>
        </div>
        <div className="px-5 py-5 flex flex-col gap-7">
          <section>
            <DrawerSectionHeader>Keyboard Connection</DrawerSectionHeader>
            <ConnectionStatus />
          </section>
          <section>
            <DrawerSectionHeader>Practice Settings</DrawerSectionHeader>
            <DifficultySelector />
          </section>
        </div>
      </div>
    </>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const LEVEL_COLORS = [
  'text-green-400', 'text-green-400', 'text-teal-400', 'text-teal-400',
  'text-cyan-400',  'text-blue-400',  'text-indigo-400', 'text-violet-400',
  'text-purple-400','text-rose-400',
];

function LevelBadge({ level }: { level: number }) {
  const color = LEVEL_COLORS[Math.min(level - 1, 9)] ?? 'text-gray-400';
  return (
    <span className={`text-xs font-bold ${color} bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0`}>
      L{level}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-3">{children}</h2>
  );
}

function DrawerSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-3">{children}</h3>
  );
}

function SongRow({ song, isActive, disabled, locked, best, meta, onSelect, onRemove }: {
  song: LessonSong; isActive: boolean; disabled: boolean;
  locked?: boolean; best: number; meta: string;
  onSelect: () => void; onRemove?: () => void;
}) {
  return (
    <div className={`flex items-center rounded-lg text-sm transition-colors
      ${isActive ? 'bg-indigo-950 border border-indigo-800' :
        locked    ? 'bg-gray-900 border border-gray-800 opacity-50' :
                    'bg-gray-900 border border-gray-800 hover:border-gray-700 hover:bg-gray-800'}
      ${disabled ? 'pointer-events-none' : ''}`}
    >
      <button className="flex-1 text-left px-3 py-2.5" onClick={onSelect} disabled={disabled}>
        <div className="flex items-center gap-2">
          {song.difficultyLevel && <LevelBadge level={song.difficultyLevel} />}
          {locked && <span className="text-xs">🔒</span>}
          <span className={`font-medium text-sm ${isActive ? 'text-white' : locked ? 'text-gray-600' : 'text-gray-300'}`}>
            {song.title.replace(/^Lesson \d+ — /, '')}
          </span>
          {best > 0 && (
            <span className="text-xs text-indigo-400 ml-auto flex-shrink-0">{Math.round(best * 100)}%</span>
          )}
        </div>
        <span className="text-xs text-gray-600 mt-0.5 block">{meta}</span>
      </button>
      {onRemove && !locked && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          disabled={disabled}
          className="px-3 py-3 text-gray-700 hover:text-red-400 transition-colors"
          title="Remove"
        >×</button>
      )}
    </div>
  );
}

function SessionResultCard({ stats, songId, songProgress, onPlayAgain, onChangeSong }: {
  stats: import('./types/game.types').SessionStats;
  songId: string;
  songProgress: Record<string, import('./types/game.types').SongProgress>;
  onPlayAgain: () => void;
  onChangeSong: () => void;
}) {
  const best  = songProgress[songId]?.bestScore ?? 0;
  const score = stats.averageCombinedScore;
  return (
    <div className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Session Results</h3>
        {score >= UNLOCK_THRESHOLD && (
          <span className="text-xs text-green-400 font-medium">Next lesson unlocked ✓</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center mb-4">
        <ResultStat label="Notes"      value={`${stats.correct}/${stats.totalNotes}`}               color="text-green-400" />
        <ResultStat label="Timing"     value={`${Math.round(stats.averageTimingAccuracy * 100)}%`}  color="text-indigo-400" />
        <ResultStat label="Expression" value={`${Math.round(stats.averageVelocityAccuracy * 100)}%`} color="text-violet-400" />
      </div>

      {score < 0.6 && (
        <p className="text-xs text-yellow-500 text-center mb-3">
          Try a slower tempo or Beginner difficulty to build accuracy.
        </p>
      )}
      {best > 0 && best > score && (
        <p className="text-xs text-gray-600 text-center mb-3">
          Personal best: {Math.round(best * 100)}%
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={onPlayAgain}
          className="flex-1 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-semibold text-white transition-colors"
        >
          ▶ Play Again
        </button>
        <button
          onClick={onChangeSong}
          className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-semibold text-gray-300 transition-colors"
        >
          ← Change Song
        </button>
      </div>
    </div>
  );
}

function ResultStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-600 mt-0.5">{label}</div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
      <div className="text-base font-bold text-white">{value}</div>
      <div className="text-xs text-gray-600 mt-0.5">{label}</div>
    </div>
  );
}
