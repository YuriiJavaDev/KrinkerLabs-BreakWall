import levels from '../data/levels.json';
import { comboPitch } from '../src/audio/sound';
import { screenToField } from '../src/input/controls';
import { LevelError, parseLevel } from '../src/levels/level';
import { keepSteep } from '../src/physics/bounce';
import { newHit, reflect, sweepCircleBox } from '../src/physics/sweep';
import { fitField } from '../src/render/renderer';
import { FIELD_H, FIELD_W, MAX_SPEED, PADDLE_TOP, START_SPEED } from '../src/rules/config';
import { FixedStep, STEP_DT } from '../src/rules/loop';
import { brickPoints } from '../src/rules/score';
import { brickFromSpec, Brick, createGame, Game } from '../src/rules/state';
import { step } from '../src/rules/step';
import { messageFor } from '../src/ui/hud';
import { readFlag, writeFlag, KeyValueStore } from '../src/ui/storage';
import { pickLanguage, TEXTS } from '../src/ui/texts';

declare const process: { exit(code: number): never };

let run = 0, failed = 0;
const that = (ok: boolean, what: string) => { run++; if (!ok) { failed++; console.log('FAIL: ' + what); } };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

const ONE_BRICK = { name: 'test', rows: ['......a......'] };
/** A game in flight with the given bricks and the ball at (x, y) moving at (vx, vy). */
function flying(bricks: Brick[], x: number, y: number, vx: number, vy: number): Game {
  const g = createGame(parseLevel(ONE_BRICK));
  g.bricks = bricks; g.bricksLeft = bricks.length; g.phase = 'play';
  Object.assign(g.ball, { x, y, vx, vy, prevX: x, prevY: y });
  return g;
}
const stay = { targetX: null, launch: false };

// --- the sweep: worked out by hand on paper ---
{ // a ball of radius 5 falling from y = -20 by 40 meets the top face y = 0 when its centre is at y = -5: 15/40 of the move
  const h = newHit();
  that(sweepCircleBox(0, -20, 0, 40, 5, -10, 0, 10, 10, h), 'a falling ball hits the top face');
  that(near(h.t, 0.375) && h.nx === 0 && h.ny === -1, 'top face at t = 0.375 with the normal pointing up, got ' + JSON.stringify(h));
}
{ // along the diagonal into the corner (0, 0): a ball of radius √2 touches it with its centre at (-1, -1), 9/10 of the way
  const h = newHit(), r = Math.SQRT2;
  that(sweepCircleBox(-10, -10, 10, 10, r, 0, 0, 10, 10, h), 'a diagonal ball hits the corner');
  that(near(h.t, 0.9) && near(h.nx, -Math.SQRT1_2) && near(h.ny, -Math.SQRT1_2), 'corner contact at t = 0.9, normal along the diagonal, got ' + JSON.stringify(h));
  const v = { vx: 1, vy: 1 }; reflect(v, h.nx, h.ny);
  that(near(v.vx, -1) && near(v.vy, -1), 'straight into a corner comes straight back');
}
{ // the line x + y = -3.2 passes the corner (0, 0) at 3.2/√2 ≈ 2.26, more than the radius 2: it crosses the square of the grown box but misses
  that(!sweepCircleBox(-4, 0.8, 4.8, -4.8, 2, 0, 0, 10, 10, newHit()), 'a ball that passes a corner at 2.26 with radius 2 does not hit it');
}
that(!sweepCircleBox(0, 20, 0, 40, 5, -10, 0, 10, 10, newHit()), 'a ball moving away from a box does not hit it');
that(!sweepCircleBox(0, -100, 0, 40, 5, -10, 0, 10, 10, newHit()), 'a ball that stops short does not hit');
{ const v = { vx: 3, vy: -4 }; reflect(v, 1, 0); that(v.vx === -3 && v.vy === -4, 'a side wall flips only the horizontal speed'); }

// --- the ball never flies too flat (70° from vertical at most) ---
{ const v = { vx: 500, vy: 3 }; keepSteep(v);
  const speed = Math.hypot(v.vx, v.vy);
  that(near(speed, Math.hypot(500, 3)), 'keeping the flight steep keeps the speed');
  that(Math.abs(v.vy) / speed >= Math.cos(70 * Math.PI / 180) - 1e-9 && v.vx > 0 && v.vy > 0, 'an almost flat flight is raised to 70° and keeps its direction'); }
{ const v = { vx: 100, vy: -400 }; keepSteep(v); that(v.vx === 100 && v.vy === -400, 'a steep flight is left alone'); }

