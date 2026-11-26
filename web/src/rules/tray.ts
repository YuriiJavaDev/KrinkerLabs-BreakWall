import { BALL_R, EXTRA_BALL_SECONDS, FIELD_BALLS_MAX, START_SPEED, TRAY_MAX } from './config';
import { Game, newBall } from './state';

/** Counts the time of the ball in play; every EXTRA_BALL_SECONDS one more ball goes into the tray, while the tray has room. */
export function tickExtraBall(g: Game, dt: number) {
  g.ballTime += dt;
  if (g.ballTime < g.nextExtraAt) return;
  g.nextExtraAt += EXTRA_BALL_SECONDS;
  if (g.tray >= TRAY_MAX) return;
  g.tray += 1;
  g.events.push('extra');
}

/** Progress (0..1) towards the next extra ball, or -1 while the tray is full. */
export function extraBallProgress(g: Game): number {
  if (g.tray >= TRAY_MAX) return -1;
  return Math.min(1, Math.max(0, 1 - (g.nextExtraAt - g.ballTime) / EXTRA_BALL_SECONDS));
}

/** Puts one more ball on the field (multiball). Refused when FIELD_BALLS_MAX are already there; the tray is not touched. */
export function addFieldBall(g: Game, x: number, y: number, vx: number, vy: number): boolean {
  if (g.phase !== 'play' || g.balls.length >= FIELD_BALLS_MAX) return false;
  const ball = newBall(x, y);
  ball.vx = vx; ball.vy = vy;
  g.balls.push(ball);
  return true;
}

/** The last ball on the field is gone: one ball leaves the tray, and the next one waits on the paddle, or the game ends. */
export function loseBall(g: Game) {
  g.tray -= 1;
  g.combo = 0;
  g.speed = START_SPEED;
  if (g.tray <= 0) { g.tray = 0; g.balls.length = 0; g.phase = 'over'; g.events.push('over'); return; }
  g.events.push('lost');
  serve(g);
}

/** A fresh ball on the paddle; its time for the extra ball starts from zero. */
export function serve(g: Game) {
  g.phase = 'serve';
  g.balls = [newBall(g.paddle.x, g.paddle.top - BALL_R)];
  g.ballTime = 0;
  g.nextExtraAt = EXTRA_BALL_SECONDS;
  g.events.push('serve');
}
