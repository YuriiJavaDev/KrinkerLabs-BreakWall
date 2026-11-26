import { GameEvent } from '../rules/state';

// Every sound is synthesised here: no audio files. The audio context starts on the first tap or key, as browsers require.

interface Tone { freq: number; to: number; length: number; wave: OscillatorType; volume: number }

const TONES: Record<GameEvent, Tone> = {
  launch: { freq: 520, to: 780, length: 0.09, wave: 'triangle', volume: 0.18 },
  wall: { freq: 300, to: 280, length: 0.04, wave: 'square', volume: 0.06 },
  paddle: { freq: 220, to: 330, length: 0.07, wave: 'triangle', volume: 0.2 },
  brick: { freq: 660, to: 620, length: 0.06, wave: 'square', volume: 0.08 },
  lost: { freq: 330, to: 110, length: 0.45, wave: 'sawtooth', volume: 0.12 },
  won: { freq: 523, to: 1046, length: 0.6, wave: 'triangle', volume: 0.2 },
  over: { freq: 262, to: 98, length: 0.8, wave: 'sawtooth', volume: 0.12 },
};

/** Each brick in a row sounds a semitone higher, up to an octave. */
export const comboPitch = (combo: number) => Math.pow(2, Math.min(Math.max(0, combo - 1), 12) / 12);

export class Sound {
  private ctx: AudioContext | null = null;
  constructor(public enabled: boolean) {}

  /** Call from a user gesture. */
  unlock() {
    if (this.ctx || typeof AudioContext === 'undefined') { void this.ctx?.resume(); return; }
    try { this.ctx = new AudioContext(); } catch { this.ctx = null; }
  }

  play(event: GameEvent, combo: number) {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const tone = TONES[event], pitch = event === 'brick' ? comboPitch(combo) : 1, now = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = tone.wave;
    osc.frequency.setValueAtTime(tone.freq * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(tone.to * pitch, now + tone.length);
    gain.gain.setValueAtTime(tone.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + tone.length + 0.02);
  }
}
