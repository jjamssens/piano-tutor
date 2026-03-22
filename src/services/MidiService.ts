import type { MidiDeviceState, NoteEvent, NoteNumber } from '../types/midi.types';

type NoteEventCallback = (event: NoteEvent) => void;
type StateChangeCallback = (state: MidiDeviceState) => void;

/**
 * MidiService — Singleton
 *
 * Owns all Web MIDI API interactions. Lives outside React.
 * Notifies consumers via callbacks; never touches React state directly.
 *
 * Lighting: LK-S250 responds to Note-On/Off on MIDI channel 1 (index 0).
 * No SysEx required. Output port matched by name substring.
 */
class MidiService {
  private static instance: MidiService;

  private midiAccess: MIDIAccess | null = null;
  private inputPort: MIDIInput | null = null;
  private outputPort: MIDIOutput | null = null;

  // Ring buffer for high-frequency note events — drained by RAF loop
  private eventBuffer: NoteEvent[] = [];

  private onNoteEventCallbacks: Set<NoteEventCallback> = new Set();
  private onStateChangeCallbacks: Set<StateChangeCallback> = new Set();

  private deviceState: MidiDeviceState = {
    isConnected: false,
    inputName: null,
    outputName: null,
    lastError: null,
    keyboardMin: 36,
    keyboardMax: 96,
  };

  // Lit keys tracked for cleanup on disconnect
  private litKeys: Set<NoteNumber> = new Set();

  // Detected physical keyboard range — updated on connect and on note events
  private keyboardRange: { min: number; max: number } = { min: 36, max: 96 };

  // Callbacks for when the detected range expands
  private onRangeChangeCallbacks: Set<(range: { min: number; max: number }) => void> = new Set();

  private constructor() {}

  static getInstance(): MidiService {
    if (!MidiService.instance) {
      MidiService.instance = new MidiService();
    }
    return MidiService.instance;
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (!navigator.requestMIDIAccess) {
      this.emitStateChange({ lastError: 'Web MIDI API not supported in this browser.' });
      return;
    }

    try {
      // sysex: false — app uses standard Note-On/Off only; no SysEx needed
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.bindDevicePorts();

      // Listen for hot-plug events
      this.midiAccess.onstatechange = this.handleStateChange.bind(this);
    } catch (err) {
      this.emitStateChange({
        lastError: `MIDI access denied: ${(err as Error).message}`,
      });
    }
  }

  // ─── Port Discovery ────────────────────────────────────────────────────────

  /**
   * Keyboard brand identifiers, ordered by priority.
   * Casio is checked first — if multiple keyboards are connected, the Casio wins.
   * All other supported brands follow. Any matching keyboard works for MIDI
   * input/scoring/sheet music; LED key lighting requires a Casio LK-series.
   *
   * Port name matching is case-insensitive substring.
   */
  private static readonly DEVICE_PRIORITY: Array<{
    brand: string;
    identifiers: string[];
    hasLighting: boolean;
  }> = [
    // ── Casio (optimized — full LED lighting support on LK-series) ───────────
    { brand: 'Casio',  identifiers: ['casio', 'lk-s', 'lk s'],        hasLighting: true  },
    // ── Yamaha ────────────────────────────────────────────────────────────────
    { brand: 'Yamaha', identifiers: ['yamaha', 'p-', 'ydp', 'psr', 'mx', 'reface'], hasLighting: false },
    // ── Roland ────────────────────────────────────────────────────────────────
    { brand: 'Roland', identifiers: ['roland', 'fp-', 'rd-', 'rp-', 'go:piano'],    hasLighting: false },
    // ── Korg ──────────────────────────────────────────────────────────────────
    { brand: 'Korg',   identifiers: ['korg', 'b2', 'lp-', 'sv-'],     hasLighting: false },
    // ── Nord ──────────────────────────────────────────────────────────────────
    { brand: 'Nord',   identifiers: ['nord', 'clavia'],                hasLighting: false },
    // ── M-Audio / Arturia / Novation ──────────────────────────────────────────
    { brand: 'M-Audio',  identifiers: ['m-audio', 'keystation', 'oxygen'], hasLighting: false },
    { brand: 'Arturia',  identifiers: ['arturia', 'keylab', 'minilab'],    hasLighting: false },
    { brand: 'Novation', identifiers: ['novation', 'launchkey'],           hasLighting: false },
    // ── Generic USB MIDI (last resort) ────────────────────────────────────────
    { brand: 'USB MIDI', identifiers: ['usb midi', 'usb audio', 'midi keyboard'], hasLighting: false },
  ];


