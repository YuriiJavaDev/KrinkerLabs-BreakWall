import levels from '../data/levels.json';
import { Session } from '../src/app/session';
import { comboPitch } from '../src/audio/sound';
import { screenToField } from '../src/input/controls';
import { keyAction, movedTarget } from '../src/input/keys';
import { LevelError, parseLevel } from '../src/levels/level';
import { keepSteep } from '../src/physics/bounce';
import { newHit, reflect, sweepCircleBox } from '../src/physics/sweep';
import { OUTER_H, OUTER_W, spectrumAngle, SPECTRUM, SPECTRUM_SECONDS } from '../src/render/rails';
import { fitField } from '../src/render/renderer';
import { BALL_R, FIELD_H, FIELD_W, MAX_SPEED, PADDLE_MAX_SPEED, PADDLE_TOP, RAIL, START_SPEED } from '../src/rules/config';
import { FixedStep, STEP_DT } from '../src/rules/loop';
import { brickPoints } from '../src/rules/score';
import { brickFromSpec, Brick, createGame, Game, GameEvent } from '../src/rules/state';
import { step } from '../src/rules/step';
import { addFieldBall, extraBallProgress } from '../src/rules/tray';
import { cleanName, isRude } from '../src/scores/names';
import { addToTop, loadTop, mergeScore } from '../src/scores/top10';
import { KeyValueStore, memoryStore, readFlag, writeFlag } from '../src/storage/kv';
import { loadPlayer, recentPlayers, rememberPlayer } from '../src/storage/players';
import { decode, readSave, restore, snapshot, writeSave } from '../src/storage/save';
import { boardRows } from '../src/ui/board';
import { messageFor, meterPercent } from '../src/ui/hud';
import { isCompact } from '../src/ui/layout';
import { leaveFirst } from '../src/ui/leave';
import { fill, pickLanguage, TEXTS } from '../src/ui/texts';

declare const process: { exit(code: number): never };

let run = 0, failed = 0;
const that = (ok: boolean, what: string) => { run++; if (!ok) { failed++; console.log('FAIL: ' + what); } };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

const ONE_BRICK = { name: 'test', rows: ['...a...'] };
const LEVEL = parseLevel(levels[0]);
/** A game in flight with the given bricks and one ball at (x, y) moving at (vx, vy). */
function flying(bricks: Brick[], x: number, y: number, vx: number, vy: number): Game {
  const g = createGame(parseLevel(ONE_BRICK));
  g.bricks = bricks; g.bricksLeft = bricks.length; g.phase = 'play';
  Object.assign(g.balls[0], { x, y, vx, vy, prevX: x, prevY: y });
  return g;
}
const stay = { targetX: null, launch: false };
const steps = (g: Game, n = 10) => { for (let i = 0; i < n; i++) step(g, stay, STEP_DT); };

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
// the line x + y = -3.2 passes the corner (0, 0) at 3.2/√2 ≈ 2.26, more than the radius 2: it crosses the square of the grown box but misses
that(!sweepCircleBox(-4, 0.8, 4.8, -4.8, 2, 0, 0, 10, 10, newHit()), 'a ball that passes a corner at 2.26 with radius 2 does not hit it');
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
{ const brick = brickFromSpec(3, 5, 0, 1), cx = (brick.x0 + brick.x1) / 2;
  // 60 000 units a second is 500 units in one step: ten times the brick's height
  const g = flying([brick], cx, brick.y1 + 300, 0, -60000);
  step(g, stay, STEP_DT);
  that(brick.hits === 0, 'a ball moving 500 units in one step still breaks the brick in its way');
  that(g.balls[0].vy > 0 && g.balls[0].y > brick.y1, 'and bounces back instead of going through, y = ' + g.balls[0].y); }

// --- two bricks side by side, hit right on the seam: one breaks, the ball comes back ---
{ const a = brickFromSpec(2, 5, 0, 1), b = brickFromSpec(3, 5, 0, 1), seam = (a.x1 + b.x0) / 2;
  const g = flying([a, b], seam, a.y1 + 40, 0, -480);
  steps(g, 20);
  that(a.hits + b.hits === 1, 'a ball on the seam breaks one of the two bricks, not both');
  that(g.balls[0].vy > 0, 'and comes back down'); }

