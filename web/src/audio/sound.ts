import { WorldId } from '../levels/tiers';
import { GameEvent } from '../rules/state';

// Every sound is synthesised here: no audio files, no samples, no tunes from anywhere else.
// The audio context starts on the first tap or key, as browsers require.

interface Tone { freq: number; to: number; length: number; wave?: OscillatorType; volume: number; noise?: boolean }

/** Events without a tone play nothing. The wave of most tones comes from the world. */
const TONES: Partial<Record<GameEvent, Tone>> = {
  launch: { freq: 520, to: 780, length: 0.09, volume: 0.16 },
  wall: { freq: 300, to: 280, length: 0.04, wave: 'square', volume: 0.05 },
  paddle: { freq: 220, to: 330, length: 0.07, volume: 0.18 },
  brick: { freq: 660, to: 620, length: 0.07, volume: 0.08 },
  crack: { freq: 420, to: 380, length: 0.05, volume: 0.07 },
  clank: { freq: 1500, to: 1300, length: 0.06, wave: 'square', volume: 0.05 },
  steel: { freq: 1800, to: 1700, length: 0.08, wave: 'square', volume: 0.05 },
  drain: { freq: 300, to: 150, length: 0.25, volume: 0.1 },
  lost: { freq: 330, to: 110, length: 0.45, wave: 'sawtooth', volume: 0.11 },
  extra: { freq: 784, to: 1568, length: 0.35, volume: 0.15 },
  capsule: { freq: 900, to: 1100, length: 0.08, volume: 0.06 },
  bonus: { freq: 600, to: 1400, length: 0.22, volume: 0.14 },
  harm: { freq: 500, to: 180, length: 0.3, wave: 'sawtooth', volume: 0.1 },
  laser: { freq: 1700, to: 500, length: 0.08, wave: 'sawtooth', volume: 0.05 },
  explode: { freq: 140, to: 40, length: 0.5, volume: 0.22, noise: true },
  bump: { freq: 880, to: 990, length: 0.07, volume: 0.1 },
  portal: { freq: 300, to: 1200, length: 0.25, wave: 'sine', volume: 0.1 },
  tick: { freq: 2000, to: 2000, length: 0.025, wave: 'square', volume: 0.05 },
  stun: { freq: 200, to: 90, length: 0.6, wave: 'sawtooth', volume: 0.12 },
  crush: { freq: 120, to: 50, length: 0.6, wave: 'sawtooth', volume: 0.16 },
  creep: { freq: 90, to: 70, length: 0.2, wave: 'sine', volume: 0.12 },
  regrow: { freq: 400, to: 700, length: 0.18, wave: 'sine', volume: 0.06 },
  won: { freq: 523, to: 1046, length: 0.7, volume: 0.2 },
  over: { freq: 262, to: 98, length: 0.8, wave: 'sawtooth', volume: 0.11 },
};

/** Each world sounds different: glassy in the laboratory, electric in the city, low and rough in the reactor. */
const WORLD_SOUND: Record<WorldId, { wave: OscillatorType; pitch: number }> = {
  lab: { wave: 'triangle', pitch: 1 },
  neon: { wave: 'square', pitch: 1.18 },
  reactor: { wave: 'sawtooth', pitch: 0.72 },
};

/** Each brick in a row sounds a semitone higher, up to an octave. */
export const comboPitch = (combo: number) => Math.pow(2, Math.min(Math.max(0, combo - 1), 12) / 12);

export class Sound {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private world: WorldId = 'lab';
  constructor(public enabled: boolean) {}

  setWorld(world: WorldId) { this.world = world; }

  /** Call from a user gesture. */
  unlock() {
    if (this.ctx || typeof AudioContext === 'undefined') { void this.ctx?.resume(); return; }
    try { this.ctx = new AudioContext(); } catch { this.ctx = null; }
  }

  play(event: GameEvent, combo: number) {
    const ctx = this.ctx, tone = TONES[event];
    if (!this.enabled || !ctx || ctx.state !== 'running' || !tone) return;
    const w = WORLD_SOUND[this.world], now = ctx.currentTime;
    const pitch = w.pitch * (event === 'brick' ? comboPitch(combo) : 1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(tone.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.length);
    gain.connect(ctx.destination);
    if (tone.noise) this.rumble(ctx, gain, now, tone.length);
    const osc = ctx.createOscillator();
    osc.type = tone.wave ?? w.wave;
    osc.frequency.setValueAtTime(tone.freq * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, tone.to * pitch), now + tone.length);
    osc.connect(gain);
    osc.start(now); osc.stop(now + tone.length + 0.02);
  }

  /** A blast: noise made here from random numbers, darkened by a low-pass filter. */
  private rumble(ctx: AudioContext, out: GainNode, now: number, length: number) {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
    src.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.setValueAtTime(900, now); filter.frequency.exponentialRampToValueAtTime(120, now + length);
    src.connect(filter).connect(out);
    src.start(now); src.stop(now + length);
  }
}