  /**
   * Keyboard size database — maps partial device-name tokens to MIDI note ranges.
   * Entries are checked in order; first match wins.
   * Range is expressed as { min, max } MIDI note numbers.
   *
   * Key counts and standard ranges:
   *   25-key mini  → MIDI 48–72  (C3–C5)
   *   37-key       → MIDI 36–72  (C2–C5)
   *   49-key       → MIDI 36–84  (C2–C6)
   *   61-key       → MIDI 36–96  (C2–C7)  ← most learning keyboards
   *   76-key       → MIDI 28–103 (E1–G7)
   *   88-key       → MIDI 21–108 (A0–C8)  ← full piano
   */
  private static readonly KEY_RANGE_DB: Array<{
    tokens: string[];
    min: number;
    max: number;
    keys: number;
  }> = [
    // ── 88-key full pianos ─────────────────────────────────────────────────
    { tokens: ['ydp-s', 'ydp-144', 'ydp-184', 'ydp-c71', 'p-45', 'p-125', 'p-145', 'p-225', 'p-515', 'p-s500'],
      min: 21, max: 108, keys: 88 },
    { tokens: ['fp-90', 'fp-80', 'fp-60e'],
      min: 21, max: 108, keys: 88 },
    { tokens: ['rd-88', 'rd-2000', 'rp-701', 'rp-901'],
      min: 21, max: 108, keys: 88 },
    { tokens: ['clavinova', 'clp-', 'clp6', 'clp7', 'clp8', 'csp-'],
      min: 21, max: 108, keys: 88 },
    { tokens: ['cp-88', 'cp88', 'cp73', 'kawai', 'cn-', 'ca-', 'es-8', 'mp-11', 'mp-7'],
      min: 21, max: 108, keys: 88 },
    { tokens: ['nord grand', 'nord piano 4', 'nord piano 5'],
      min: 21, max: 108, keys: 88 },
    { tokens: ['steinway', 'bösendorfer'],
      min: 21, max: 108, keys: 88 },
    // ── 76-key ─────────────────────────────────────────────────────────────
    { tokens: ['p-255', 'p-515', 'mx88', 'gp-609'],
      min: 28, max: 103, keys: 76 },
    // ── 61-key (most learning keyboards) ──────────────────────────────────
    { tokens: ['lk-s', 'lk s', 'lk-265', 'lk-s250', 'lk-s450'],
      min: 36, max: 96, keys: 61 },
    { tokens: ['ct-s300', 'ct-s400', 'ct-s500', 'ct-x', 'wk-'],
      min: 36, max: 96, keys: 61 },
    { tokens: ['psr-f', 'psr-e36', 'psr-e37', 'psr-e38', 'psr-e47', 'psr-e48'],
      min: 36, max: 96, keys: 61 },
    { tokens: ['go:piano', 'go piano', 'go:keys'],
      min: 36, max: 96, keys: 61 },
    { tokens: ['fp-30', 'rp-30', 'rp-102', 'rp-107'],
      min: 36, max: 96, keys: 61 },
    { tokens: ['b2sp', 'lp-180', 'lp-350', 'sv-1'],
      min: 36, max: 96, keys: 61 },
    { tokens: ['oxygen 61', 'keylab 61', 'launchkey 61', 'impact lx61', 'keystation 61'],
      min: 36, max: 96, keys: 61 },
    { tokens: ['reface cp', 'reface cs', 'reface dx', 'reface yw'],
      min: 36, max: 96, keys: 37 }, // Reface is actually 37 keys
    // ── 49-key ─────────────────────────────────────────────────────────────
    { tokens: ['psr-e3', 'psr-e27', 'psr-e28', 'psr-e29'],
      min: 36, max: 84, keys: 49 },
    { tokens: ['oxygen 49', 'keylab 49', 'impact lx49', 'keystation 49'],
      min: 36, max: 84, keys: 49 },
    // ── 37-key ─────────────────────────────────────────────────────────────
    { tokens: ['keylab 37', 'oxygen 37', 'impact lx37'],
      min: 48, max: 84, keys: 37 },
    // ── 25-key mini ────────────────────────────────────────────────────────
    { tokens: ['minilab', 'launchkey mini', 'oxygen 25', 'keystation mini'],
      min: 48, max: 72, keys: 25 },
    { tokens: ['nano key'],
      min: 48, max: 72, keys: 25 },
  ];

  /**
   * Detect physical keyboard range from the MIDI port name.
   * Falls back to 61-key (C2–C7) for unknown devices — the most common size.
   */
  private static lookupRange(portName: string): { min: number; max: number } {
    const lc = portName.toLowerCase();
    for (const entry of MidiService.KEY_RANGE_DB) {
      if (entry.tokens.some((t) => lc.includes(t))) {
        return { min: entry.min, max: entry.max };
      }
    }
    return { min: 36, max: 96 }; // default: 61-key
  }