// --- the paddle: centre up, edges at 60° (the rule in the specification) ---
function paddleHit(offset: number, paddleVx = 0) {
  // the ball starts 2 units above the contact height, so it reaches the paddle within one step (480 / 120 = 4 units)
  const g = flying([brickFromSpec(0, 0, 0, 1)], 0, PADDLE_TOP - BALL_R - 2, 0, 480);
  const reach = g.paddle.w / 2 + BALL_R;
  // offset is measured from where the paddle will be at the contact, after its move in this step
  g.paddle.x = FIELD_W / 2; g.balls[0].x = g.paddle.x + paddleVx * STEP_DT + offset * reach; g.balls[0].prevX = g.balls[0].x;
  step(g, { targetX: paddleVx ? g.paddle.x + paddleVx * STEP_DT : null, launch: false }, STEP_DT);
  return g;
}
{ const b = paddleHit(0).balls[0], s = Math.hypot(b.vx, b.vy);
  that(near(b.vx, 0) && b.vy < 0, 'the centre of the paddle sends the ball straight up');
  that(s > START_SPEED, 'each paddle hit makes the ball a little faster'); }
{ const b = paddleHit(1).balls[0], s = Math.hypot(b.vx, b.vy);
  that(near(b.vx / s, Math.sin(Math.PI / 3)) && near(b.vy / s, -0.5), 'the right edge sends the ball 60° to the right, got ' + b.vx / s); }
{ const b = paddleHit(-1).balls[0], s = Math.hypot(b.vx, b.vy);
  that(near(b.vx / s, -Math.sin(Math.PI / 3)), 'the left edge sends the ball 60° to the left'); }
{ const b = paddleHit(0, 1200).balls[0]; that(b.vx > 0 && b.vy < 0, 'a paddle moving right gives the ball a spin to the right'); }
{ const g = flying([brickFromSpec(0, 0, 0, 1)], FIELD_W / 2, PADDLE_TOP - 40, 0, 480); g.combo = 4;
  steps(g, 20);
  that(g.combo === 0, 'touching the paddle ends the run of bricks'); }
{ const g = flying([brickFromSpec(0, 0, 0, 1)], FIELD_W / 2, PADDLE_TOP - 40, 0, 480);
  g.speed = MAX_SPEED;
  for (let i = 0; i < 40; i++) step(g, { targetX: g.balls[0].x, launch: false }, STEP_DT);
  that(near(Math.hypot(g.balls[0].vx, g.balls[0].vy), MAX_SPEED), 'the ball never gets faster than the top speed'); }

// --- walls ---
{ const g = flying([brickFromSpec(6, 0, 0, 1)], 30, 700, -480, -200);
  steps(g);
  that(g.balls[0].vx > 0 && g.balls[0].x >= BALL_R, 'the left wall sends the ball back to the right'); }
{ const g = flying([brickFromSpec(6, 17, 0, 1)], 300, 30, 0, -480);
  steps(g);
  that(g.balls[0].vy > 0 && g.balls[0].y >= BALL_R, 'the ceiling sends the ball back down'); }

// --- the paddle stays inside the field and moves at a limited speed ---
{ const g = createGame(parseLevel(ONE_BRICK)), start = g.paddle.x;
  step(g, { targetX: -5000, launch: false }, STEP_DT);
  that(start - g.paddle.x <= PADDLE_MAX_SPEED * STEP_DT + 1e-9 && g.paddle.x < start, 'the paddle moves towards a far target at its top speed only');
  for (let i = 0; i < 200; i++) step(g, { targetX: -5000, launch: false }, STEP_DT);
  that(near(g.paddle.x - g.paddle.w / 2, 0), 'the paddle stops at the left wall'); }

