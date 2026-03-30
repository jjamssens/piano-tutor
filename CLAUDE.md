# Piano Tutor — Project Instructions

## What This Is
Cross-platform desktop piano learning app (Electron + React). Two game modes: RhythmHero (falling notes canvas) and MasterClass (VexFlow sheet music). Real-time MIDI keyboard input, curriculum-based progression, learn mode, loop mode, session scoring, and MIDI file import. Distributed as unsigned DMG (Mac) and NSIS installer (Windows) via GitHub Releases → Gumroad.

## Stack
- **Framework:** Electron 41 + electron-vite 5
- **Frontend:** React 19 + TypeScript + Tailwind CSS 4
- **State:** Zustand (useGameStore, useMidiStore)
- **MIDI:** @julusian/midi (native), @tonejs/midi (file parsing)
- **Sheet music:** VexFlow 5
- **Build/dist:** electron-builder v26
- **CI:** GitHub Actions (macos-latest + windows-latest)

## Skills to Use

| Task | Skill |
|---|---|
| UI changes, new components, layout work | `/ui-frontend-architect` |
| Security review before release | `/swarm-auditor` |
| Architecture diagram from screenshot | `/vision-to-diagram` |

## Architecture Rules

### Electron IPC
- `contextIsolation: true` is required — never set to false
- `nodeIntegration: false` in renderer — MIDI access goes through contextBridge preload API only
- `sandbox: false` is current exception for @julusian/midi native module — document any expansion of this
- New IPC channels: define in `electron/preload.ts` with typed signatures, expose via `contextBridge.exposeInMainWorld`

### State Management
- **useGameStore** — all game session state: mode, phase, scores, active song, settings
- **useMidiStore** — MIDI device state: connection, keyboard range, active notes
- Do not put MIDI state in useGameStore or game state in useMidiStore
- New global state goes in one of these two stores — do not create a third store without a strong reason

### MIDI Input
- All MIDI byte validation happens in `MidiService.ts` before values reach game logic
- Bounds check: note values 0–127, velocity 0–127 — clamp, don't crash
- Device connect/disconnect must be handled gracefully at all times (user unplugs mid-session)

### Game Engine
- `songStartTime` is set to `performance.now() + LEAD_IN_MS` — negative elapsed time = lead-in period, this is intentional
- `getElapsedMs()` returns negative values during lead-in — components must handle this
- `LEAD_IN_MS = 3000` defined in `src/types/game.types.ts` — change it there, nowhere else

## Build & Release

### Local Mac build
```bash
npm run dist:mac
```
Output: `release/` — two DMGs (arm64 + x64)

### CI/CD
- GitHub Actions triggers on `v*` tags
- Push tag: `git tag v1.x.x && git push origin v1.x.x`
- Builds publish to GitHub Releases automatically (`releaseType: "release"` in package.json)
- **Version in package.json must match the tag** — electron-builder uses package.json version for file names

### Mac signing
- Currently unsigned: `identity: null`, `hardenedRuntime: false`, `gatekeeperAssess: false`
- Users must right-click → Open to bypass Gatekeeper on first launch
- When Apple Developer cert is obtained: set `hardenedRuntime: true`, add `CSC_LINK`/`CSC_KEY_PASSWORD` secrets to GitHub, notarize

## UI Conventions
- Dark theme: bg-gray-900 base, gray-800 cards, gray-700 borders
- Accent: violet-500/600 for primary actions, green-400 for correct/success, red-400 for error/miss, yellow-400 for timing warnings
- All new components go in `src/components/`
- Hooks go in `src/hooks/`
- No business logic in components — extract to hooks or engine files
