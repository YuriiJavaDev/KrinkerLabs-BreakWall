import { FIELD_H, FIELD_W } from '../rules/config';
import { Ball, Game } from '../rules/state';
import { Hit, sweepCirclePoint, sweepCirclePoly } from './sweep';

export type ContactKind = 'none' | 'wall' | 'paddle' | 'brick' | 'bumper' | 'spinner' | 'barrier';

/** The earliest thing the ball touches on its move by (dx, dy). Reused between calls so the game loop does not allocate. */
export interface Contact extends Hit { kind: ContactKind; index: number; paddleOffset: number }

export const newContact = (): Contact => ({ kind: 'none', t: Infinity, nx: 0, ny: 0, index: -1, paddleOffset: 0 });

/** Height of the one-time shield line at the bottom. */
export const BARRIER_Y = FIELD_H - 36;

const probe: Hit = { t: Infinity, nx: 0, ny: 0 };

/** `seconds` is the time the move takes, used to follow bricks that move themselves. */
export function firstContact(g: Game, ball: Ball, dx: number, dy: number, seconds: number, out: Contact): Contact {
  out.kind = 'none'; out.t = Infinity; out.index = -1;
  const { x, y, r } = ball;

  // side walls and the ceiling; the bottom is open
  if (dx < 0) take(out, (r - x) / dx, 1, 0, 'wall', -1);
  if (dx > 0) take(out, (FIELD_W - r - x) / dx, -1, 0, 'wall', -1);
  if (dy < 0) take(out, (r - y) / dy, 0, 1, 'wall', -1);

  const minX = Math.min(x, x + dx) - r, maxX = Math.max(x, x + dx) + r, minY = Math.min(y, y + dy) - r, maxY = Math.max(y, y + dy) + r;
  for (let i = 0; i < g.bricks.length; i++) {
    const b = g.bricks[i];
    if (b.hits <= 0) continue;
    const drift = Math.abs(b.vx * seconds);
    if (b.x1 + drift < minX || b.x0 - drift > maxX || b.y1 < minY || b.y0 > maxY) continue;
    // a moving brick: look at the ball's move as seen from the brick
    if (sweepCirclePoly(x, y, dx - b.vx * seconds, dy, r, b.poly, probe)) take(out, probe.t, probe.nx, probe.ny, 'brick', i);
  }

  const bumpers = g.level.bumpers;
  for (let i = 0; i < bumpers.length; i++) {
    const m = bumpers[i];
    if (sweepCirclePoint(x, y, dx, dy, r + m.r, m.x, m.y, probe)) take(out, probe.t, probe.nx, probe.ny, 'bumper', i);
  }
  for (let i = 0; i < g.spinners.length; i++) {
    if (sweepCirclePoly(x, y, dx, dy, r, g.spinners[i].poly, probe)) take(out, probe.t, probe.nx, probe.ny, 'spinner', i);
  }

  if (dy > 0) {
    // only the top face of the paddle returns the ball; a ball that slips past its end is lost
    const p = g.paddle, t = (p.top - r - y) / dy;
    if (t >= 0 && t <= 1 && t < out.t) {
      const hx = x + dx * t, reach = p.w / 2 + r;
      if (Math.abs(hx - p.x) <= reach) { take(out, t, 0, -1, 'paddle', -1); out.paddleOffset = (hx - p.x) / reach; }
    }
    if (g.effects.barrier) take(out, (BARRIER_Y - r - y) / dy, 0, -1, 'barrier', -1);
  }
  return out;
}

function take(out: Contact, t: number, nx: number, ny: number, kind: ContactKind, index: number) {
  if (!(t >= 0 && t <= 1) || t >= out.t) return;
  out.t = t; out.nx = nx; out.ny = ny; out.kind = kind; out.index = index;
}