// --- serve and launch ---
{ const g = createGame(parseLevel(ONE_BRICK));
  step(g, { targetX: 200, launch: false }, STEP_DT);
  that(g.phase === 'serve' && g.balls[0].x === g.paddle.x, 'before the launch the ball rides on the paddle');
  step(g, { targetX: null, launch: true }, STEP_DT);
  const b = g.balls[0];
  that(g.phase === 'play' && b.vy < 0 && near(Math.hypot(b.vx, b.vy), START_SPEED), 'the launch sends the ball up at the start speed');
  that(g.events.includes('launch'), 'the launch is reported for the sound'); }

// --- the tray: three balls to start, the game ends when it is empty ---
{ const g = flying([brickFromSpec(0, 0, 0, 1)], 100, FIELD_H - 5, 0, 480);
  that(g.tray === 3, 'a game starts with three balls in the tray');
  steps(g);
  that(g.tray === 2 && g.phase === 'serve' && g.balls.length === 1, 'a ball out at the bottom takes one from the tray and the next waits on the paddle');
  that(g.events.includes('serve'), 'a new ball on the paddle is reported, so the game can be saved at that moment');
  g.tray = 1; g.phase = 'play'; Object.assign(g.balls[0], { x: 100, y: FIELD_H - 5, vx: 0, vy: 480 });
  steps(g);
  that(g.tray === 0 && (g as Game).phase === 'over', 'losing the last ball of the tray ends the game'); }

// --- up to three balls on the field; they do not take balls from the tray ---
{ const g = flying([brickFromSpec(0, 0, 0, 1)], 300, 600, 0, -480);
  that(addFieldBall(g, 400, 600, 100, -480) && addFieldBall(g, 500, 600, -100, -480), 'two more balls can join the one in play');
  that(!addFieldBall(g, 600, 600, 0, -480) && g.balls.length === 3, 'a fourth ball on the field is refused');
  that(g.tray === 3, 'balls on the field are not taken from the tray');
  Object.assign(g.balls[1], { x: 200, y: FIELD_H - 5, vx: 0, vy: 480 });
  steps(g);
  that(g.balls.length === 2 && g.tray === 3 && g.phase === 'play', 'losing one of several balls on the field costs nothing');
  g.balls.forEach((b) => Object.assign(b, { y: FIELD_H - 5, vx: 0, vy: 480 }));
  steps(g);
  that(g.tray === 2 && g.phase === 'serve', 'losing the last ball on the field takes one ball from the tray'); }

// --- an extra ball for every minute a ball stays in play, up to five in the tray ---
{ const g = flying([brickFromSpec(0, 0, 0, 1)], 300, 600, 0, -480);
  const keepUp = () => Object.assign(g.balls[0], { x: 300, y: 600, vx: 0, vy: -480 });
  for (let i = 0; i < 120 * 59; i++) { keepUp(); step(g, stay, STEP_DT); }
  that(g.tray === 3 && near(extraBallProgress(g), 59 / 60, 1e-3), 'after 59 seconds the meter is at 59/60 and the tray still has three');
  for (let i = 0; i < 120 * 2; i++) { keepUp(); step(g, stay, STEP_DT); }
  that(g.tray === 4 && g.events.includes('extra'), 'after a minute in play a fourth ball goes into the tray');
  for (let i = 0; i < 120 * 60 * 3; i++) { keepUp(); step(g, stay, STEP_DT); }
  that(g.tray === 5, 'the tray holds at most five balls, got ' + g.tray);
  that(extraBallProgress(g) === -1 && meterPercent(extraBallProgress(g)) === 100, 'a full tray shows a full meter'); }
{ const g = flying([brickFromSpec(0, 0, 0, 1)], 300, 600, 0, -480);
  for (let i = 0; i < 120 * 30; i++) { Object.assign(g.balls[0], { x: 300, y: 600, vx: 0, vy: -480 }); step(g, stay, STEP_DT); }
  Object.assign(g.balls[0], { x: 100, y: FIELD_H - 5, vx: 0, vy: 480 });
  steps(g);
  that(g.ballTime === 0 && extraBallProgress(g) === 0, 'a new ball starts its minute from zero'); }