// --- a fast ball does not pass through a brick ---
{ const brick = brickFromSpec(6, 5, 0, 1), cx = (brick.x0 + brick.x1) / 2;
  // 60 000 units a second is 500 units in one step: twenty times the brick's height
  const g = flying([brick], cx, brick.y1 + 300, 0, -60000);
  step(g, stay, STEP_DT);
  that(brick.hits === 0, 'a ball moving 500 units in one step still breaks the brick in its way');
  that(g.ball.vy > 0 && g.ball.y > brick.y1, 'and bounces back instead of going through, y = ' + g.ball.y); }

// --- two bricks side by side, hit right on the seam: one breaks, the ball comes back ---
{ const a = brickFromSpec(5, 5, 0, 1), b = brickFromSpec(6, 5, 0, 1), seam = (a.x1 + b.x0) / 2;
  const g = flying([a, b], seam, a.y1 + 40, 0, -480);
  for (let i = 0; i < 20; i++) step(g, stay, STEP_DT);
  that(a.hits + b.hits === 1, 'a ball on the seam breaks one of the two bricks, not both');
  that(g.ball.vy > 0, 'and comes back down'); }

// --- the paddle: centre up, edges at 60° (the rule in the specification) ---
function paddleHit(offset: number, paddleVx = 0) {
  // the ball starts 2 units above the contact height, so it reaches the paddle within one step (480 / 120 = 4 units)
  const g = flying([brickFromSpec(0, 0, 0, 1)], 0, PADDLE_TOP - 9 - 2, 0, 480);
  const reach = g.paddle.w / 2 + g.ball.r;
  // offset is measured from where the paddle will be at the contact, after its move in this step
  g.paddle.x = FIELD_W / 2; g.ball.x = g.paddle.x + paddleVx * STEP_DT + offset * reach; g.ball.prevX = g.ball.x;
  // a paddle already moving: aim its target ahead so that it keeps the speed during the step
  step(g, { targetX: paddleVx ? g.paddle.x + paddleVx * STEP_DT : null, launch: false }, STEP_DT);
  return g;
}
{ const g = paddleHit(0), s = Math.hypot(g.ball.vx, g.ball.vy);
  that(near(g.ball.vx, 0) && g.ball.vy < 0, 'the centre of the paddle sends the ball straight up');
  that(s > START_SPEED, 'each paddle hit makes the ball a little faster'); }
{ const g = paddleHit(1), s = Math.hypot(g.ball.vx, g.ball.vy);
  that(near(g.ball.vx / s, Math.sin(Math.PI / 3)) && near(g.ball.vy / s, -0.5), 'the right edge sends the ball 60° to the right, got ' + g.ball.vx / s); }
{ const g = paddleHit(-1), s = Math.hypot(g.ball.vx, g.ball.vy);
  that(near(g.ball.vx / s, -Math.sin(Math.PI / 3)), 'the left edge sends the ball 60° to the left'); }
{ const g = paddleHit(0, 1200); that(g.ball.vx > 0 && g.ball.vy < 0, 'a paddle moving right gives the ball a spin to the right'); }
{ const g = paddleHit(0.3); g.combo = 4;
  Object.assign(g.ball, { x: g.paddle.x, y: PADDLE_TOP - 40, vx: 0, vy: 480 });
  for (let i = 0; i < 10; i++) step(g, stay, STEP_DT);
  that(g.combo === 0, 'touching the paddle ends the run of bricks'); }
{ const g = flying([brickFromSpec(0, 0, 0, 1)], FIELD_W / 2, PADDLE_TOP - 30, 0, 480);
  g.speed = MAX_SPEED;
  for (let i = 0; i < 40; i++) step(g, { targetX: g.ball.x, launch: false }, STEP_DT);
  that(near(Math.hypot(g.ball.vx, g.ball.vy), MAX_SPEED), 'the ball never gets faster than the top speed'); }

// --- walls ---
{ const g = flying([brickFromSpec(12, 0, 0, 1)], 20, 600, -480, -200);
  for (let i = 0; i < 10; i++) step(g, stay, STEP_DT);
  that(g.ball.vx > 0 && g.ball.x >= g.ball.r, 'the left wall sends the ball back to the right'); }
{ const g = flying([brickFromSpec(12, 17, 0, 1)], 300, 20, 0, -480);
  for (let i = 0; i < 10; i++) step(g, stay, STEP_DT);
  that(g.ball.vy > 0 && g.ball.y >= g.ball.r, 'the ceiling sends the ball back down'); }

