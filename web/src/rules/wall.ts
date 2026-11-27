// The wall over time: moving rows, the creeping wall and its danger line, regrowing bricks, flashes, turning bars.
import { distanceTo } from '../levels/shapes';
import { placeBrick } from './bricks';
import { DANGER_Y, WALL_BACK_STEPS, WALL_SLIDE } from './config';
import { Game } from './state';
import { loseBall } from './tray';

/** Moves everything that moves by itself. Runs every step, also while a ball waits on the paddle. */
export function updateWall(g: Game, dt: number) {
  const playing = g.phase === 'play';
  if (playing) creep(g, dt);
  for (const b of g.bricks) {
    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
    let moved = false;
    if (b.move) {
      const x = b.move.amp * Math.sin(g.time * b.move.speed + b.move.phase);
      b.vx = (x - b.ox) / dt;
      b.ox = x; moved = true;
    }
    if (b.oy !== g.wall.drop) { b.oy = g.wall.drop; moved = true; }
    if (moved) placeBrick(b);
    if (b.regenAt > 0 && g.time >= b.regenAt) regrow(g, b);
  }
  // checked after the bricks moved, so the wall is caught in the same step it reaches the line
  if (playing && g.level.descend > 0 && lowestBrick(g) >= DANGER_Y) crush(g);
  for (const s of g.spinners) {
    if (playing) s.angle += s.spec.speed * dt;
    spinnerPoly(s.spec.x, s.spec.y, s.spec.length, s.spec.width, s.angle, s.poly);
  }
}

/** A regrowing brick comes back, unless a ball is in its place right now (then it waits a moment). */
function regrow(g: Game, b: Game['bricks'][number]) {
  if (g.balls.some((ball) => distanceTo(b.poly, ball.x, ball.y) <= ball.r + 2)) { b.regenAt = g.time + 0.5; return; }
  b.regenAt = 0;
  b.hits = b.maxHits;
  b.flash = 0.4;
  b.version += 1;
  g.bricksLeft += 1;
  g.events.push('regrow');
}

/** The creeping wall goes one step down at the level's interval and slides there; reaching the danger line costs a ball. */
function creep(g: Game, dt: number) {
  const w = g.wall, every = g.level.descend;
  if (every > 0) {
    w.timer += dt;
    if (w.timer >= every) { w.timer -= every; w.target += g.level.step; g.events.push('creep'); }
  }
  if (w.drop !== w.target) {
    const stepBy = WALL_SLIDE * dt;
    w.drop = w.drop < w.target ? Math.min(w.target, w.drop + stepBy) : Math.max(w.target, w.drop - stepBy * 3);
  }
}

/** The bottom of the lowest brick that still has to break. */
export function lowestBrick(g: Game): number {
  let low = -Infinity;
  for (const b of g.bricks) if (b.hits > 0 && b.kind !== 'steel' && b.y1 > low) low = b.y1;
  return low;
}

/** The wall reached the line: a ball is lost and the wall goes back up a few steps. */
function crush(g: Game) {
  g.wall.target = Math.max(0, g.wall.target - WALL_BACK_STEPS * g.level.step);
  g.wall.drop = g.wall.target;
  for (const b of g.bricks) { b.oy = g.wall.drop; placeBrick(b); }
  g.events.push('crush');
  g.fx.push({ kind: 'crush', x: g.paddle.x, y: DANGER_Y, r: 0, color: 0 });
  loseBall(g);
}

/** A turning bar as a rectangle around (x, y), written into `out` (8 numbers, clockwise). */
export function spinnerPoly(x: number, y: number, length: number, width: number, angle: number, out: number[]) {
  const c = Math.cos(angle), s = Math.sin(angle), hl = length / 2, hw = width / 2;
  for (let i = 0; i < 4; i++) {
    const u = CORNERS[2 * i] * hl, v = CORNERS[2 * i + 1] * hw;
    out[2 * i] = x + u * c - v * s; out[2 * i + 1] = y + u * s + v * c;
  }
}
const CORNERS = [-1, -1, 1, -1, 1, 1, -1, 1];