// --- winning, points ---
{ const brick = brickFromSpec(3, 5, 0, 1);
  const g = flying([brick], (brick.x0 + brick.x1) / 2, brick.y1 + 30, 0, -480);
  steps(g, 20);
  that(g.phase === 'won' && g.events.includes('won'), 'breaking the last brick wins the level');
  that(g.score === 1000, 'one brick is worth 1 000 points, got ' + g.score); }
that(brickPoints(1) + brickPoints(2) + brickPoints(3) === 6000, 'three bricks in a row: 1 000 + 2 000 + 3 000');
that(brickPoints(10) === 10000 && brickPoints(25) === 10000, 'the run stops growing at ten');
that(near(comboPitch(1), 1) && near(comboPitch(13), 2) && near(comboPitch(40), 2), 'the brick sound climbs one octave over a run of twelve and stops there');

// --- levels ---
{ const l = parseLevel({ name: 'x', rows: ['ab.....', '...h...'] });
  that(l.bricks.length === 3, 'every letter is a brick, dots are empty');
  that(l.bricks[2].col === 3 && l.bricks[2].row === 1 && l.bricks[2].color === 7, 'a brick keeps its cell and colour'); }
const refuses = (json: unknown) => { try { parseLevel(json); return false; } catch (e) { return e instanceof LevelError; } };
that(refuses({ name: 'x', rows: ['abc'] }), 'a row of the wrong width is refused');
that(refuses({ name: 'x', rows: ['a?.....'] }), 'an unknown cell is refused');
that(refuses({ name: 'x', rows: ['.......'] }), 'a level without bricks is refused');
that(refuses({ rows: ['a......'] }), 'a level without a name is refused');
that(refuses({ name: 'x', rows: Array(19).fill('a......') }), 'more rows than fit are refused');
{ let apart = true, inside = true;
  for (const json of levels) {
    const bricks = parseLevel(json).bricks.map((b) => brickFromSpec(b.col, b.row, b.color, b.hits));
    for (const b of bricks) if (b.x0 < 0 || b.x1 > FIELD_W || b.y0 < 0 || b.y1 > PADDLE_TOP - 300) inside = false;
    for (let i = 0; i < bricks.length; i++) for (let j = i + 1; j < bricks.length; j++) {
      const p = bricks[i], q = bricks[j];
      if (p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1) apart = false;
    }
  }
  that(inside, 'all bricks of the shipped levels are inside the field, well above the paddle');
  that(apart, 'no two bricks overlap'); }

// --- a whole level with a good player: the ball never leaves the field and the wall comes down ---
{ const g = createGame(LEVEL);
  let seed = 12345;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let aimOffset = 0, escaped = false, lost = 0, count = 0;
  step(g, { targetX: null, launch: true }, STEP_DT);
  while (g.phase === 'play' && count < 120 * 60 * 10) {
    const b = g.balls[0];
    // the "player" waits under the ball and meets it at a different point of the paddle each time
    if (b.vy < 0) aimOffset = (random() * 2 - 1) * 0.8 * (g.paddle.w / 2);
    step(g, { targetX: b.x - aimOffset, launch: false }, STEP_DT);
    if (g.events.includes('lost')) { lost++; step(g, { targetX: null, launch: true }, STEP_DT); }
    g.events.length = 0;
    for (const ball of g.balls) if (ball.x < BALL_R - 1e-6 || ball.x > FIELD_W - BALL_R + 1e-6 || ball.y < BALL_R - 1e-6) escaped = true;
    count++;
  }
  that(!escaped, 'the ball never leaves through a wall or the ceiling');
  that(g.phase === 'won', 'a good player breaks the whole first wall within ten minutes, phase ' + g.phase + ' after ' + Math.round(count / 120) + ' s, bricks left ' + g.bricksLeft);
  that(lost === 0, 'a player who is always under the ball loses no ball, lost ' + lost);
  console.log(`first wall broken by the test player in ${Math.round(count / 120)} s of game time, score ${g.score}, tray ${g.tray}`); }