  /** Active device brand info — set when a port is bound */
  deviceBrand: string | null = null;
  hasLighting = false;

  /**
   * Scan all MIDI ports and bind to the best available keyboard.
   * Casio is preferred; falls back through the priority list.
   * Logs the discovered port name and brand for verification.
   */
  private bindDevicePorts(): void {
    if (!this.midiAccess) return;

    let input:  MIDIInput  | null = null;
    let output: MIDIOutput | null = null;
    let matchedBrand = 'Unknown';
    let matchedHasLighting = false;

    // Try each brand tier in priority order — stop at first match
    outer:
    for (const { brand, identifiers, hasLighting } of MidiService.DEVICE_PRIORITY) {
      for (const port of this.midiAccess.inputs.values()) {
        const nameLower = port.name?.toLowerCase() ?? '';
        if (identifiers.some((id) => nameLower.includes(id))) {
          input = port;
          matchedBrand       = brand;
          matchedHasLighting = hasLighting;
          console.info(`[MidiService] Input port discovered: "${port.name}" (${brand})`);
          break outer;
        }
      }
    }

    // Match output port to same brand as input when possible
    if (input) {
      const inputNameLower = input.name?.toLowerCase() ?? '';
      // First try: exact name match
      for (const port of this.midiAccess.outputs.values()) {
        if ((port.name?.toLowerCase() ?? '') === inputNameLower) {
          output = port;
          break;
        }
      }
      // Second try: same brand identifiers
      if (!output) {
        const brandEntry = MidiService.DEVICE_PRIORITY.find((b) => b.brand === matchedBrand);
        for (const port of this.midiAccess.outputs.values()) {
          const nameLower = port.name?.toLowerCase() ?? '';
          if (brandEntry?.identifiers.some((id) => nameLower.includes(id))) {
            output = port;
            console.info(`[MidiService] Output port discovered: "${port.name}" (${matchedBrand})`);
            break;
          }
        }
      }
    }

    if (!input || !output) {
      this.emitStateChange({
        isConnected: false,
        inputName: null,
        outputName: null,
        lastError: 'No supported MIDI keyboard found. Check USB connection.',
      });
      return;
    }

    this.deviceBrand  = matchedBrand;
    this.hasLighting  = matchedHasLighting;

    // Detect keyboard range from port name; triggers auto-expand as notes come in
    this.keyboardRange = MidiService.lookupRange(input.name ?? '');
    console.info(`[MidiService] Detected keyboard range: MIDI ${this.keyboardRange.min}–${this.keyboardRange.max} (${this.keyboardRange.max - this.keyboardRange.min + 1} notes)`);

    this.inputPort = input;
    this.outputPort = output;
    this.inputPort.onmidimessage = this.handleMidiMessage.bind(this);

    this.emitStateChange({
      isConnected: true,
      inputName: input.name ?? null,
      outputName: output.name ?? null,
      lastError: null,
      keyboardMin: this.keyboardRange.min,
      keyboardMax: this.keyboardRange.max,
    });
  }

  // ─── MIDI Input Handler ────────────────────────────────────────────────────

  /**
   * Raw MIDI message handler. Fires at hardware speed.
   * Pushes to ring buffer only — no React state writes here.
   *
   * Byte layout:
   *   data[0] = status byte (0x90 = Note-On ch1, 0x80 = Note-Off ch1)
   *   data[1] = MIDI note number (0–127)
   *   data[2] = velocity (0–127; 0 on Note-On = Note-Off)
   */
  private handleMidiMessage(event: MIDIMessageEvent): void {
    if (!event.data) return;
    const data = event.data as Uint8Array;
    const [status, note, velocity] = [data[0], data[1], data[2]];
    const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0;
    const isNoteOff =
      (status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0);

    if (!isNoteOn && !isNoteOff) return; // Ignore CC, pitch bend, etc.

    const noteEvent: NoteEvent = {
      note,
      velocity: isNoteOn ? velocity : 0,
      timestamp: performance.now(),
      type: isNoteOn ? 'noteOn' : 'noteOff',
    };

    // Auto-expand detected range if a note falls outside it
    if (typeof note === 'number' && (note < this.keyboardRange.min || note > this.keyboardRange.max)) {
      const prevMin = this.keyboardRange.min;
      const prevMax = this.keyboardRange.max;
      // Snap expansion to nearest octave boundary
      if (note < prevMin) this.keyboardRange.min = Math.floor(note / 12) * 12;
      if (note > prevMax) this.keyboardRange.max = Math.ceil(note / 12) * 12;
      console.info(`[MidiService] Keyboard range expanded to MIDI ${this.keyboardRange.min}–${this.keyboardRange.max}`);
      const range = { ...this.keyboardRange };
      for (const cb of this.onRangeChangeCallbacks) cb(range);
    }

    // Fire real-time callbacks immediately (used by GameEngine for precise timing)
    for (const cb of this.onNoteEventCallbacks) {
      cb(noteEvent);
    }

    // Also buffer for the 60fps RAF drain loop (used by useMidiConnection for UI)
    // Cap at 500 to prevent unbounded growth if the drain loop stalls
    if (this.eventBuffer.length < 500) {
      this.eventBuffer.push(noteEvent);
    }
  }

