// Bonuses: the capsule a broken bonus brick drops, catching it with the paddle, what each bonus does and how long.
import { BonusKind, HARMFUL } from '../levels/level';
import {
  CAPSULE_R, CAPSULE_SPEED, COMET_SECONDS, FAST, FIELD_H, FIELD_W, LASER, NARROW, SLOW, STICKY_CATCHES, TIME_BOMB, WIDE,
} from './config';
import { launchStuck } from './paddle';
import { Brick, Game } from './state';
import { addFieldBall, addToTray, splitBalls } from './tray';

/** A broken bonus brick drops its capsule; the time bomb needs no catching and goes straight onto the field. */
export function releaseBonus(g: Game, b: Brick) {
  if (!b.bonus) return;
  if (b.bonus === 'timebomb') { spawnTimeBomb(g, b.cx, b.cy); return; }
  g.capsules.push({ kind: b.bonus, x: b.cx, y: b.cy, prevY: b.cy });
  g.events.push('capsule');
}

/** A ball with a clock comes out of the brick and falls towards the paddle. No room on the field: no bomb. */
export function spawnTimeBomb(g: Game, x: number, y: number): boolean {
  const speed = g.speed * 0.85;
  if (!addFieldBall(g, x, y, speed * 0.34, speed * 0.94, 'bomb')) return false;
  g.balls[g.balls.length - 1].fuse = TIME_BOMB.fuse;
  g.lastBonus = 'timebomb';
  g.events.push('capsule');
  return true;
}

/** Capsules fall; one that touches the paddle is caught and works, one that falls past is lost. */
export function moveCapsules(g: Game, dt: number) {
  const p = g.paddle, half = p.w / 2;
  for (let i = g.capsules.length - 1; i >= 0; i--) {
    const c = g.capsules[i];
    c.prevY = c.y;
    c.y += CAPSULE_SPEED * dt;
    const caught = c.y + CAPSULE_R >= p.top && c.y - CAPSULE_R <= p.top + p.h && Math.abs(c.x - p.x) <= half + CAPSULE_R;
    if (caught) {
      g.capsules.splice(i, 1);
      applyBonus(g, c.kind);
      g.fx.push({ kind: 'catch', x: c.x, y: p.top, r: 40, color: HARMFUL.has(c.kind) ? 1 : 0 });
    } else if (c.y - CAPSULE_R > FIELD_H) g.capsules.splice(i, 1);
  }
}

/** What each bonus does. One size of the paddle and one "weapon" (laser or sticky) at a time; a new one replaces the old. */
export function applyBonus(g: Game, kind: BonusKind) {
  const e = g.effects;
  g.lastBonus = kind;
  g.events.push(HARMFUL.has(kind) ? 'harm' : 'bonus');
  switch (kind) {
    case 'wide': e.size = { kind: 'wide', left: WIDE.seconds }; break;
    case 'narrow': e.size = { kind: 'narrow', left: NARROW.seconds }; break;
    case 'slow': e.pace = { kind: 'slow', left: SLOW.seconds }; break;
    case 'fast': e.pace = { kind: 'fast', left: FAST.seconds }; break;
    case 'second': splitBalls(g, 1); break;
    case 'multi': splitBalls(g, 2); break;
    case 'extra': addToTray(g); break;
    case 'laser': e.laser = LASER.seconds; e.sticky = 0; launchStuck(g); break;
    case 'sticky': e.sticky = STICKY_CATCHES; e.laser = 0; break;
    case 'comet': e.comet = COMET_SECONDS; break;
    case 'shield': e.barrier = true; break;
    case 'bomb': e.bomb = true; break;
    case 'timebomb': spawnTimeBomb(g, FIELD_W / 2, g.paddle.top - 300); break;
  }
  fitPaddle(g);
}

/** Time runs out for timed bonuses and for the stunned paddle. */
export function tickEffects(g: Game, dt: number) {
  const e = g.effects;
  if (e.size && (e.size.left -= dt) <= 0) e.size = null;
  if (e.pace && (e.pace.left -= dt) <= 0) e.pace = null;
  e.laser = Math.max(0, e.laser - dt);
  e.laserWait = Math.max(0, e.laserWait - dt);
  e.comet = Math.max(0, e.comet - dt);
  e.stun = Math.max(0, e.stun - dt);
  fitPaddle(g);
}

/** The paddle's width from its tier, the size bonus and the stun; it is kept inside the field. */
export function fitPaddle(g: Game) {
  const e = g.effects, p = g.paddle;
  const size = e.size ? (e.size.kind === 'wide' ? WIDE.scale : NARROW.scale) : 1;
  p.w = p.baseW * size * (e.stun > 0 ? TIME_BOMB.stunScale : 1);
  p.x = Math.min(FIELD_W - p.w / 2, Math.max(p.w / 2, p.x));
}

/** How fast balls move compared with their speed: slower or faster while a pace bonus works. */
export const pace = (g: Game) => (g.effects.pace ? (g.effects.pace.kind === 'slow' ? SLOW.pace : FAST.pace) : 1);
