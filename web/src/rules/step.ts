import { aim, bounceAngle, keepSteep } from '../physics/bounce';
import { firstContact, newContact } from '../physics/contact';
import { reflect } from '../physics/sweep';
import { FIELD_H, FIELD_W, LAUNCH_OFFSET, MAX_SPEED, PADDLE_MAX_SPEED, SPEED_UP_PER_PADDLE_HIT, START_SPEED } from './config';
import { brickPoints } from './score';
import { Game } from './state';

/** What the player asks for in one step: where the paddle should go (field x, or null to stay) and whether to launch. */
export interface StepInput { targetX: number | null; launch: boolean }

/** More contacts in one step than this only happen in a corner pocket; the rest of the move is dropped then. */
const MAX_CONTACTS_PER_STEP = 8;
const contact = newContact();

/** Advances the game by dt seconds. Call it with a fixed dt; the loop takes care of that. */
export function step(g: Game, input: StepInput, dt: number) {
  g.ball.prevX = g.ball.x; g.ball.prevY = g.ball.y; g.paddle.prevX = g.paddle.x;
  if (g.phase === 'won' || g.phase === 'over') return;
  movePaddle(g, input.targetX, dt);
  if (g.phase === 'serve') { holdOnPaddle(g); if (input.launch) launch(g); return; }
  moveBall(g, dt);
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
  g.ball.x = g.paddle.x; g.ball.y = g.paddle.top - g.ball.r;
  g.ball.prevX = g.ball.x; g.ball.prevY = g.ball.y;
}

function launch(g: Game) {
  g.phase = 'play';
  aim(g.ball, bounceAngle(g.paddle.vx < 0 ? -LAUNCH_OFFSET : LAUNCH_OFFSET, 0), g.speed);
  g.events.push('launch');
}

function moveBall(g: Game, dt: number) {
  const ball = g.ball;
  let left = dt;
  for (let i = 0; i < MAX_CONTACTS_PER_STEP && left > 0; i++) {
    const dx = ball.vx * left, dy = ball.vy * left;
    firstContact(ball, dx, dy, g.bricks, g.paddle, contact);
    if (contact.kind === 'none') { ball.x += dx; ball.y += dy; left = 0; break; }
    ball.x += dx * contact.t; ball.y += dy * contact.t;
    left *= 1 - contact.t;
    if (contact.kind === 'paddle') hitPaddle(g, contact.paddleOffset);
    else { reflect(ball, contact.nx, contact.ny); keepSteep(ball); }
    if (contact.kind === 'wall') g.events.push('wall');
    if (contact.kind === 'brick') hitBrick(g, contact.brick);
    if (g.phase !== 'play') return;
  }
  ball.x = Math.min(FIELD_W - ball.r, Math.max(ball.r, ball.x));
  if (ball.y - ball.r > FIELD_H) loseBall(g);
}

function hitPaddle(g: Game, offset: number) {
  g.combo = 0;
  g.speed = Math.min(MAX_SPEED, g.speed * SPEED_UP_PER_PADDLE_HIT);
  aim(g.ball, bounceAngle(offset, g.paddle.vx), g.speed);
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

function loseBall(g: Game) {
  g.lives -= 1;
  g.combo = 0;
  g.speed = START_SPEED;
  if (g.lives <= 0) { g.phase = 'over'; g.events.push('over'); return; }
  g.phase = 'serve';
  g.events.push('lost');
  holdOnPaddle(g);
}