// --- the paddle stays inside the field and moves at a limited speed ---
{ const g = createGame(parseLevel(ONE_BRICK)), start = g.paddle.x;
  step(g, { targetX: -5000, launch: false }, STEP_DT);
  that(start - g.paddle.x <= 2600 * STEP_DT + 1e-9 && g.paddle.x < start, 'the paddle moves towards a far target at its top speed only');
  for (let i = 0; i < 200; i++) step(g, { targetX: -5000, launch: false }, STEP_DT);
  that(near(g.paddle.x - g.paddle.w / 2, 0), 'the paddle stops at the left wall'); }

// --- serve, lives, the end ---
{ const g = createGame(parseLevel(ONE_BRICK));
  step(g, { targetX: 200, launch: false }, STEP_DT);
  that(g.phase === 'serve' && g.ball.x === g.paddle.x, 'before the launch the ball rides on the paddle');
  step(g, { targetX: null, launch: true }, STEP_DT);
  that(g.phase === 'play' && g.ball.vy < 0 && near(Math.hypot(g.ball.vx, g.ball.vy), START_SPEED), 'the launch sends the ball up at the start speed');
  that(g.events.includes('launch'), 'the launch is reported for the sound'); }
{ const g = flying([brickFromSpec(0, 0, 0, 1)], 100, FIELD_H - 5, 0, 480);
  for (let i = 0; i < 10; i++) step(g, stay, STEP_DT);
  that(g.lives === 2 && g.phase === 'serve', 'a ball out at the bottom costs a life and waits on the paddle again');
  g.lives = 1; g.phase = 'play'; Object.assign(g.ball, { x: 100, y: FIELD_H - 5, vx: 0, vy: 480 });
  for (let i = 0; i < 10; i++) step(g, stay, STEP_DT);
  that(g.lives === 0 && (g as Game).phase === 'over', 'the last ball lost ends the game'); }
{ const brick = brickFromSpec(6, 5, 0, 1);
  const g = flying([brick], (brick.x0 + brick.x1) / 2, brick.y1 + 30, 0, -480);
  for (let i = 0; i < 20; i++) step(g, stay, STEP_DT);
  that(g.phase === 'won' && g.events.includes('won'), 'breaking the last brick wins the level');
  that(g.score === 1000, 'one brick is worth 1 000 points, got ' + g.score); }

// --- points: each brick in a row is worth one step more, up to ten ---
that(brickPoints(1) + brickPoints(2) + brickPoints(3) === 6000, 'three bricks in a row: 1 000 + 2 000 + 3 000');
that(brickPoints(10) === 10000 && brickPoints(25) === 10000, 'the run stops growing at ten');
that(near(comboPitch(1), 1) && near(comboPitch(13), 2) && near(comboPitch(40), 2), 'the brick sound climbs one octave over a run of twelve and stops there');

// --- levels ---
{ const l = parseLevel({ name: 'x', rows: ['ab...........', '.......h.....'] });
  that(l.bricks.length === 3, 'every letter is a brick, dots are empty');
  that(l.bricks[2].col === 7 && l.bricks[2].row === 1 && l.bricks[2].color === 7, 'a brick keeps its cell and colour'); }
const refuses = (json: unknown) => { try { parseLevel(json); return false; } catch (e) { return e instanceof LevelError; } };
that(refuses({ name: 'x', rows: ['abc'] }), 'a row of the wrong width is refused');
that(refuses({ name: 'x', rows: ['a?...........'] }), 'an unknown cell is refused');
that(refuses({ name: 'x', rows: ['.............'] }), 'a level without bricks is refused');
that(refuses({ rows: ['a............'] }), 'a level without a name is refused');
that(refuses({ name: 'x', rows: Array(19).fill('a............') }), 'more rows than fit are refused');
{ let ok = true, inside = true;
  for (const json of levels) {
    const l = parseLevel(json), bricks = l.bricks.map((b) => brickFromSpec(b.col, b.row, b.color, b.hits));
    for (const b of bricks) if (b.x0 < 0 || b.x1 > FIELD_W || b.y0 < 0 || b.y1 > PADDLE_TOP - 200) inside = false;
    for (let i = 0; i < bricks.length; i++) for (let j = i + 1; j < bricks.length; j++) {
      const p = bricks[i], q = bricks[j];
      if (p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1) ok = false;
    }
  }
  that(inside, 'all bricks of the shipped levels are inside the field, well above the paddle');
  that(ok, 'no two bricks overlap'); }

