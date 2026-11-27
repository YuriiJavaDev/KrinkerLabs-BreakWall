// What a hit does to a brick, and blasts. A hit comes from a ball, a laser shot, a comet ball or a blast.
import { distanceTo } from '../levels/shapes';
import { releaseBonus } from './bonuses';
import { placeBrick } from './bricks';
import { finishLevel } from './finish';
import { BOMB_RADIUS, EXPLOSIVE_RADIUS, FLASH_SECONDS, REGEN_RUN, REGEN_SECONDS, TIME_BOMB } from './config';
import { brickPoints } from './score';
import { Brick, Game } from './state';

export type HitSource = 'ball' | 'laser' | 'comet' | 'blast';

/**
 * A shield brick breaks only from its weak side: the contact normal (pointing out of the brick) must face the way
 * the weak side faces. Hits on the armour (front and sides) only bounce.
 */
export const hitsWeakSide = (b: Brick, nx: number, ny: number) => !b.weak || nx * b.weak[0] + ny * b.weak[1] > 0.5;

/**
 * A brick is hit at a point with outward normal (nx, ny). Returns true when the hit did damage
 * (false: steel, armour, or a brick that is already broken).
 */
export function hitBrick(g: Game, index: number, nx: number, ny: number, source: HitSource): boolean {
  const b = g.bricks[index];
  if (b.hits <= 0) return false;
  if (b.kind === 'steel') { clank(g, b, source); return false; }
  if (b.kind === 'shield') {
    if (source === 'blast') return false;
    if (source !== 'comet' && !hitsWeakSide(b, nx, ny)) { clank(g, b, source); return false; }
  }
  g.idle = 0;
  if (source === 'ball' && g.effects.bomb) {
    g.effects.bomb = false;
    explode(g, b.cx - nx * 4, b.cy - ny * 4, BOMB_RADIUS, false);
    return true;
  }
  const whole = (source === 'comet' || source === 'blast') && b.kind !== 'core';
  damage(g, b, whole ? b.hits : 1, source === 'blast');
  return true;
}

function clank(g: Game, b: Brick, source: HitSource) {
  if (source === 'blast') return;
  g.events.push(b.kind === 'steel' ? 'steel' : 'clank');
  g.fx.push({ kind: 'spark', x: b.cx, y: b.cy, r: 18, color: b.color });
}

/** Takes `amount` off a brick's strength; at zero it breaks. */
function damage(g: Game, b: Brick, amount: number, byBlast: boolean) {
  b.hits = Math.max(0, b.hits - amount);
  b.flash = FLASH_SECONDS;
  b.version += 1;
  if (b.hits > 0) {
    if (b.kind === 'morph') { b.stage = Math.min(b.shapes.length - 1, b.maxHits - b.hits); placeBrick(b); }
    g.events.push('crack');
    return;
  }
  breakBrick(g, b, byBlast);
}

function breakBrick(g: Game, b: Brick, byBlast: boolean) {
  g.bricksLeft -= 1;
  if (!byBlast) g.combo += 1;
  const points = brickPoints(g.combo, b.maxHits, g.tier.multiplier, !!b.bonus, byBlast);
  g.score += points;
  g.levelPoints += points;
  g.events.push('brick');
  g.fx.push({ kind: 'shards', x: b.cx, y: b.cy, r: Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2, color: b.color });
  releaseBonus(g, b);
  b.bonus = null;
  // a regrowing brick broken in a run of three or more stays broken; on its own it comes back
  if (b.kind === 'regen' && (byBlast || g.combo < REGEN_RUN)) b.regenAt = g.time + REGEN_SECONDS;
  if (b.kind === 'explosive') explode(g, b.cx, b.cy, EXPLOSIVE_RADIUS, false);
  if (g.bricksLeft <= 0) finishLevel(g);
}

/**
 * A blast at (x, y): every brick that reaches into the circle breaks (the core loses one point of strength);
 * steel and shield bricks stand. Explosive bricks set off their own blasts. A time bomb's blast also stuns the paddle it reaches.
 */
export function explode(g: Game, x: number, y: number, radius: number, stunsPaddle: boolean) {
  g.events.push('explode');
  g.fx.push({ kind: 'blast', x, y, r: radius, color: 0 });
  for (const b of g.bricks) {
    if (b.hits <= 0 || b.kind === 'steel' || b.kind === 'shield') continue;
    if (b.x1 < x - radius || b.x0 > x + radius || b.y1 < y - radius || b.y0 > y + radius) continue;
    if (distanceTo(b.poly, x, y) > radius) continue;
    damage(g, b, b.kind === 'core' ? 1 : b.hits, true);
  }
  if (stunsPaddle && paddleInCircle(g, x, y, radius)) {
    g.effects.stun = TIME_BOMB.stunSeconds;
    g.events.push('stun');
  }
}

/** True when the circle reaches the paddle's rectangle. */
export function paddleInCircle(g: Game, x: number, y: number, radius: number): boolean {
  const p = g.paddle, half = p.w / 2;
  const nx = Math.max(p.x - half, Math.min(p.x + half, x)), ny = Math.max(p.top, Math.min(p.top + p.h, y));
  return Math.hypot(x - nx, y - ny) <= radius;
}