// --- saving: what was there at the start of the ball, checked against the level ---
{ const g = createGame(LEVEL);
  g.score = 12000; g.tray = 4; g.bricks[0].hits = 0; g.bricks[5].hits = 0;
  const save = snapshot(g, 0, 1000);
  const back = decode(JSON.parse(JSON.stringify(save)), LEVEL, 0);
  that(back !== null, 'a save survives being written as JSON and read back');
  const r = restore(LEVEL, back!);
  that(r.score === 12000 && r.tray === 4 && r.phase === 'serve', 'a restored game has the score and the balls, and a ball waits on the paddle');
  that(r.bricksLeft === LEVEL.bricks.length - 2 && r.bricks[0].hits === 0 && r.bricks[1].hits === 1, 'a restored game has the same bricks broken');
  that(decode({ ...save, level: 1 }, LEVEL, 0) === null, 'a save of another level is refused');
  that(decode({ ...save, hits: save.hits.slice(1) }, LEVEL, 0) === null, 'a save with the wrong number of bricks is refused');
  that(decode({ ...save, hits: save.hits.map(() => 0) }, LEVEL, 0) === null, 'a save of a finished wall is refused');
  that(decode({ ...save, tray: 9 }, LEVEL, 0) === null && decode({ ...save, tray: 0 }, LEVEL, 0) === null, 'a save with an impossible tray is refused');
  that(decode({ ...save, score: -5 }, LEVEL, 0) === null && decode('nonsense', LEVEL, 0) === null && decode(null, LEVEL, 0) === null, 'broken saves are refused');
  that(decode({ ...save, hits: save.hits.map((h) => h + 1) }, LEVEL, 0) === null, 'a brick stronger than in the level is refused'); }
{ const store = memoryStore(), g = createGame(LEVEL);
  that(writeSave(store, 'ANNA', snapshot(g, 0)) && readSave(store, 'ANNA', LEVEL, 0) !== null, 'a save is kept under the player name');
  that(readSave(store, 'BORIS', LEVEL, 0) === null && !writeSave(store, '', snapshot(g, 0)), 'another name has no save, and no name saves nothing'); }

// --- the session: autosave at each new ball, the top 10 at the end ---
{ const store = memoryStore();
  rememberPlayer(store, 'anna');
  let clock = 0;
  const s = new Session(store, LEVEL, 0, () => ++clock);
  that(s.player === 'ANNA' && s.autosave, 'the session knows the last player; autosave is on by default');
  s.startNew();
  s.game.score = 5000; s.game.bricks[0].hits = 0; s.game.bricksLeft -= 1;
  that(s.hasProgress, 'points or broken bricks are something to lose');
  s.handle(['serve']);
  const saved = s.savedGame();
  that(saved !== null && saved.score === 5000, 'a new ball on the paddle saves the game by itself when autosave is on');
  s.game.score = 9000;
  s.saveNow();
  that(s.savedGame()!.score === 5000, 'saving in the middle of a ball keeps the start of that ball, not the flight');
  s.continueSaved();
  that(s.game.score === 5000 && s.game.bricks[0].hits === 0, 'going on restores the save');
  s.game.score = 30000; s.game.phase = 'over';
  s.handle(['over']);
  that(loadTop(store)[0]?.name === 'ANNA' && loadTop(store)[0]?.score === 30000, 'the end of the game puts the result into the top 10');
  that(s.savedGame() === null, 'a finished game leaves no save behind');
  s.handle(['over']);
  that(loadTop(store).length === 1, 'one end is recorded once'); }
{ const store = memoryStore(), s = new Session(store, LEVEL, 0);
  s.clearPlayer(); s.startNew(); s.game.score = 100; s.game.phase = 'over'; s.handle(['over' as GameEvent]);
  that(loadTop(store).length === 0 && !s.saveNow(), 'without a name nothing goes into the top 10 and nothing is saved'); }
{ const store = memoryStore(), s = new Session(store, LEVEL, 0);
  s.setPlayer('Vera'); s.setAutosave(false); s.startNew(); s.game.score = 700;
  s.handle(['serve']);
  that(s.savedGame() === null, 'with autosave off a new ball saves nothing');
  that(s.saveNow() && s.savedGame()!.score === 700, 'the Save button still saves'); }

