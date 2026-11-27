import { aim, bounceAngle, keepSteep } from '../physics/bounce';
import { firstContact, newContact } from '../physics/contact';
import { reflect, turn } from '../physics/sweep';
import { fitPaddle, moveCapsules, pace, tickEffects } from './bonuses';
import { BUMPER_POINTS, FIELD_H, FIELD_W, LAUNCH_OFFSET, LOOP_SECONDS, LOOP_TURN } from './config';
import { hitBrick } from './damage';
import { hitPaddle, launchStuck, movePaddle } from './paddle';
import { Ball, Game, random } from './state';
import { loseBall, tickExtraBall } from './tray';
import { updateWall } from './wall';
import { fireLaser, moveShots, tickBombs } from './weapons';

/** Read through a function so TypeScript does not keep an old narrowing of the phase across calls that change it. */
const inPlay = (g: Game) => g.phase === 'play';

/** What the player asks for in one step: where the paddle should go (field x, or null to stay) and whether to launch (or fire). */
export interface StepInput { targetX: number | null; launch: boolean }

/** More contacts in one step than this only happen in a corner pocket; the rest of the move is dropped then. */
const MAX_CONTACTS_PER_STEP = 8;
const BUMPER_KICK = 1.08;
const PORTAL_WAIT = 0.5;
const contact = newContact();

/** Advances the game by dt seconds. Call it with a fixed dt; the loop takes care of that. */
export function step(g: Game, input: StepInput, dt: number) {
  for (const b of g.balls) { b.prevX = b.x; b.prevY = b.y; }
  g.paddle.prevX = g.paddle.x;
  if (g.phase === 'won' || g.phase === 'over') return;
  if (g.phase === 'play') g.time += dt;
  tickEffects(g, dt);
  movePaddle(g, input.targetX, dt);
  updateWall(g, dt);
  if (!inPlay(g) && g.phase !== 'serve') return;
  if (g.phase === 'serve') { holdOnPaddle(g); if (input.launch) launch(g); return; }

  if (input.launch && !launchStuck(g)) fireLaser(g);
  const moveTime = dt * pace(g);
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const ball = g.balls[i];
    if (ball.stuck !== null) continue;
    const drained = moveBall(g, ball, moveTime);
    if (!inPlay(g)) return;
    if (drained) { g.balls.splice(i, 1); g.events.push('drain'); }
  }
  tickBombs(g, dt);
  if (!inPlay(g)) return;
  if (!g.balls.some((b) => b.kind === 'normal')) { loseBall(g); return; }
  moveCapsules(g, dt);
  moveShots(g, dt);
  if (!inPlay(g)) return;
  tickExtraBall(g, dt);
  g.idle += dt;
}

function holdOnPaddle(g: Game) {
  fitPaddle(g);
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
  ball.portalWait = Math.max(0, ball.portalWait - dt);
  for (let i = 0; i < MAX_CONTACTS_PER_STEP && left > 0; i++) {
    const dx = ball.vx * left, dy = ball.vy * left;
    firstContact(g, ball, dx, dy, left, contact);
    if (contact.kind === 'none') { ball.x += dx; ball.y += dy; break; }
    ball.x += dx * contact.t; ball.y += dy * contact.t;
    left *= 1 - contact.t;
    if (meet(g, ball)) break;
    if (!inPlay(g)) return false;
  }
  usePortals(g, ball);
  ball.x = Math.min(FIELD_W - ball.r, Math.max(ball.r, ball.x));
  return ball.y - ball.r > FIELD_H;
}

/** What the contact does to the ball and to what it met. Returns true when the ball stops (caught by a sticky paddle). */
function meet(g: Game, ball: Ball): boolean {
  const { kind, nx, ny, index } = contact;
  if (kind === 'paddle') { hitPaddle(g, ball, contact.paddleOffset); return ball.stuck !== null; }
  if (kind === 'brick') {
    const b = g.bricks[index];
    // a comet burns through everything except steel, without bouncing
    if (ball.kind === 'normal' && g.effects.comet > 0 && b.kind !== 'steel') { hitBrick(g, index, nx, ny, 'comet'); return false; }
    hitBrick(g, index, nx, ny, 'ball');
  }
  reflect(ball, nx, ny);
  if (kind === 'bumper') {
    const speed = Math.min(g.tier.maxSpeed, Math.hypot(ball.vx, ball.vy) * BUMPER_KICK);
    const k = speed / (Math.hypot(ball.vx, ball.vy) || 1);
    ball.vx *= k; ball.vy *= k;
    g.score += BUMPER_POINTS; g.levelPoints += BUMPER_POINTS;
    g.events.push('bump');
    g.fx.push({ kind: 'spark', x: g.level.bumpers[index].x, y: g.level.bumpers[index].y, r: g.level.bumpers[index].r, color: 0 });
  }
  if (kind === 'barrier') { g.effects.barrier = false; g.events.push('bump'); }
  if (kind === 'wall' || kind === 'spinner') g.events.push('wall');
  // a ball that has met nothing useful for a long time is turned a little, so it cannot loop forever
  if (kind !== 'brick' && g.idle > LOOP_SECONDS) { turn(ball, (random(g) < 0.5 ? -1 : 1) * LOOP_TURN); g.idle = LOOP_SECONDS - 3; }
  keepSteep(ball);
  return false;
}

/** A ball that falls into one portal comes out of its twin, going the same way. */
function usePortals(g: Game, ball: Ball) {
  if (ball.portalWait > 0) return;
  for (const p of g.level.portals) {
    const inA = Math.hypot(ball.x - p.ax, ball.y - p.ay) < p.r * 0.7, inB = !inA && Math.hypot(ball.x - p.bx, ball.y - p.by) < p.r * 0.7;
    if (!inA && !inB) continue;
    const speed = Math.hypot(ball.vx, ball.vy) || 1, out = p.r + ball.r + 2;
    ball.x = (inA ? p.bx : p.ax) + (ball.vx / speed) * out;
    ball.y = (inA ? p.by : p.ay) + (ball.vy / speed) * out;
    ball.prevX = ball.x; ball.prevY = ball.y;
    ball.portalWait = PORTAL_WAIT;
    g.events.push('portal');
    g.fx.push({ kind: 'portal', x: ball.x, y: ball.y, r: p.r, color: inA ? 1 : 0 });
    return;
  }
}
