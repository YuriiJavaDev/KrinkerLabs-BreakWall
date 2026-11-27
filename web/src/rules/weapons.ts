// The laser, and the time bomb's clock.
import { sweepCirclePoly, newHit } from '../physics/sweep';
import { LASER, TIME_BOMB } from './config';
import { explode, hitBrick } from './damage';
import { Game } from './state';

const SHOT_R = 4;
const hit = newHit();

/** Two shots from the ends of the paddle, while the laser works and it has cooled down. */
export function fireLaser(g: Game): boolean {
  const e = g.effects;
  if (e.laser <= 0 || e.laserWait > 0) return false;
  e.laserWait = LASER.wait;
  const p = g.paddle, inset = p.w / 2 - 14;
  g.shots.push({ x: p.x - inset, y: p.top - 4, prevY: p.top - 4 }, { x: p.x + inset, y: p.top - 4, prevY: p.top - 4 });
  g.events.push('laser');
  return true;
}

/** Shots fly up; the first brick in the way takes a hit (steel and the armour of shield bricks stop them). */
export function moveShots(g: Game, dt: number) {
  const dy = -LASER.speed * dt;
  for (let i = g.shots.length - 1; i >= 0; i--) {
    if (i >= g.shots.length) continue;
    const s = g.shots[i];
    s.prevY = s.y;
    let best = Infinity, index = -1, nx = 0, ny = 0;
    for (let k = 0; k < g.bricks.length; k++) {
      const b = g.bricks[k];
      if (b.hits <= 0 || s.x < b.x0 - SHOT_R || s.x > b.x1 + SHOT_R || b.y1 < s.y + dy - SHOT_R || b.y0 > s.y + SHOT_R) continue;
      if (sweepCirclePoly(s.x, s.y, 0, dy, SHOT_R, b.poly, hit) && hit.t < best) { best = hit.t; index = k; nx = hit.nx; ny = hit.ny; }
    }
    if (index >= 0) {
      g.shots.splice(i, 1);
      hitBrick(g, index, nx, ny, 'laser');
      // the hit may have cleared the level, and with it the shots
      if (g.phase !== 'play') return;
      continue;
    }
    s.y += dy;
    if (s.y < 0) g.shots.splice(i, 1);
  }
}

/** The clocks of time bombs run in real game time; at zero the bomb blows up where it is and is gone. */
export function tickBombs(g: Game, dt: number) {
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const b = g.balls[i];
    if (b.kind !== 'bomb') continue;
    const before = Math.ceil(b.fuse);
    b.fuse -= dt;
    if (Math.ceil(b.fuse) !== before && b.fuse > 0) g.events.push('tick');
    if (b.fuse > 0) continue;
    g.balls.splice(i, 1);
    explode(g, b.x, b.y, TIME_BOMB.radius, true);
  }
}
