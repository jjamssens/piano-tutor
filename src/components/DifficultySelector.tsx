import { useGameStore } from '../stores/useGameStore';
import type { DifficultyLevel, HandMode, ScaffoldPhase, TempoMultiplier } from '../types/game.types';
import { TEMPO_PRESETS, TIMING_WINDOWS } from '../types/game.types';

const DIFFICULTIES: { level: DifficultyLevel; label: string; desc: string }[] = [
  { level: 'beginner',     label: 'Beginner',     desc: '±200ms' },
  { level: 'intermediate', label: 'Intermediate', desc: '±100ms' },
  { level: 'advanced',     label: 'Advanced',     desc: '±50ms'  },
];

const SCAFFOLD_PHASES: { phase: ScaffoldPhase; label: string; desc: string }[] = [
  { phase: 'crutch',       label: 'Crutch',       desc: 'Full notes'     },
  { phase: 'transition',   label: 'Transition',   desc: 'Faded notes'    },
  { phase: 'independence', label: 'Independence', desc: 'No notes'       },
];

const HAND_MODES: { mode: HandMode; label: string }[] = [
  { mode: 'both',  label: 'Both Hands' },
  { mode: 'right', label: 'Right Hand' },
  { mode: 'left',  label: 'Left Hand'  },
];

const TEMPO_LABELS: Record<TempoMultiplier, string> = {
  0.5:  '50%',
  0.75: '75%',
  1.0:  '100%',
  1.25: '125%',
};

export function DifficultySelector() {
  const {
    difficulty, scaffoldPhase, learnMode,
    tempoMultiplier, handMode, showNoteLabels, loopEnabled,
    setDifficulty, setScaffoldPhase, setLearnMode,
    setTempoMultiplier, setHandMode, setShowNoteLabels, setLoopEnabled,
    isPlaying,
  } = useGameStore();

  return (
    <div className="flex flex-col gap-5 p-6 bg-gray-900 rounded-xl border border-gray-700 w-full max-w-xl">

      {/* ── Tempo ──────────────────────────────────────────────────────────── */}
      <Section title="Tempo">
        <div className="flex gap-2">
          {TEMPO_PRESETS.map((t) => (
            <ToggleBtn
              key={t}
              active={tempoMultiplier === t}
              disabled={isPlaying}
              onClick={() => setTempoMultiplier(t as TempoMultiplier)}
              label={TEMPO_LABELS[t as TempoMultiplier]}
              sub={t === 1.0 ? 'Normal' : t < 1 ? 'Slower' : 'Faster'}
            />
          ))}
        </div>
      </Section>

      {/* ── Timing difficulty ──────────────────────────────────────────────── */}
      <Section title="Timing Accuracy">
        <div className="flex gap-2">
          {DIFFICULTIES.map(({ level, label, desc }) => (
            <ToggleBtn
              key={level}
              active={difficulty === level}
              disabled={isPlaying}
              onClick={() => setDifficulty(level)}
              label={label}
              sub={desc}
              color="indigo"
            />
          ))}
        </div>
      </Section>

      {/* ── Hand mode ──────────────────────────────────────────────────────── */}
      <Section title="Hand Mode">
        <div className="flex gap-2">
          {HAND_MODES.map(({ mode, label }) => (
            <ToggleBtn
              key={mode}
              active={handMode === mode}
              disabled={isPlaying}
              onClick={() => setHandMode(mode)}
              label={label}
              sub={mode === 'both' ? 'Full song' : mode === 'right' ? 'Notes ≥ C4' : 'Notes < C4'}
              color="green"
            />
          ))}
        </div>
      </Section>

      {/* ── Visual scaffold ────────────────────────────────────────────────── */}
      <Section title="Visual Scaffold">
        <div className="flex gap-2">
          {SCAFFOLD_PHASES.map(({ phase, label, desc }) => (
            <ToggleBtn
              key={phase}
              active={scaffoldPhase === phase}
              onClick={() => setScaffoldPhase(phase)}
              label={label}
              sub={desc}
              color="violet"
            />
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-2">Can be changed mid-session. LED lights stay on in all modes.</p>
      </Section>

      {/* ── Toggles row ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Toggle
          label="Learn Mode"
          sub="Song pauses at each note until you play the correct key"
          enabled={learnMode}
          disabled={isPlaying}
          onToggle={() => setLearnMode(!learnMode)}
          color="violet"
        />
        <Toggle
          label="Note Labels"
          sub="Show note names (C, D, E…) on falling notes and keyboard keys"
          enabled={showNoteLabels}
          onToggle={() => setShowNoteLabels(!showNoteLabels)}
          color="sky"
        />
        <Toggle
          label="Loop Practice"
          sub="Set a section below and it repeats automatically for focused practice"
          enabled={loopEnabled}
          disabled={isPlaying}
          onToggle={() => setLoopEnabled(!loopEnabled)}
          color="amber"
        />
      </div>

      {/* ── Active settings summary ────────────────────────────────────────── */}
      <div className="text-xs text-gray-600 border-t border-gray-800 pt-3 flex flex-wrap gap-x-4 gap-y-1">
        <span>Window: <span className="text-indigo-400 font-mono">±{TIMING_WINDOWS[difficulty]}ms</span></span>
        <span>Tempo: <span className="text-amber-400 font-mono">{TEMPO_LABELS[tempoMultiplier as TempoMultiplier]}</span></span>
        {handMode !== 'both' && <span className="text-green-400">Hand: {handMode}</span>}
        {learnMode    && <span className="text-violet-400">Learn Mode</span>}
        {showNoteLabels && <span className="text-sky-400">Labels ON</span>}
        {loopEnabled  && <span className="text-amber-400">Loop ON</span>}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}

function ToggleBtn({
  active, disabled, onClick, label, sub,
  color = 'indigo',
}: {
  active: boolean; disabled?: boolean; onClick: () => void;
  label: string; sub: string; color?: string;
}) {
  const activeClass =
    color === 'violet' ? 'bg-violet-600 text-white' :
    color === 'green'  ? 'bg-green-700 text-white'  :
    color === 'amber'  ? 'bg-amber-600 text-white'  :
                         'bg-indigo-600 text-white';

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
        ${active ? activeClass : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {label}
      <span className="block text-xs font-normal opacity-70 mt-0.5">{sub}</span>
    </button>
  );
}

function Toggle({
  label, sub, enabled, disabled, onToggle, color = 'violet',
}: {
  label: string; sub: string; enabled: boolean;
  disabled?: boolean; onToggle: () => void; color?: string;
}) {
  const trackClass =
    color === 'sky'   ? 'bg-sky-600'   :
    color === 'amber' ? 'bg-amber-600' :
                        'bg-violet-600';

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      </div>
      <button
        disabled={disabled}
        onClick={onToggle}
        className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors mt-0.5
          ${enabled ? trackClass : 'bg-gray-700'}
          disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
            ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}
