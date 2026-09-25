// Equal temperament, with A4 = 440 Hz. Array position 0 represents numeral 1.
export const NOTE_PITCHES = [
  { name: 'C4', frequency: 440 * 2 ** (-9 / 12) },
  { name: 'D4', frequency: 440 * 2 ** (-7 / 12) },
  { name: 'E4', frequency: 440 * 2 ** (-5 / 12) },
  { name: 'F4', frequency: 440 * 2 ** (-4 / 12) },
  { name: 'G4', frequency: 440 * 2 ** (-2 / 12) },
  { name: 'A4', frequency: 440 },
  { name: 'B4', frequency: 440 * 2 ** (2 / 12) },
] as const;

const NOTE_SECONDS = 0.65;
const GAP_SECONDS = 0.12;
const STEP_SECONDS = NOTE_SECONDS + GAP_SECONDS;

type Voice = { oscillator: OscillatorNode; gain: GainNode };
type AudioContextFactory = () => AudioContext;

function createAudioContext(): AudioContext {
  if (typeof globalThis.AudioContext !== 'function') {
    throw new Error('当前浏览器不支持单音播放，请换用支持 Web Audio 的浏览器。');
  }
  return new AudioContext();
}

/** One monophonic session. New playback always replaces the previous session. */
export class NotePlayer {
  private context: AudioContext | null = null;
  private voices = new Set<Voice>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cancelPending: (() => void) | undefined;
  private request = 0;
  private disposed = false;
  private activeIndex: number | null = null;
  private onIndex: (index: number | null) => void;
  private contextFactory: AudioContextFactory;
  private onContextStateChange = () => {
    // Losing the audio device or an OS interruption must cancel scheduled notes,
    // otherwise they could unexpectedly resume after the learner has moved on.
    if (this.context && this.context.state !== 'running') this.stop();
  };

  constructor(onIndex: (index: number | null) => void, contextFactory = createAudioContext) {
    this.onIndex = onIndex;
    this.contextFactory = contextFactory;
  }

  /** Resolves when scheduled, or quietly when cancelled; current startup failures reject. */
  async play(notes: readonly number[]): Promise<void> {
    if (this.disposed) throw new Error('播放器已关闭。');
    this.stop();
    if (notes.length === 0) return;
    if (notes.some((note) => !Number.isInteger(note) || note < 1 || note > 7)) {
      throw new Error('仅支持数字 1～7 的单音。');
    }

    // Keep the answer stable even if the caller changes its array while resume is pending.
    const sequence = [...notes];
    const request = this.request;
    try {
      let context = this.context;
      if (!context || context.state === 'closed') {
        context?.removeEventListener('statechange', this.onContextStateChange);
        context = this.contextFactory();
        this.context = context;
        context.addEventListener('statechange', this.onContextStateChange);
      }
      if (context.state !== 'running') {
        // Call resume synchronously inside the click gesture. Cancellation also settles
        // play() if a browser leaves resume pending, without allowing a late start.
        const resumed = context.resume();
        const cancelled = new Promise<void>((resolve) => { this.cancelPending = resolve; });
        await Promise.race([resumed, cancelled]);
      }
      if (request !== this.request || this.disposed) return;
      this.cancelPending = undefined;
      if (context.state !== 'running') throw new Error('音频未能启动，请再次点击播放。');

      const start = context.currentTime + 0.02;
      const end = start + (sequence.length - 1) * STEP_SECONDS + NOTE_SECONDS;
      sequence.forEach((note, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const voice = { oscillator, gain };
        this.voices.add(voice);
        const at = start + index * STEP_SECONDS;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(NOTE_PITCHES[note - 1].frequency, at);
        // A gentle attack and release prevent clicks; the low peak leaves headroom.
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.16, at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.10, at + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, at + NOTE_SECONDS - 0.02);
        gain.gain.linearRampToValueAtTime(0, at + NOTE_SECONDS);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          this.releaseVoice(voice);
          if (request === this.request && index === sequence.length - 1) this.stop();
        };
        oscillator.start(at);
        oscillator.stop(at + NOTE_SECONDS);
      });

      // Schedule sound against the audio clock, not JS timers. Only the visual
      // highlight polls, so a delayed frame cannot stretch or overlap the notes.
      const syncHighlight = () => {
        if (request !== this.request || this.disposed) return;
        if (context.state !== 'running' || context.currentTime >= end) {
          this.stop();
          return;
        }
        if (context.currentTime >= start) {
          this.setIndex(Math.min(sequence.length - 1, Math.floor((context.currentTime - start) / STEP_SECONDS)));
        }
        if (request === this.request) this.timer = setTimeout(syncHighlight, 25);
      };
      this.setIndex(0);
      syncHighlight();
    } catch (error) {
      // A stale resume failure must not clear a newer playback or surface its error.
      if (request !== this.request || this.disposed) return;
      this.stop();
      throw error;
    }
  }

  stop(): void {
    this.request += 1;
    this.cancelPending?.();
    this.cancelPending = undefined;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    for (const voice of this.voices) {
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch { /* Already ended or not yet started. */ }
      this.releaseVoice(voice);
    }
    this.setIndex(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.onIndex = () => {};
    const context = this.context;
    this.context = null;
    context?.removeEventListener('statechange', this.onContextStateChange);
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  private setIndex(index: number | null): void {
    if (this.activeIndex === index) return;
    this.activeIndex = index;
    this.onIndex(index);
  }

  private releaseVoice(voice: Voice): void {
    voice.oscillator.onended = null;
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }
}
