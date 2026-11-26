import { aim, bounceAngle, keepSteep } from '../physics/bounce';
import { firstContact, newContact } from '../physics/contact';
import { reflect } from '../physics/sweep';
import { FIELD_H, FIELD_W, LAUNCH_OFFSET, MAX_SPEED, PADDLE_MAX_SPEED, SPEED_UP_PER_PADDLE_HIT } from './config';
import { brickPoints } from './score';
import { Ball, Game } from './state';
import { loseBall, tickExtraBall } from './tray';

/** What the player asks for in one step: where the paddle should go (field x, or null to stay) and whether to launch. */
export interface StepInput { targetX: number | null; launch: boolean }

/** More contacts in one step than this only happen in a corner pocket; the rest of the move is dropped then. */
const MAX_CONTACTS_PER_STEP = 8;
const contact = newContact();

/** Advances the game by dt seconds. Call it with a fixed dt; the loop takes care of that. */
export function step(g: Game, input: StepInput, dt: number) {
  for (const b of g.balls) { b.prevX = b.x; b.prevY = b.y; }
  g.paddle.prevX = g.paddle.x;
  if (g.phase === 'won' || g.phase === 'over') return;
  movePaddle(g, input.targetX, dt);
  if (g.phase === 'serve') { holdOnPaddle(g); if (input.launch) launch(g); return; }

  for (let i = g.balls.length - 1; i >= 0; i--) {
    const drained = moveBall(g, g.balls[i], dt);
    if (g.phase !== 'play') return;
    if (drained) { g.balls.splice(i, 1); g.events.push('drain'); }
  }
  if (g.balls.length === 0) { loseBall(g); return; }
  tickExtraBall(g, dt);
}

function movePaddle(g: Game, targetX: number | null, dt: number) {
  const p = g.paddle, half = p.w / 2;
  const goal = targetX === null ? p.x : Math.min(FIELD_W - half, Math.max(half, targetX));
  const maxMove = PADDLE_MAX_SPEED * dt;
  const move = Math.min(maxMove, Math.max(-maxMove, goal - p.x));
  p.x += move;
  p.vx = move / dt;
}

function holdOnPaddle(g: Game) {
  const ball = g.balls[0];
  ball.x = g.paddle.x; ball.y = g.paddle.top - ball.r;
  ball.prevX = ball.x; ball.prevY = ball.y;
}

function launch(g: Game) {
  g.phase = 'play';
  aim(g.balls[0], bounceAngle(g.paddle.vx < 0 ? -LAUNCH_OFFSET : LAUNCH_OFFSET, 0), g.speed);
  g.events.push('launch');
}

/** Moves one ball through everything it meets in dt. Returns true when it fell out at the bottom. */
function moveBall(g: Game, ball: Ball, dt: number): boolean {
  let left = dt;
  for (let i = 0; i < MAX_CONTACTS_PER_STEP && left > 0; i++) {
    const dx = ball.vx * left, dy = ball.vy * left;
    firstContact(ball, dx, dy, g.bricks, g.paddle, contact);
    if (contact.kind === 'none') { ball.x += dx; ball.y += dy; break; }
    ball.x += dx * contact.t; ball.y += dy * contact.t;
    left *= 1 - contact.t;
    if (contact.kind === 'paddle') hitPaddle(g, ball, contact.paddleOffset);
    else { reflect(ball, contact.nx, contact.ny); keepSteep(ball); }
    if (contact.kind === 'wall') g.events.push('wall');
    if (contact.kind === 'brick') hitBrick(g, contact.brick);
    if (g.phase !== 'play') return false;
  }
  ball.x = Math.min(FIELD_W - ball.r, Math.max(ball.r, ball.x));
  return ball.y - ball.r > FIELD_H;
}

function hitPaddle(g: Game, ball: Ball, offset: number) {
  g.combo = 0;
  g.speed = Math.min(MAX_SPEED, g.speed * SPEED_UP_PER_PADDLE_HIT);
  aim(ball, bounceAngle(offset, g.paddle.vx), g.speed);
  g.events.push('paddle');
}

function hitBrick(g: Game, index: number) {
  const brick = g.bricks[index];
  brick.hits -= 1;
  g.events.push('brick');
  if (brick.hits > 0) return;
  g.bricksLeft -= 1;
  g.combo += 1;
  g.score += brickPoints(g.combo);
  if (g.bricksLeft === 0) { g.phase = 'won'; g.events.push('won'); }
}