// --- the leave window ---
that(leaveFirst('ANNA', true) === 'save' && leaveFirst('', true) === 'name' && leaveFirst('ANNA', false) === null && leaveFirst('', false) === null,
  'leaving offers to save, to give a name, or just to go when there is nothing to lose');

// --- names, top 10 ---
that(cleanName('  anna  maria! ') === 'ANNA MARIA' && cleanName('<b>x</b>') === 'BXB' && cleanName('!!!') === '', 'nicknames are cleaned the same way as in the other games');
that(cleanName('a'.repeat(30)).length === 18, 'a nickname is at most 18 characters');
that(isRude('FuCk') && isRude('х у й') && !isRude('Anna') && !isRude('Yurii'), 'rude nicknames are caught, ordinary ones pass');
{ let rows = mergeScore([], 'anna', 500);
  rows = mergeScore(rows, 'boris', 900);
  rows = mergeScore(rows, 'anna', 300);
  that(rows.length === 2 && rows[0].name === 'BORIS' && rows[1].score === 500, 'a lower result does not replace a better one of the same player');
  rows = mergeScore(rows, 'anna', 1500);
  that(rows[0].name === 'ANNA' && rows[0].score === 1500 && rows.length === 2, 'a better result replaces the old one and moves up');
  for (let i = 0; i < 15; i++) rows = mergeScore(rows, 'p' + i, 100 + i);
  that(rows.length === 10 && rows[9].score >= 100, 'the board keeps ten rows'); }
{ const store = memoryStore();
  addToTop(store, 'anna', 100);
  store.setItem('krinkerlabs.breakwall.top10', '[{"name":"<img>","score":5},{"name":"x","score":-1},"junk"]');
  that(JSON.stringify(loadTop(store)) === '[{"name":"IMG","score":5}]', 'rows from storage are cleaned: no markup, no bad scores'); }
{ const rows = boardRows([{ name: 'ANNA', score: 1500 }], 'ANNA', String);
  that(rows.length === 10 && rows[0].me && rows[0].score === '1500' && rows[1].vacant, 'the board shows ten places, the player marked, the rest empty'); }

// --- players ---
{ const store = memoryStore();
  rememberPlayer(store, 'anna'); rememberPlayer(store, 'boris'); rememberPlayer(store, 'anna');
  that(loadPlayer(store) === 'ANNA' && JSON.stringify(recentPlayers(store)) === '["ANNA","BORIS"]', 'the last nickname is the player, the recent list has no repeats');
  rememberPlayer(store, '');
  that(loadPlayer(store) === '', 'an empty nickname clears the player'); }

// --- the fixed step ---
{ const loop = new FixedStep(); let ticks = 0;
  for (let i = 0; i < 30; i++) loop.advance(1 / 30, () => ticks++);
  that(ticks === 120, 'one second at 30 frames a second is 120 steps, got ' + ticks);
  ticks = 0; new FixedStep().advance(2, () => ticks++);
  that(ticks === 30, 'a two-second freeze runs only a quarter of a second, got ' + ticks);
  that(near(new FixedStep().advance(STEP_DT * 1.5, () => {}), 0.5), 'half a step left over draws halfway between two steps'); }

// --- the table on the screen ---
that(OUTER_W === FIELD_W + 2 * RAIL && OUTER_H === FIELD_H + RAIL, 'the table is the field with a rail left, right and on top');
{ const f = fitField(OUTER_W * 3, OUTER_H); that(f.scale === 1 && f.left === OUTER_W && f.top === 0, 'a wide screen gives the table its full height, centred'); }
{ const f = fitField(OUTER_W / 2, OUTER_H * 2); that(f.scale === 0.5 && f.left === 0 && f.top === OUTER_H * 3 / 4, 'a narrow screen fits the table to its width'); }
that(screenToField(400, 390, 1) === 10 && screenToField(400, 0, 0.5) === 800, 'screen x turns into field x');
that(SPECTRUM[0] === SPECTRUM[SPECTRUM.length - 1], 'the colours of the rails end where they begin, so the flow has no seam');
that(near(spectrumAngle(SPECTRUM_SECONDS / 4, false), Math.PI / 2) && near(spectrumAngle(SPECTRUM_SECONDS * 3, false), 0) && spectrumAngle(5, true) === 0,
  'the colours turn once in their period, and stand still when motion is reduced');

