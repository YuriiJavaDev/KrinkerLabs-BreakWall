import { Ball, Brick, Paddle } from '../rules/state';
import { FIELD_W } from '../rules/config';
import { Hit, sweepCircleBox } from './sweep';

export type ContactKind = 'none' | 'wall' | 'paddle' | 'brick';

/** The earliest thing the ball touches on its move by (dx, dy). Reused between calls so the game loop does not allocate. */
export interface Contact extends Hit { kind: ContactKind; brick: number; paddleOffset: number }

export const newContact = (): Contact => ({ kind: 'none', t: Infinity, nx: 0, ny: 0, brick: -1, paddleOffset: 0 });

const probe: Hit = { t: Infinity, nx: 0, ny: 0 };

export function firstContact(ball: Ball, dx: number, dy: number, bricks: readonly Brick[], paddle: Paddle, out: Contact): Contact {
  out.kind = 'none'; out.t = Infinity; out.brick = -1;
  const { x, y, r } = ball;

  // Side walls and the ceiling; the bottom is open.
  if (dx < 0) take(out, (r - x) / dx, 1, 0, 'wall');
  if (dx > 0) take(out, (FIELD_W - r - x) / dx, -1, 0, 'wall');
  if (dy < 0) take(out, (r - y) / dy, 0, 1, 'wall');

  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    if (b.hits <= 0) continue;
    if (sweepCircleBox(x, y, dx, dy, r, b.x0, b.y0, b.x1, b.y1, probe) && probe.t < out.t) {
      take(out, probe.t, probe.nx, probe.ny, 'brick'); out.brick = i;
    }
  }

  // Only the top face of the paddle returns the ball; a ball that slips past its end is lost, as in the classic game.
  if (dy > 0) {
    const t = (paddle.top - r - y) / dy;
    if (t >= 0 && t <= 1 && t < out.t) {
      const hx = x + dx * t, reach = paddle.w / 2 + r;
      if (Math.abs(hx - paddle.x) <= reach) { take(out, t, 0, -1, 'paddle'); out.paddleOffset = (hx - paddle.x) / reach; }
    }
  }
  return out;
}

function take(out: Contact, t: number, nx: number, ny: number, kind: ContactKind) {
  if (!(t >= 0 && t <= 1) || t >= out.t) return;
  out.t = t; out.nx = nx; out.ny = ny; out.kind = kind;
}
