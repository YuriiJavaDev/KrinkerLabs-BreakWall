// Short-lived pieces of the picture: shards of a broken brick, sparks, rings of a blast or a portal.
// A fixed pool, so a busy moment allocates nothing.
import { Fx } from '../rules/state';

interface Piece { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; colour: string; alive: boolean }
interface Ring { x: number; y: number; r: number; grow: number; life: number; max: number; colour: string; alive: boolean }

const PIECES = 420, RINGS = 24;

export class Particles {
  private pieces: Piece[] = Array.from({ length: PIECES }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, colour: '#fff', alive: false }));
  private rings: Ring[] = Array.from({ length: RINGS }, () => ({ x: 0, y: 0, r: 0, grow: 0, life: 0, max: 1, colour: '#fff', alive: false }));
  private next = 0;
  private nextRing = 0;
  private seed = 1;

  constructor(private reduceMotion: boolean) {}

  private rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  /** Turns what happened in the game into pieces; `colourOf` gives a colour for a brick colour index. */
  add(fx: Fx, colourOf: (i: number) => string, accent: string) {
    const many = this.reduceMotion ? 0.4 : 1;
    switch (fx.kind) {
      case 'shards': this.burst(fx.x, fx.y, Math.round(14 * many), 260, 0.7, 5, colourOf(fx.color)); break;
      case 'spark': this.burst(fx.x, fx.y, Math.round(6 * many), 200, 0.35, 2.5, '#fff6d5'); break;
      case 'blast': this.ring(fx.x, fx.y, fx.r, 0.55, '#ffb347'); this.burst(fx.x, fx.y, Math.round(40 * many), 520, 0.8, 4, '#ffd27a'); break;
      case 'portal': this.ring(fx.x, fx.y, fx.r * 1.4, 0.4, fx.color ? '#ff4fd8' : '#22d3ee'); break;
      case 'catch': this.ring(fx.x, fx.y, fx.r, 0.35, fx.color ? '#ff4d6d' : accent); break;
      case 'crush': this.ring(fx.x, fx.y, 380, 0.6, '#ff4d6d'); break;
    }
  }

  private burst(x: number, y: number, count: number, speed: number, life: number, size: number, colour: string) {
    for (let i = 0; i < count; i++) {
      const p = this.pieces[this.next];
      this.next = (this.next + 1) % PIECES;
      const a = this.rnd() * Math.PI * 2, s = speed * (0.3 + this.rnd() * 0.7);
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 60; p.life = p.max = life * (0.6 + this.rnd() * 0.6);
      p.size = size * (0.5 + this.rnd()); p.colour = colour; p.alive = true;
    }
  }

  private ring(x: number, y: number, r: number, life: number, colour: string) {
    const ring = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % RINGS;
    ring.x = x; ring.y = y; ring.r = r * 0.2; ring.grow = r * 0.8; ring.life = ring.max = life; ring.colour = colour; ring.alive = true;
  }

  /** Moves and draws everything still alive; `dt` in seconds of the screen, not of the game. */
  draw(g: CanvasRenderingContext2D, dt: number) {
    for (const p of this.pieces) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = p.life / p.max;
      g.fillStyle = p.colour;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.lineWidth = 4;
    for (const r of this.rings) {
      if (!r.alive) continue;
      r.life -= dt;
      if (r.life <= 0) { r.alive = false; continue; }
      const k = 1 - r.life / r.max;
      g.globalAlpha = (1 - k) * 0.9;
      g.strokeStyle = r.colour;
      g.beginPath(); g.arc(r.x, r.y, r.r + r.grow * k, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  }
}