// --- keys: by their place on the keyboard, so any layout works ---
that(keyAction('ShiftLeft') === 'left' && keyAction('ShiftRight') === 'right', 'the left Shift moves the paddle left, the right Shift right');
that(keyAction('ArrowLeft') === 'left' && keyAction('KeyA') === 'left' && keyAction('ArrowRight') === 'right' && keyAction('KeyD') === 'right', 'arrows and A D move the paddle too');
that(keyAction('Enter') === 'launch' && keyAction('NumpadEnter') === 'launch', 'Enter launches the ball');
that(keyAction('Space') === 'pause' && keyAction('KeyP') === 'pause', 'Space and P pause, and do not launch');
that(keyAction('KeyM') === 'sound' && keyAction('Escape') === 'leave' && keyAction('KeyQ') === null, 'M is the sound, Esc is leaving, other keys do nothing');
// a held mouse moves the paddle by its own movement: 30 screen pixels at half scale are 60 field units
that(movedTarget(400, 30, 0.5, 124, 656) === 460, 'a held mouse moves the paddle by its movement, in field units');
that(movedTarget(640, 300, 0.5, 124, 656) === 656 && movedTarget(150, -300, 0.5, 124, 656) === 124, 'a held mouse cannot push the paddle past the walls, so a move back is felt at once');

// --- which layout: side panels only where the table keeps a good size ---
that(!isCompact(1440, 900) && !isCompact(1280, 720) && !isCompact(1080, 810), 'computers and tablets held sideways get the side panels');
that(isCompact(390, 844) && isCompact(915, 412) && isCompact(810, 1080) && isCompact(1024, 1366), 'phones, a phone held sideways and upright tablets get the phone layout');

// --- messages, texts, storage ---
{ const g = createGame(parseLevel(ONE_BRICK));
  that(messageFor(g, false) === 'serve' && messageFor(g, true) === 'paused', 'serve and pause messages');
  g.phase = 'play'; that(messageFor(g, false) === null, 'no message while the ball flies');
  (g as Game).phase = 'over'; that(messageFor(g, true) === 'over', 'the end of the game shows even when paused'); }
that(JSON.stringify(Object.keys(TEXTS.ru).sort()) === JSON.stringify(Object.keys(TEXTS.en).sort()), 'Russian and English have the same strings');
that(Object.values(TEXTS.ru).every((s) => s.trim().length > 0) && Object.values(TEXTS.en).every((s) => s.trim().length > 0), 'no string is empty');
that(fill(TEXTS.en.continueSaved, { score: '1 000', balls: 2 }).includes('1 000 points, 2 balls'), 'numbers go into their places in a text');
that(pickLanguage(['ru-RU', 'en']) === 'ru' && pickLanguage(['de-DE', 'en-US']) === 'en' && pickLanguage([]) === 'en' && pickLanguage(['fr']) === 'en', 'the language follows the browser, English by default');
{ const broken: KeyValueStore = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  that(readFlag(broken, 'sound', true) === true && readFlag(null, 'sound', false) === false, 'a refused storage gives the default');
  let threw = false; try { writeFlag(broken, 'sound', false); rememberPlayer(broken, 'x'); addToTop(broken, 'x', 5); } catch { threw = true; }
  that(!threw, 'writing to a refused storage does not break the game');
  const mem = memoryStore(); writeFlag(mem, 'sound', false); that(readFlag(mem, 'sound', true) === false, 'a stored setting is read back'); }

console.log(`${run - failed} of ${run} checks passed`);
if (failed) process.exit(1);
