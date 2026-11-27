import { FIELD_BALLS_MAX, SPLIT_ANGLE, TRAY_MAX } from './config';
import { turn } from '../physics/sweep';
import { Game, newBall, noEffects } from './state';

/** Counts the time of the ball in play; every tier's interval one more ball goes into the tray, while the tray has room. */
export function tickExtraBall(g: Game, dt: number) {
  g.ballTime += dt;
  if (g.ballTime < g.nextExtraAt) return;
  g.nextExtraAt += g.tier.extraBallSeconds;
  addToTray(g);
}

export function addToTray(g: Game): boolean {
  if (g.tray >= TRAY_MAX) return false;
  g.tray += 1;
  g.events.push('extra');
  return true;
}

/** Progress (0..1) towards the next extra ball, or -1 while the tray is full. */
export function extraBallProgress(g: Game): number {
  if (g.tray >= TRAY_MAX) return -1;
  const every = g.tier.extraBallSeconds;
  return Math.min(1, Math.max(0, 1 - (g.nextExtraAt - g.ballTime) / every));
}

/** Balls that count for the tray: the time bomb is not one of them. */
export const playBalls = (g: Game) => g.balls.filter((b) => b.kind === 'normal');

/** Puts one more ball on the field (multiball). Refused when FIELD_BALLS_MAX are already there; the tray is not touched. */
export function addFieldBall(g: Game, x: number, y: number, vx: number, vy: number, kind: 'normal' | 'bomb' = 'normal'): boolean {
  if (g.phase !== 'play' || g.balls.length >= FIELD_BALLS_MAX) return false;
  const ball = newBall(x, y, g.tier.ball, kind);
  ball.vx = vx; ball.vy = vy;
  g.balls.push(ball);
  return true;
}

/** New balls from a ball in play, turned a little to each side. */
export function splitBalls(g: Game, count: number) {
  const from = g.balls.find((b) => b.kind === 'normal' && b.stuck === null) ?? g.balls.find((b) => b.kind === 'normal');
  if (!from) return;
  const speed = Math.hypot(from.vx, from.vy) || g.speed;
  const vx = from.stuck === null ? from.vx : 0, vy = from.stuck === null ? from.vy : -speed;
  for (let i = 0; i < count; i++) {
    const v = { vx, vy };
    turn(v, (i % 2 === 0 ? 1 : -1) * SPLIT_ANGLE * (1 + Math.floor(i / 2)));
    addFieldBall(g, from.x, from.y - (from.stuck === null ? 0 : 2), v.vx, v.vy);
  }
}

/** The last ball on the field is gone: one ball leaves the tray, and the next one waits on the paddle, or the game ends. */
export function loseBall(g: Game) {
  g.tray -= 1;
  g.lost += 1;
  g.combo = 0;
  if (g.tray <= 0) { g.tray = 0; g.balls.length = 0; g.capsules.length = 0; g.phase = 'over'; g.events.push('over'); return; }
  g.events.push('lost');
  serve(g);
}

/** A fresh ball on the paddle; its time for the extra ball starts from zero. Falling capsules and shots are cleared. */
export function serve(g: Game) {
  g.phase = 'serve';
  g.speed = g.level.startSpeed ?? g.tier.startSpeed;
  g.balls = [newBall(g.paddle.x, g.paddle.top - g.tier.ball, g.tier.ball)];
  g.capsules.length = 0;
  g.shots.length = 0;
  // bonuses end with the ball; a shield at the bottom stays until it is used
  g.effects = { ...noEffects(), barrier: g.effects.barrier };
  g.ballTime = 0;
  g.nextExtraAt = g.tier.extraBallSeconds;
  g.idle = 0;
  g.events.push('serve');
}
