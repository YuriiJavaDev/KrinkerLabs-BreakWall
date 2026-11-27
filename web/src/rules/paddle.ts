// The paddle: following the player, returning the ball, holding it when sticky, and the shaky face of a stunned paddle.
import { aim, bounceAngle } from '../physics/bounce';
import { FIELD_W, MAX_BOUNCE_ANGLE, PADDLE_MAX_SPEED, SPEED_UP_PER_PADDLE_HIT, TIME_BOMB } from './config';
import { Ball, Game, random } from './state';

export function movePaddle(g: Game, targetX: number | null, dt: number) {
  const p = g.paddle, half = p.w / 2;
  const goal = targetX === null ? p.x : Math.min(FIELD_W - half, Math.max(half, targetX));
  const maxMove = PADDLE_MAX_SPEED * dt;
  const move = Math.min(maxMove, Math.max(-maxMove, goal - p.x));
  p.x += move;
  p.vx = move / dt;
  for (const b of g.balls) if (b.stuck !== null) { b.x = p.x + b.stuck; b.y = p.top - b.r; }
}

/** A ball meets the paddle at `offset` (-1 left edge … 1 right edge). */
export function hitPaddle(g: Game, ball: Ball, offset: number) {
  g.combo = 0;
  g.idle = 0;
  g.events.push('paddle');
  if (ball.kind === 'normal' && g.effects.sticky > 0) {
    g.effects.sticky -= 1;
    // the ball stays where it touched: offset is measured over half the paddle plus the ball's radius
    ball.stuck = offset * (g.paddle.w / 2 + ball.r);
    ball.vx = 0; ball.vy = 0;
    return;
  }
  g.speed = Math.min(g.tier.maxSpeed, g.speed * SPEED_UP_PER_PADDLE_HIT);
  let angle = bounceAngle(offset, g.paddle.vx);
  // a stunned paddle has a wavy, cracked face: the ball leaves it at a slightly wrong angle
  if (g.effects.stun > 0) angle = Math.max(-MAX_BOUNCE_ANGLE, Math.min(MAX_BOUNCE_ANGLE, angle + (random(g) * 2 - 1) * TIME_BOMB.stunAngle));
  aim(ball, angle, ball.kind === 'bomb' ? g.speed * 0.85 : g.speed);
}

/** Lets go of balls held by a sticky paddle, each at the angle of where it sits. */
export function launchStuck(g: Game): boolean {
  let any = false;
  for (const b of g.balls) {
    if (b.stuck === null) continue;
    aim(b, bounceAngle(b.stuck / (g.paddle.w / 2 + b.r), 0), g.speed);
    b.stuck = null;
    any = true;
  }
  if (any) g.events.push('launch');
  return any;
}