// --- a whole level with a good player: the ball never leaves the field and the wall comes down ---
{ const g = createGame(parseLevel(levels[0]));
  let seed = 12345;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let aimOffset = 0, escaped = false, lostBalls = 0, steps = 0;
  step(g, { targetX: null, launch: true }, STEP_DT);
  while (g.phase === 'play' && steps < 120 * 60 * 10) {
    // the "player" waits under the ball and meets it at a different point of the paddle each time
    if (g.ball.vy < 0) aimOffset = (random() * 2 - 1) * 0.8 * (g.paddle.w / 2);
    step(g, { targetX: g.ball.x - aimOffset, launch: false }, STEP_DT);
    if (g.events.includes('lost')) { lostBalls++; step(g, { targetX: null, launch: true }, STEP_DT); }
    g.events.length = 0;
    if (g.ball.x < g.ball.r - 1e-6 || g.ball.x > FIELD_W - g.ball.r + 1e-6 || g.ball.y < g.ball.r - 1e-6) escaped = true;
    steps++;
  }
  that(!escaped, 'the ball never leaves through a wall or the ceiling');
  that(g.phase === 'won', 'a good player breaks the whole first wall within ten minutes, phase ' + g.phase + ' after ' + Math.round(steps / 120) + ' s, bricks left ' + g.bricksLeft);
  that(lostBalls === 0, 'a player who is always under the ball loses no ball, lost ' + lostBalls);
  console.log(`first wall broken by the test player in ${Math.round(steps / 120)} s of game time, score ${g.score}`); }

// --- the fixed step ---
{ const loop = new FixedStep(); let ticks = 0;
  for (let i = 0; i < 30; i++) loop.advance(1 / 30, () => ticks++);
  that(ticks === 120, 'one second at 30 frames a second is 120 steps, got ' + ticks);
  ticks = 0; const fresh = new FixedStep(); fresh.advance(2, () => ticks++);
  that(ticks === 30, 'a two-second freeze runs only a quarter of a second, got ' + ticks);
  const blend = new FixedStep().advance(STEP_DT * 1.5, () => {});
  that(near(blend, 0.5), 'half a step left over draws halfway between two steps'); }

// --- screen and field ---
{ const f = fitField(1560, 1040); that(f.scale === 1 && f.left === 390 && f.top === 0, 'a wide screen centres the field with room on both sides'); }
{ const f = fitField(390, 1040); that(f.scale === 0.5 && f.left === 0 && f.top === 260, 'a narrow screen fits the field to its width'); }
that(screenToField(400, 390, 1) === 10 && screenToField(400, 0, 0.5) === 800, 'screen x turns into field x');

// --- messages, texts, storage ---
{ const g = createGame(parseLevel(ONE_BRICK));
  that(messageFor(g, false) === 'serve' && messageFor(g, true) === 'paused', 'serve and pause messages');
  g.phase = 'play'; that(messageFor(g, false) === null, 'no message while the ball flies');
  (g as Game).phase = 'over'; that(messageFor(g, true) === 'over', 'the end of the game shows even when paused'); }
that(JSON.stringify(Object.keys(TEXTS.ru).sort()) === JSON.stringify(Object.keys(TEXTS.en).sort()), 'Russian and English have the same strings');
that(Object.values(TEXTS.ru).every((s) => s.trim().length > 0), 'no Russian string is empty');
that(pickLanguage(['ru-RU', 'en']) === 'ru' && pickLanguage(['de-DE', 'en-US']) === 'en' && pickLanguage([]) === 'en' && pickLanguage(['fr']) === 'en', 'the language follows the browser, English by default');
{ const broken: KeyValueStore = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  that(readFlag(broken, 'sound', true) === true && readFlag(null, 'sound', false) === false, 'a refused storage gives the default');
  let threw = false; try { writeFlag(broken, 'sound', false); } catch { threw = true; }
  that(!threw, 'writing to a refused storage does not break the game');
  const map = new Map<string, string>(), mem: KeyValueStore = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } };
  writeFlag(mem, 'sound', false); that(readFlag(mem, 'sound', true) === false, 'a stored setting is read back'); }

console.log(`${run - failed} of ${run} checks passed`);
if (failed) process.exit(1);