  /**
   * Called by the RAF loop in useMidiConnection.
   * Drains the buffer and returns events — runs at 60fps max.
   */
  drainEventBuffer(): NoteEvent[] {
    const drained = [...this.eventBuffer];
    this.eventBuffer = [];
    return drained;
  }

  // ─── Lighting Control ──────────────────────────────────────────────────────

  /**
   * Light a physical key on the LK-S250.
   *
   * The LK-S250's LED guide system ("MIDI IN Navigate") listens on a dedicated
   * navigate channel — NOT the sound channel (ch 1). Default navigate channel
   * is 4 (status byte 0x93). The keyboard silences sound on the navigate channel
   * while still lighting the key, which is exactly what we want.
   *
   * One-time keyboard setup required (persists through power-off):
   *   FUNCTION → MIDIInNavigate → Listen
   *   FUNCTION → MIDIInNavi R Ch → 4
   */
  lightKey(note: NoteNumber, velocity = 64): void {
    if (!this.outputPort) return;
    // 0x93 = Note-On, Channel 4 (MIDI IN Navigate right-hand channel default)
    this.outputPort.send([0x93, note, velocity]);
    this.litKeys.add(note);
  }

  /**
   * Extinguish a physical key.
   * Sends Note-Off on the same navigate channel (0x83 = Note-Off, Channel 4).
   */
  unlightKey(note: NoteNumber): void {
    if (!this.outputPort) return;
    // 0x83 = Note-Off, Channel 4
    this.outputPort.send([0x83, note, 0]);
    this.litKeys.delete(note);
  }

  /** Extinguish all currently lit keys. */
  unlightAll(): void {
    for (const note of this.litKeys) {
      this.unlightKey(note);
    }
  }

  // ─── Hot-Plug / Reconnection ───────────────────────────────────────────────

  /**
   * Handles USB connect/disconnect events from the browser MIDI stack.
   * On disconnect: clears port references, emits disconnected state.
   * On reconnect: re-runs port discovery after 500ms OS re-enumeration delay.
   */
  private handleStateChange(event: MIDIConnectionEvent): void {
    const port = event.port;
    if (!port) return;

    const portName = port.name ?? '';
    const allIdentifiers = MidiService.DEVICE_PRIORITY.flatMap((d) => d.identifiers);
    const isOurDevice = allIdentifiers.some((id) =>
      portName.toLowerCase().includes(id)
    );

    if (!isOurDevice) return;

    if (port.state === 'disconnected') {
      console.warn(`[MidiService] Device disconnected: "${portName}"`);
      this.inputPort = null;
      this.outputPort = null;
      this.litKeys.clear(); // Physical keys are off, reset tracking
      this.emitStateChange({
        isConnected: false,
        inputName: null,
        outputName: null,
        lastError: `${this.deviceBrand ?? 'Keyboard'} disconnected. Reconnect USB cable.`,
        keyboardMin: 36,
        keyboardMax: 96,
      });
    } else if (port.state === 'connected') {
      console.info(`[MidiService] Device reconnected: "${portName}"`);
      // 500ms delay — OS needs time to re-enumerate the USB device
      setTimeout(() => this.bindDevicePorts(), 500);
    }
  }

  // ─── Observer Pattern ──────────────────────────────────────────────────────

  onNoteEvent(cb: NoteEventCallback): () => void {
    this.onNoteEventCallbacks.add(cb);
    return () => this.onNoteEventCallbacks.delete(cb);
  }

  onDeviceStateChange(cb: StateChangeCallback): () => void {
    this.onStateChangeCallbacks.add(cb);
    return () => this.onStateChangeCallbacks.delete(cb);
  }

  private emitStateChange(partial: Partial<MidiDeviceState>): void {
    this.deviceState = { ...this.deviceState, ...partial };
    for (const cb of this.onStateChangeCallbacks) {
      cb(this.deviceState);
    }
  }

  getDeviceState(): MidiDeviceState {
    return { ...this.deviceState };
  }

  getKeyboardRange(): { min: number; max: number } {
    return { ...this.keyboardRange };
  }

  onRangeChange(cb: (range: { min: number; max: number }) => void): () => void {
    this.onRangeChangeCallbacks.add(cb);
    return () => this.onRangeChangeCallbacks.delete(cb);
  }
}

export const midiService = MidiService.getInstance();
