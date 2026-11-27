import { Session } from '../src/app/session';
import { comboPitch } from '../src/audio/sound';
import { screenToField } from '../src/input/controls';
import { keyAction, movedTarget } from '../src/input/keys';
import { indexOf, isTierEnd, isTierStart, LEVELS, tierStart } from '../src/levels/catalog';
import { BRICK_GAP, cellPolygon } from '../src/levels/grids';
import { BONUS_CODES, BrickKind, LevelError, parseLevel } from '../src/levels/level';
import { area2, bbox, clockwise, contains, distanceTo, inset, overlaps, regular } from '../src/levels/shapes';
import { tierOf, TIERS } from '../src/levels/tiers';
import { keepSteep } from '../src/physics/bounce';
import { newHit, reflect, sweepCircleBox, sweepCirclePoint, sweepCirclePoly } from '../src/physics/sweep';
import { OUTER_H, OUTER_W, SPECTRUM, spectrumAngle, SPECTRUM_SECONDS } from '../src/render/rails';
import { fitField } from '../src/render/renderer';
import { applyBonus, fitPaddle, moveCapsules, spawnTimeBomb, tickEffects } from '../src/rules/bonuses';
import { DANGER_Y, FIELD_H, FIELD_W, LOOP_SECONDS, PADDLE_MAX_SPEED, PADDLE_TOP, RAIL, TRAY_MAX } from '../src/rules/config';
import { explode, hitBrick } from '../src/rules/damage';
import { finishLevel, skipLevel } from '../src/rules/finish';
import { FixedStep, STEP_DT } from '../src/rules/loop';
import { hitPaddle } from '../src/rules/paddle';
import { brickPoints, levelBonus, levelStars } from '../src/rules/score';
import { createGame, Game, GameEvent } from '../src/rules/state';
import { step, StepInput } from '../src/rules/step';
import { addFieldBall, extraBallProgress } from '../src/rules/tray';
import { updateWall } from '../src/rules/wall';
import { fireLaser, moveShots, tickBombs } from '../src/rules/weapons';
import { cleanName, isRude } from '../src/scores/names';
import { addToTop, loadTop, mergeScore } from '../src/scores/top10';
import { KeyValueStore, memoryStore, readFlag, writeFlag } from '../src/storage/kv';
import { loadPlayer, recentPlayers, rememberPlayer } from '../src/storage/players';
import { cleanProgress, emptyProgress, isOpen, recordLevel, totalStars } from '../src/storage/progress';
import { decode, restore, snapshot } from '../src/storage/save';
import { boardRows } from '../src/ui/board';
import { messageFor, meterPercent, starText } from '../src/ui/hud';
import { isCompact } from '../src/ui/layout';
import { leaveFirst } from '../src/ui/leave';
import { fill, formatScore, pickLanguage, TEXTS } from '../src/ui/texts';

declare const process: { exit(code: number): never };

let run = 0, failed = 0;
const that = (ok: boolean, what: string) => { run++; if (!ok) { failed++; console.log('FAIL: ' + what); } };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const DEG = Math.PI / 180;

// ---------- helpers: a small level of one block, and a game of it ----------
const N = { en: 'Test', ru: 'Тест' };
function levelOf(rows: string[], extra: Record<string, unknown> = {}, tier = 1) {
  return parseLevel({ id: `${tier}-1`, tier, name: N, intro: N, par: 100, blocks: [{ grid: 'rect', cell: [108, 52], top: 182, rows }], ...extra });
}
function gameOf(rows: string[], extra: Record<string, unknown> = {}, tier = 1): Game {
  const g = createGame(levelOf(rows, extra, tier), tierOf(tier), { seed: 1 });
  g.events.length = 0;
  return g;
}
function fly(g: Game, x: number, y: number, vx: number, vy: number) {
  g.phase = 'play';
  Object.assign(g.balls[0], { x, y, vx, vy, prevX: x, prevY: y });
}
const stay: StepInput = { targetX: null, launch: false };
const steps = (g: Game, n: number, input: StepInput = stay) => { for (let i = 0; i < n; i++) step(g, input, STEP_DT); };
// In a rect grid of 7 cells of 108 × 52 from y = 182, cell (c, r) has its brick from x = 15 + 108c, y = 185 + 52r, 102 × 46.
const cx = (c: number) => 15 + 108 * c + 51;
const cy = (r: number) => 185 + 52 * r + 23;

// ---------- shapes ----------
{ const p = inset([0, 0, 108, 0, 108, 52, 0, 52], BRICK_GAP / 2), b = bbox(p);
  that(near(b.x1 - b.x0, 102) && near(b.y1 - b.y0, 46), 'a 108 × 52 cell with half the gap off every edge is a 102 × 46 brick'); }
{ const hex = cellPolygon({ grid: 'hex', cell: [100], top: 0, cols: 1, rows: 1 }, 0, 0), sides: number[] = [];
  for (let i = 0; i < 12; i += 2) sides.push(Math.hypot(hex[(i + 2) % 12] - hex[i], hex[(i + 3) % 12] - hex[i + 1]));
  that(sides.length === 6 && sides.every((s) => near(s, sides[0], 1e-6)), 'a hexagon brick has six equal sides');
  // a regular hexagon 100 across its flat sides has sides of 100 / √3 = 57.735; the gap takes 3 off each side's distance from the centre
  that(near(sides[0], (100 - BRICK_GAP) / Math.sqrt(3), 1e-6), 'and its side is (100 − gap) / √3 = 54.27, got ' + sides[0]); }
{ const spec = { grid: 'tri' as const, cell: [110], top: 0, cols: 3, rows: 1 };
  const up = cellPolygon(spec, 0, 0), down = cellPolygon(spec, 1, 0);
  that(up.length === 6 && down.length === 6, 'triangle bricks have three corners');
  that(near(Math.abs(area2(up)), Math.abs(area2(down))), 'triangles pointing up and down have the same size');
  that(bbox(up).y0 < bbox(down).y1 && up[1] < up[3] && down[1] === down[3], 'they point up and down in turn'); }
{ const sq = [0, 0, 10, 0, 10, 10, 0, 10];
  that(area2(sq) > 0 && area2(clockwise([0, 0, 0, 10, 10, 10, 10, 0])) > 0, 'polygons are kept clockwise on a y-down screen');
  that(contains(sq, 5, 5) && !contains(sq, 11, 5), 'a point inside, a point outside');
  that(near(distanceTo(sq, 13, 14), 5), 'distance to a corner: 3-4-5');
  that(overlaps(sq, [5, 5, 15, 5, 15, 15, 5, 15]) && !overlaps(sq, [10, 0, 20, 0, 20, 10, 10, 10]), 'overlapping squares overlap, squares that only touch do not'); }
{ const p = regular(3, 0, 0, 10);
  that(p.length === 6 && near(Math.hypot(p[0], p[1]), 10), 'a regular triangle has its corners on the circle'); }

// ---------- the sweep: worked out by hand on paper ----------
{ // a ball of radius 5 falling from y = -20 by 40 meets the top face y = 0 when its centre is at y = -5: 15/40 of the move
  const h = newHit();
  that(sweepCircleBox(0, -20, 0, 40, 5, -10, 0, 10, 10, h), 'a falling ball hits the top face');
  that(near(h.t, 0.375) && near(h.nx, 0) && near(h.ny, -1), 'top face at t = 0.375 with the normal pointing up, got ' + JSON.stringify(h)); }
{ // along the diagonal into the corner (0, 0): a ball of radius √2 touches it with its centre at (-1, -1), 9/10 of the way
  const h = newHit();
  that(sweepCircleBox(-10, -10, 10, 10, Math.SQRT2, 0, 0, 10, 10, h), 'a diagonal ball hits the corner');
  that(near(h.t, 0.9) && near(h.nx, -Math.SQRT1_2) && near(h.ny, -Math.SQRT1_2), 'corner contact at t = 0.9, normal along the diagonal, got ' + JSON.stringify(h));
  const v = { vx: 1, vy: 1 }; reflect(v, h.nx, h.ny);
  that(near(v.vx, -1) && near(v.vy, -1), 'straight into a corner comes straight back'); }
// the line x + y = -3.2 passes the corner (0, 0) at 3.2/√2 ≈ 2.26, more than the radius 2
that(!sweepCircleBox(-4, 0.8, 4.8, -4.8, 2, 0, 0, 10, 10, newHit()), 'a ball that passes a corner at 2.26 with radius 2 does not hit it');
that(!sweepCircleBox(0, 20, 0, 40, 5, -10, 0, 10, 10, newHit()), 'a ball moving away from a box does not hit it');
{ // a triangle with side 2: apex (0, -√3), corners (1, 0) and (-1, 0). Its right edge faces 30° above the x axis: normal (√3/2, -1/2)
  const tri = [0, -Math.sqrt(3), 1, 0, -1, 0], h = newHit(), r = 0.25;
  that(sweepCirclePoly(3, -Math.sqrt(3) / 2, -4, 0, r, tri, h), 'a ball moving left meets the slanted right edge of a triangle');
  that(near(h.nx, Math.sqrt(3) / 2) && near(h.ny, -0.5), 'the normal of that edge is (√3/2, −1/2), got ' + JSON.stringify(h));
  that(near(distanceTo(tri, 3 - 4 * h.t, -Math.sqrt(3) / 2), r, 1e-6), 'at the contact the ball is exactly its radius away from the triangle'); }
{ // straight at a corner of a hexagon along the line through its centre: back the same way
  const hex = regular(6, 0, 0, 10), h = newHit(), v = { vx: 0, vy: 1 };
  that(sweepCirclePoly(0, -30, 0, 40, 2, hex, h) && near(h.nx, 0) && near(h.ny, -1), 'a ball falling onto the top corner of a hexagon gets the normal straight up');
  reflect(v, h.nx, h.ny); that(near(v.vy, -1) && near(v.vx, 0), 'and goes straight back up'); }
{ const h = newHit();
  that(sweepCirclePoint(0, -100, 0, 200, 50, 0, 0, h) && near(h.t, 0.25) && near(h.ny, -1), 'a ball meets a round bumper when the centres are the two radii apart'); }

// ---------- the flight ----------
{ const v = { vx: 500, vy: 3 }; keepSteep(v);
  const speed = Math.hypot(v.vx, v.vy);
  that(near(speed, Math.hypot(500, 3)) && Math.abs(v.vy) / speed >= Math.cos(70 * DEG) - 1e-9 && v.vx > 0 && v.vy > 0, 'an almost flat flight is raised to 70° from vertical at the same speed'); }
{ const g = gameOf(['. . . a . . .']);
  // 60 000 units a second is 500 units in one step: ten times the brick's height
  fly(g, cx(3), cy(0) + 300, 0, -60000);
  steps(g, 1);
  that(g.bricks[0].hits === 0 && g.balls[0].vy > 0 && g.balls[0].y > 231, 'a ball moving 500 units in one step still breaks the brick in its way and comes back'); }
{ const g = createGame(parseLevel({ id: '1-1', tier: 1, name: N, intro: N, par: 100, blocks: [{ grid: 'tri', cell: [110], top: 300, rows: ['. b .'] }] }), tierOf(1));
  const t = g.bricks[0], x = t.cx;
  fly(g, x, 900, 0, -60000); g.events.length = 0;
  steps(g, 1);
  that(t.hits === 0 && g.balls[0].vy > 0, 'a fast ball does not pass through a triangle either'); }
{ const g = gameOf(['. . a a . . .']), seam = (g.bricks[0].x1 + g.bricks[1].x0) / 2;
  fly(g, seam, g.bricks[0].y1 + 40, 0, -480);
  steps(g, 20);
  that(g.bricks[0].hits + g.bricks[1].hits === 1 && g.balls[0].vy > 0, 'a ball on the seam of two bricks breaks one, not both'); }

// ---------- the paddle: centre up, edges at 60°; spin; sticky; stunned ----------
function paddleHit(offset: number, paddleVx = 0) {
  const g = gameOf(['a . . . . . .']), r = g.tier.ball;
  // the ball starts 2 units above the contact height, so it reaches the paddle within one step (480 / 120 = 4 units)
  fly(g, 0, PADDLE_TOP - r - 2, 0, 480);
  const reach = g.paddle.w / 2 + r;
  g.balls[0].x = g.paddle.x + paddleVx * STEP_DT + offset * reach; g.balls[0].prevX = g.balls[0].x;
  step(g, { targetX: paddleVx ? g.paddle.x + paddleVx * STEP_DT : null, launch: false }, STEP_DT);
  return g.balls[0];
}
{ const b = paddleHit(0); that(near(b.vx, 0) && b.vy < 0, 'the centre of the paddle sends the ball straight up'); }
{ const b = paddleHit(1), s = Math.hypot(b.vx, b.vy); that(near(b.vx / s, Math.sin(60 * DEG)) && near(b.vy / s, -0.5), 'the right edge sends the ball 60° to the right'); }
{ const b = paddleHit(-1), s = Math.hypot(b.vx, b.vy); that(near(b.vx / s, -Math.sin(60 * DEG)), 'the left edge sends the ball 60° to the left'); }
{ const b = paddleHit(0, 1200); that(b.vx > 0 && b.vy < 0, 'a paddle moving right gives the ball a spin to the right'); }
{ const g = gameOf(['a . . . . . .']);
  g.phase = 'play'; g.effects.stun = 5;
  const angles: number[] = [];
  for (let i = 0; i < 12; i++) { hitPaddle(g, g.balls[0], 0); angles.push(Math.atan2(g.balls[0].vx, -g.balls[0].vy)); }
  that(angles.some((a) => Math.abs(a) > 1 * DEG) && angles.every((a) => Math.abs(a) <= 20 * DEG + 1e-9), 'a stunned paddle sends a centre hit off by up to 20°, never more'); }

// ---------- bricks ----------
{ const g = gameOf(['c3 . . . . . a']);
  g.phase = 'play';
  hitBrick(g, 0, 0, 1, 'ball'); hitBrick(g, 0, 0, 1, 'ball');
  that(g.bricks[0].hits === 1 && g.bricksLeft === 2, 'a brick of strength 3 still stands after two hits, showing 1');
  hitBrick(g, 0, 0, 1, 'ball');
  that(g.bricks[0].hits === 0 && g.bricksLeft === 1, 'the third hit breaks it'); }
{ const g = gameOf(['# . . . . . a']);
  g.phase = 'play';
  that(g.bricksLeft === 1, 'steel bricks do not count for clearing the level');
  for (let i = 0; i < 5; i++) hitBrick(g, 0, 0, 1, 'ball');
  explode(g, g.bricks[0].cx, g.bricks[0].cy, 300, false);
  that(g.bricks[0].hits === 1 && g.events.includes('steel'), 'steel never breaks, not even in a blast, and rings when hit'); }
{ const g = gameOf(['s . . . . . a', 's< . . . . . .']);
  g.phase = 'play';
  hitBrick(g, 0, 0, 1, 'ball'); hitBrick(g, 0, -1, 0, 'ball'); hitBrick(g, 0, 1, 0, 'ball');
  that(g.bricks[0].hits === 1 && g.events.includes('clank'), 'a shield brick does not break from the front or the sides');
  hitBrick(g, 0, 0, -1, 'ball');
  that(g.bricks[0].hits === 0, 'a hit from behind breaks it');
  hitBrick(g, 2, 0, -1, 'ball');
  that(g.bricks[2].hits === 1, 'a shield turned left does not break from behind…');
  hitBrick(g, 2, -1, 0, 'ball');
  that(g.bricks[2].hits === 0, '…but from its left side'); }
{ const g = gameOf(['. . . s . . a']);
  fly(g, cx(3), cy(0) + 120, 0, -600);
  steps(g, 30);
  that(g.bricks[0].hits === 1 && g.balls[0].vy > 0, 'a ball from below bounces off the armour of a shield brick'); }
{ const g = gameOf(['m3 . . . . . a']), b = g.bricks[0], box0 = bbox(b.shapes[0]);
  that(b.shapes.length === 3, 'a brick that changes shape has one shape per point of strength');
  that(b.shapes.every((s, i) => { const k = bbox(s); return k.x0 >= box0.x0 - 1e-9 && k.x1 <= box0.x1 + 1e-9 && k.y0 >= box0.y0 - 1e-9 && k.y1 <= box0.y1 + 1e-9 && (i === 0 || Math.abs(area2(s)) < Math.abs(area2(b.shapes[i - 1]))); }),
    'each next shape is smaller and stays inside the first one, so it never grows into a neighbour');
  g.phase = 'play'; hitBrick(g, 0, 0, 1, 'ball');
  that(b.stage === 1 && b.poly.length === b.shapes[1].length && b.hits === 2, 'after a hit it takes its next shape'); }
{ const g = gameOf(['x a x . . . a']);
  g.phase = 'play'; hitBrick(g, 0, 0, 1, 'ball');
  that(g.bricks[0].hits === 0 && g.bricks[1].hits === 0 && g.bricks[2].hits === 1, 'an explosive brick takes its neighbour (57 away) but not a brick 165 away');
  const h = gameOf(['x x x . . . a']);
  h.phase = 'play'; hitBrick(h, 0, 0, 1, 'ball');
  that(h.bricks.slice(0, 3).every((b) => b.hits === 0) && h.bricks[3].hits === 1, 'explosive bricks set each other off in a chain'); }
{ const g = gameOf(['r . . . . . a']);
  g.phase = 'play'; hitBrick(g, 0, 0, 1, 'ball');
  that(g.bricks[0].hits === 0 && g.bricks[0].regenAt > 0, 'a regrowing brick broken alone waits to come back');
  g.time += 12.1; updateWall(g, STEP_DT);
  that(g.bricks[0].hits === 1 && g.bricksLeft === 2 && g.events.includes('regrow'), 'twelve seconds later it is back and counts again');
  g.combo = 2; hitBrick(g, 0, 0, 1, 'ball');
  that(g.bricks[0].hits === 0 && g.bricks[0].regenAt === 0, 'broken as the third brick of a run it stays broken'); }
{ const g = gameOf(['i2 . . . . . a']);
  g.phase = 'play'; hitBrick(g, 0, 0, 1, 'ball');
  that(g.bricks[0].flash > 0 && g.bricks[0].hits === 1, 'an invisible brick shows for a moment after a hit'); }
{ const g = gameOf(['@5 . . . . . a']);
  g.phase = 'play'; explode(g, g.bricks[0].cx, g.bricks[0].cy, 200, false);
  that(g.bricks[0].hits === 4, 'a blast takes one point off the core, not all of it'); }

// ---------- bonuses ----------
{ const g = gameOf(['. . . a+W . . a']);
  g.phase = 'play'; hitBrick(g, 0, 0, 1, 'ball');
  that(g.capsules.length === 1 && g.capsules[0].kind === 'wide' && near(g.capsules[0].x, cx(3)), 'a broken bonus brick drops its capsule where it was');
  g.paddle.x = cx(3);
  for (let i = 0; i < 400 && g.capsules.length; i++) moveCapsules(g, STEP_DT);
  that(g.effects.size?.kind === 'wide' && near(g.paddle.w, 248 * 1.5), 'a caught capsule makes the paddle 1.5 times wider');
  tickEffects(g, 20.01);
  that(g.effects.size === null && near(g.paddle.w, 248), 'twenty seconds later the paddle is back to its size'); }
{ const g = gameOf(['. . . a+W . . a']);
  g.phase = 'play'; hitBrick(g, 0, 0, 1, 'ball'); g.paddle.x = 100;
  for (let i = 0; i < 120 * 5; i++) moveCapsules(g, STEP_DT);
  that(g.capsules.length === 0 && g.effects.size === null, 'a capsule that falls past the paddle is lost'); }
{ const g = gameOf(['a . . . . . .']);
  g.phase = 'play'; applyBonus(g, 'wide'); applyBonus(g, 'narrow');
  that(g.effects.size?.kind === 'narrow' && near(g.paddle.w, 248 * 0.65), 'a new size of the paddle replaces the old one'); }
{ const a = gameOf(['a . . . . . .']), b = gameOf(['a . . . . . .']);
  fly(a, 390, 900, 0, -600); fly(b, 390, 900, 0, -600); applyBonus(b, 'slow');
  steps(a, 10); steps(b, 10);
  that(near((900 - b.balls[0].y) / (900 - a.balls[0].y), 0.7), 'the slow bonus moves the ball 70% as far'); }
{ const g = gameOf(['a . . . . . .']);
  fly(g, 390, 700, 0, -600);
  applyBonus(g, 'second'); that(g.balls.length === 2, 'the second ball bonus adds one ball');
  applyBonus(g, 'multi'); that(g.balls.length === 3, 'multiball adds more, up to three on the field');
  that(g.balls.every((b) => b.vy < 0), 'new balls go the same way, turned a little'); }
{ const g = gameOf(['a . . . . . .']);
  g.phase = 'play'; applyBonus(g, 'extra'); that(g.tray === 4, 'the extra ball goes into the tray');
  g.tray = TRAY_MAX; applyBonus(g, 'extra'); that(g.tray === TRAY_MAX, 'but not past five'); }
{ const g = gameOf(['. . a . s . a']);
  g.phase = 'play'; applyBonus(g, 'laser');
  that(fireLaser(g) && g.shots.length === 2 && !fireLaser(g), 'the laser fires two shots, then cools down');
  for (let i = 0; i < 120 && g.shots.length; i++) moveShots(g, STEP_DT);
  that(g.bricks[0].hits === 0 && g.bricks[1].hits === 1, 'a shot breaks the brick above it; the armour of a shield brick stops the other'); }
{ const g = gameOf(['a . . . . . .']);
  applyBonus(g, 'sticky');
  fly(g, g.paddle.x + 20, PADDLE_TOP - g.tier.ball - 2, 0, 480);
  steps(g, 2);
  that(g.balls[0].stuck !== null && g.effects.sticky === 4, 'a sticky paddle catches the ball');
  steps(g, 30, { targetX: 200, launch: false });
  that(near(g.balls[0].x, g.paddle.x + 20), 'the caught ball rides with the paddle');
  step(g, { targetX: null, launch: true }, STEP_DT);
  that(g.balls[0].stuck === null && g.balls[0].vy < 0 && g.balls[0].vx > 0, 'a launch lets it go, to the side where it sat'); }
{ const g = gameOf(['. . . a . . .', '. . . b . . .', '. . . c . . .', '. . . . . . d']);
  fly(g, cx(3), cy(2) + 60, 0, -600); applyBonus(g, 'comet');
  steps(g, 40);
  that(g.bricks.slice(0, 3).every((b) => b.hits === 0) && g.balls[0].vy < 0, 'a comet burns through three bricks without turning back'); }
{ const g = gameOf(['a . . . . . .']);
  fly(g, 100, FIELD_H - 80, 0, 600); applyBonus(g, 'shield');
  steps(g, 20);
  that(g.balls[0].vy < 0 && !g.effects.barrier && g.tray === 3, 'the shield at the bottom saves one ball and is used up'); }
{ const g = gameOf(['a a a . . . a']);
  g.phase = 'play'; applyBonus(g, 'bomb'); hitBrick(g, 1, 0, 1, 'ball');
  that(g.bricks.slice(0, 3).every((b) => b.hits === 0) && g.bricks[3].hits === 1 && !g.effects.bomb, 'the bomb bonus blows up the bricks around the next hit, once'); }

// ---------- the time bomb ----------
{ const g = gameOf(['a a a # a a a']);
  fly(g, 390, 800, 0, -600);
  that(spawnTimeBomb(g, 390, 300) && g.balls.length === 2 && g.balls[1].kind === 'bomb' && near(g.balls[1].fuse, 12), 'a time bomb joins the ball on the field with twelve seconds on its clock');
  const bomb = g.balls[1];
  bomb.vx = 0; bomb.vy = 0; bomb.fuse = 0.001;
  tickBombs(g, STEP_DT);
  // the bomb at (390, 300): steel at the centre stands; bricks next to it (57 away) break; the outer ones are 390 − 117 = 273 away, past the 270 radius
  that(g.bricks[3].hits === 1 && g.bricks[2].hits === 0 && g.bricks[4].hits === 0, 'the blast breaks the bricks around it, not the steel');
  that(g.bricks[0].hits === 1 && g.bricks[6].hits === 1, 'bricks 273 away are outside the 270 circle');
  that(g.balls.length === 1 && g.effects.stun === 0, 'the bomb is gone, and a blast far from the paddle does not stun it'); }
{ const g = gameOf(['a . . . . . .']);
  fly(g, 390, 500, 0, -600);
  spawnTimeBomb(g, g.paddle.x, PADDLE_TOP - 60); g.balls[1].fuse = 0.001;
  tickBombs(g, STEP_DT); fitPaddle(g);
  that(g.effects.stun === 8 && near(g.paddle.w, 248 * 0.7) && g.events.includes('stun'), 'a blast next to the paddle stuns it for 8 seconds and makes it shorter'); }
{ const g = gameOf(['a . . . . . .']);
  fly(g, 390, 500, 0, -600);
  spawnTimeBomb(g, 100, FIELD_H - 30); g.balls[1].vy = 600;
  for (let i = 0; i < 30; i++) { Object.assign(g.balls[0], { x: 390, y: 500, vy: -600 }); step(g, stay, STEP_DT); }
  that(g.balls.length === 1 && g.tray === 3 && g.phase === 'play', 'a time bomb that falls out is simply gone: no ball lost'); }

// ---------- the tray ----------
{ const g = gameOf(['a . . . . . .']);
  fly(g, 100, FIELD_H - 5, 0, 480);
  that(g.tray === 3, 'a run starts with three balls');
  steps(g, 10);
  that(g.tray === 2 && g.phase === 'serve' && g.events.includes('serve'), 'a lost ball takes one from the tray and the next waits on the paddle');
  g.tray = 1; fly(g, 100, FIELD_H - 5, 0, 480);
  steps(g, 10);
  that(g.tray === 0 && g.phase === 'over', 'losing the last ball ends the game'); }
{ const g = gameOf(['a . . . . . .']);
  fly(g, 300, 600, 0, -480);
  that(addFieldBall(g, 400, 600, 100, -480) && addFieldBall(g, 500, 600, -100, -480) && !addFieldBall(g, 600, 600, 0, -480), 'at most three balls on the field');
  Object.assign(g.balls[1], { y: FIELD_H - 5, vy: 480 });
  steps(g, 10);
  that(g.balls.length === 2 && g.tray === 3, 'losing one of several balls costs nothing'); }
{ const g = gameOf(['a . . . . . .']);
  fly(g, 300, 600, 0, -480);
  const keepUp = () => Object.assign(g.balls[0], { x: 300, y: 600, vx: 0, vy: -480 });
  for (let i = 0; i < 120 * 61; i++) { keepUp(); step(g, stay, STEP_DT); }
  that(g.tray === 4, 'in the first tier a minute in play adds a ball to the tray');
  const h = gameOf(['a . . . . . .'], {}, 3);
  fly(h, 300, 600, 0, -480);
  for (let i = 0; i < 120 * 61; i++) { Object.assign(h.balls[0], { x: 300, y: 600, vx: 0, vy: -480 }); step(h, stay, STEP_DT); }
  that(h.tray === 3 && near(extraBallProgress(h), 61 / 90, 1e-3), 'in the third tier it takes 90 seconds'); }

// ---------- the wall, the field ----------
{ const g = gameOf(['a . . . . . .'], { descend: 30 });
  g.phase = 'play';
  const y0 = g.bricks[0].y0;
  for (let i = 0; i < 120 * 62; i++) updateWall(g, STEP_DT);
  that(near(g.bricks[0].y0 - y0, 104), 'a wall that creeps every 30 s is two rows (2 × 52) lower after a minute'); }
{ const g = gameOf(['a . . . . . .'], { descend: 30 });
  g.phase = 'play';
  g.wall.drop = g.wall.target = DANGER_Y - g.bricks[0].y1 + 10;
  updateWall(g, STEP_DT);
  that(g.tray === 2 && g.events.includes('crush') && g.bricks[0].y1 < DANGER_Y, 'a wall at the red line costs a ball and goes back up'); }
{ const g = gameOf(['. . . a . . .', '. . . . . . b'], { moving: [{ block: 0, row: 0, amp: 100, speed: 1 }] });
  g.phase = 'play'; g.time = Math.PI / 2;
  updateWall(g, STEP_DT);
  that(near(g.bricks[0].ox, 100) && near(g.bricks[0].cx, cx(3) + 100), 'a moving row is at its full swing a quarter turn in'); }
{ const g = gameOf(['a . . . . . .'], { objects: [{ type: 'bumper', x: 390, y: 600, r: 40 }] });
  fly(g, 390, 700, 0, -600);
  steps(g, 20);
  that(g.balls[0].vy > 0 && near(Math.hypot(g.balls[0].vx, g.balls[0].vy), 648), 'a bumper sends the ball back 8% faster'); }
{ const g = gameOf(['a . . . . . .'], { objects: [{ type: 'portal', ax: 200, ay: 700, bx: 600, by: 400, r: 38 }] });
  fly(g, 200, 760, 0, -600);
  steps(g, 15);
  that(Math.abs(g.balls[0].x - 600) < 1 && g.balls[0].y < 400 && g.balls[0].vy < 0, 'a ball into one portal comes out of the other, still going up'); }
{ const g = gameOf(['a . . . . . .'], { objects: [{ type: 'spinner', x: 390, y: 600, length: 220, width: 20, speed: 0 }] });
  fly(g, 390, 700, 0, -600);
  steps(g, 30);
  that(g.balls[0].vy > 0, 'a bar on the field turns the ball back'); }
{ const g = gameOf(['a . . . . . .']);
  fly(g, 40, 700, -600, -300);
  g.idle = LOOP_SECONDS + 1;
  steps(g, 6);
  const angle = Math.atan2(g.balls[0].vx, -g.balls[0].vy), plain = Math.atan2(600, 300);
  that(Math.abs(angle - plain) > 5 * DEG, 'a ball that met nothing useful for a long time is turned a little at the next wall'); }

// ---------- points, stars ----------
that(brickPoints(3, 2, 1.5, true) === 12000, 'strength 2, third in a run, with a bonus, in tier 2: (1 000 · 2 · 3 + 2 000) · 1.5 = 12 000');
that(brickPoints(1, 1, 1) + brickPoints(2, 1, 1) + brickPoints(3, 1, 1) === 6000, 'three bricks in a run: 1 000 + 2 000 + 3 000');
that(brickPoints(25, 1, 1) === 10000 && brickPoints(1, 1, 2, false, true) === 1000, 'the run stops at ten; a blast gives half');
that(levelStars(0, 50, 60) === 3 && levelStars(0, 70, 60) === 2 && levelStars(1, 10, 60) === 2 && levelStars(2, 10, 60) === 1, 'stars: three clean and fast, two with one loss or slow, one otherwise');
{ const b = levelBonus(60.4, 100, 3, 2); that(b.timeBonus === 39000 && b.ballsBonus === 60000, 'level bonus: 39 whole seconds · 500 · 2 and 3 balls · 10 000 · 2'); }
{ const g = gameOf(['a . . . . . .']);
  fly(g, 390, 600, 0, -600); g.time = 40;
  hitBrick(g, 0, 0, 1, 'ball');
  that(g.phase === 'won' && g.result!.stars === 3 && g.result!.total === 1000 + 30000 + 60 * 500 && g.score === g.result!.total, 'the last brick clears the level; the summary adds up');
  finishLevel(g);
  that(g.score === g.result!.total, 'the end bonus is counted once'); }
that(comboPitch(1) === 1 && near(comboPitch(13), 2), 'the brick sound climbs an octave over a run of twelve');

// ---------- levels ----------
that(LEVELS.length === 24 && LEVELS.every((l, i) => l.id === `${Math.floor(i / 8) + 1}-${(i % 8) + 1}`), 'there are 24 levels, 1-1 … 3-8, in order');
that(LEVELS.every((l) => l.tier === Number(l.id[0]) && l.name.ru && l.name.en && l.intro.ru && l.intro.en), 'every level has its tier and names in both languages');
{ let inside = true, apart = true;
  for (const l of LEVELS) {
    for (const b of l.bricks) { const k = bbox(b.poly); if (k.x0 < 0 || k.x1 > FIELD_W || k.y0 < 0 || k.y1 > PADDLE_TOP - 300) inside = false; }
    for (let i = 0; i < l.bricks.length; i++) for (let j = i + 1; j < l.bricks.length; j++) if (!l.bricks[i].move && !l.bricks[j].move && overlaps(l.bricks[i].poly, l.bricks[j].poly)) apart = false;
  }
  that(inside, 'all bricks are inside the field, well above the paddle');
  that(apart, 'no two bricks overlap'); }
{ const kinds = new Set(LEVELS.flatMap((l) => l.bricks.map((b) => b.kind))), bonuses = new Set(LEVELS.flatMap((l) => l.bricks.map((b) => b.bonus)));
  const all: BrickKind[] = ['normal', 'steel', 'explosive', 'morph', 'shield', 'regen', 'invisible', 'core'];
  that(all.every((k) => kinds.has(k)), 'every kind of brick is in some level');
  that(Object.values(BONUS_CODES).every((b) => bonuses.has(b)), 'every bonus is in some level');
  that(LEVELS.some((l) => l.bumpers.length) && LEVELS.some((l) => l.portals.length) && LEVELS.some((l) => l.spinners.length) && LEVELS.some((l) => l.descend > 0), 'bumpers, portals, bars and the creeping wall are all used'); }
const refuses = (json: unknown) => { try { parseLevel(json); return false; } catch (e) { return e instanceof LevelError; } };
const base = { id: '1-1', tier: 1, name: N, intro: N, par: 100 };
that(refuses({ ...base, blocks: [{ grid: 'rect', cell: [108, 52], top: 100, rows: ['a b', 'a'] }] }), 'rows of a block with different lengths are refused');
that(refuses({ ...base, blocks: [{ grid: 'rect', cell: [108, 52], top: 100, rows: ['a ?'] }] }), 'an unknown cell is refused');
that(refuses({ ...base, blocks: [{ grid: 'rect', cell: [108, 52], top: 100, rows: ['# #'] }] }), 'a level of steel only is refused');
that(refuses({ ...base, blocks: [{ grid: 'rect', cell: [108, 52], top: 100, rows: ['#+W a'] }] }), 'steel cannot hold a bonus');
that(refuses({ ...base, tier: 2, blocks: [{ grid: 'rect', cell: [108, 52], top: 100, rows: ['a'] }] }), 'the tier must match the id');
that(refuses({ ...base, blocks: [{ grid: 'star', cell: [108], top: 100, rows: ['a'] }] }), 'an unknown grid is refused');

// ---------- every level, played by a good player: the ball never leaves the field and the level is cleared ----------
{ const report: string[] = [];
  for (const level of LEVELS) {
    const g = createGame(level, tierOf(level.tier), { tray: 5, seed: 7 });
    let seed = 99, aim = 0, count = 0, escaped = false;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    while (g.phase !== 'won' && count < 120 * 60 * 20) {
      const real = g.balls.filter((b) => b.kind === 'normal' && b.stuck === null).sort((a, b) => (b.vy > 0 ? b.y : -1e9) - (a.vy > 0 ? a.y : -1e9));
      const target = real[0];
      if (target && target.vy < 0) aim = (rnd() * 2 - 1) * 0.75 * (g.paddle.w / 2);
      step(g, { targetX: target ? target.x - aim : null, launch: g.phase === 'serve' || count % 36 === 0 }, STEP_DT);
      if (g.phase === 'over' || g.events.includes('lost') || g.events.includes('crush')) { g.tray = 5; if (g.phase === 'over') { g.phase = 'play'; g.balls.length = 0; g.lost = 0; } }
      g.events.length = 0; g.fx.length = 0;
      if (g.phase === 'play' && !g.balls.some((b) => b.kind === 'normal')) { g.phase = 'serve'; g.balls.push({ kind: 'normal', x: g.paddle.x, y: g.paddle.top - g.tier.ball, vx: 0, vy: 0, r: g.tier.ball, prevX: 0, prevY: 0, fuse: 0, stuck: null, portalWait: 0 }); }
      for (const b of g.balls) if (b.x < b.r - 1e-6 || b.x > FIELD_W - b.r + 1e-6 || b.y < b.r - 1e-6) escaped = true;
      count++;
    }
    that(!escaped, `${level.id}: the ball never leaves through a wall or the ceiling`);
    that(g.phase === 'won', `${level.id}: a good player clears it within 20 minutes (left ${g.bricksLeft})`);
    report.push(`${level.id} ${Math.round(count / 120)}s`);
  }
  console.log('test player: ' + report.join(', ')); }

// ---------- progress, saves, the session ----------
{ const p = emptyProgress();
  that(recordLevel(p, '1-1', 2, 500) && !recordLevel(p, '1-1', 1, 400) && recordLevel(p, '1-1', 1, 900) && p.stars['1-1'] === 2 && p.best['1-1'] === 900, 'a level keeps its best stars and its best result separately');
  const ids = LEVELS.map((l) => l.id);
  that(isOpen(p, ids, 0) && isOpen(p, ids, 1) && !isOpen(p, ids, 2) && !isOpen(p, ids, 8), 'a level opens when the one before it is cleared');
  that(totalStars(p) === 2, 'the stars add up');
  that(JSON.stringify(cleanProgress({ stars: { '1-1': 3, '9-9': 3, '1-2': 7 }, best: { '1-1': -5, '1-3': 12.7 } })) === '{"stars":{"1-1":3},"best":{"1-3":12}}', 'bad entries in storage are dropped'); }
{ const g = createGame(LEVELS[4], tierOf(1), { tray: 4, score: 12000 });
  g.bricks[0].hits = 0; g.bricks[3].hits = 0; g.wall.drop = 0; g.lost = 1;
  const save = snapshot(g, true, 1000), back = decode(JSON.parse(JSON.stringify(save)));
  that(back !== null && back.level === '1-5', 'a save survives JSON and names its level');
  const r = restore(back!);
  that(r.level.id === '1-5' && r.score === 12000 && r.tray === 4 && r.lost === 1 && r.bricks[0].hits === 0 && r.bricksLeft === LEVELS[4].bricks.length - 2 && r.phase === 'serve', 'a restored game has the same level, points, balls and broken bricks');
  that(decode({ ...save, level: '9-9' }) === null && decode({ ...save, hits: save.hits.slice(1) }) === null && decode({ ...save, tray: 9 }) === null && decode({ ...save, v: 1 }) === null, 'saves of unknown levels, with the wrong bricks or impossible trays are refused');
  that(decode({ ...save, hits: save.hits.map(() => 0) }) === null, 'a save of a cleared wall is refused'); }
{ const store = memoryStore(), s = new Session(store);
  s.startAt(0); that(s.ranked, 'a run from the first level of a tier counts for the top 10');
  s.startAt(3); that(!s.ranked, 'a run from the middle of a tier does not');
  const r = new Session(memoryStore(), true);
  r.startAt(0); that(!r.ranked && r.isOpen(23), 'the review mode opens every level and never counts'); }
{ const s = new Session(memoryStore());
  s.startAt(0); s.game.tray = 4;
  skipLevel(s.game); s.handle(s.game.events); s.game.events.length = 0;
  const score = s.game.score;
  that(s.stars(0) >= 1 && s.isOpen(1), 'clearing 1-1 gives its stars and opens 1-2');
  s.nextLevel();
  that(s.index === 1 && s.game.level.id === '1-2' && s.game.tray === 4 && s.game.score === score && s.ranked, 'the next level keeps the score and the tray of the run');
  s.startAt(7); skipLevel(s.game); s.handle(s.game.events); s.nextLevel();
  that(s.game.level.id === '2-1' && s.game.tier.world === 'neon' && s.game.tier.paddle === 210, 'after 1-8 the run goes on in the second tier, in the neon world, with a shorter paddle');
  s.startAt(10); s.restartTier();
  that(s.index === 8 && s.game.tray === 3 && s.game.score === 0 && s.ranked, 'after a lost game the tier starts again from its first level, with three balls and no points'); }
{ const store = memoryStore(), s = new Session(store);
  s.setPlayer('Anna'); s.startAt(0); s.game.score = 5000; s.game.phase = 'over'; s.handle(['over' as GameEvent]);
  that(loadTop(store)[0]?.score === 5000, 'a lost ranked run goes into the top 10');
  s.startAt(1); s.game.score = 9000; s.game.phase = 'over'; s.handle(['over' as GameEvent]);
  that(loadTop(store)[0]?.score === 5000, 'a run that did not start at a tier start does not');
  s.startAt(16);
  for (let i = 0; i < 8; i++) { skipLevel(s.game); s.handle(s.game.events); s.game.events.length = 0; if (i < 7) s.nextLevel(); }
  that(s.gameCompleted && loadTop(store)[0].score === s.game.score, 'clearing 3-8 completes the game and puts the run into the top 10'); }
{ const store = memoryStore(), s = new Session(store);
  s.setPlayer('Vera'); s.startAt(0); s.handle(s.game.events); s.game.events.length = 0;
  that(s.savedGame()?.level === '1-1', 'autosave keeps the start of the first ball');
  s.game.bricks[0].hits = 0; s.game.bricksLeft -= 1; s.game.score = 1000; s.handle(['serve']);
  s.startAt(5);
  that(s.continueSaved() && s.game.level.id === '1-1' && s.game.bricks[0].hits === 0 && s.game.score === 1000, 'going on brings back the level, the broken bricks and the points');
  skipLevel(s.game); s.handle(s.game.events);
  that(s.savedGame()?.level === '1-2', 'after a cleared level the save is the start of the next one');
  s.game.phase = 'over'; s.handle(['over' as GameEvent]);
  that(s.savedGame() === null, 'a finished run leaves no save'); }
{ const store = memoryStore(), s = new Session(store);
  s.setPlayer('Ivan'); s.setAutosave(false); s.startAt(0); s.handle(s.game.events);
  that(s.savedGame() === null && s.saveNow() && s.savedGame() !== null, 'with autosave off only the Save button saves'); }

// ---------- names, top 10, players ----------
that(cleanName('  anna  maria! ') === 'ANNA MARIA' && cleanName('<b>x</b>') === 'BXB' && cleanName('a'.repeat(30)).length === 18, 'nicknames are cleaned the same way as in the other games');
that(isRude('FuCk') && isRude('х у й') && !isRude('Anna') && !isRude('Yurii'), 'rude nicknames are caught, ordinary ones pass');
{ let rows = mergeScore([], 'anna', 500);
  rows = mergeScore(rows, 'boris', 900); rows = mergeScore(rows, 'anna', 300);
  that(rows.length === 2 && rows[1].score === 500, 'a lower result does not replace a better one');
  for (let i = 0; i < 15; i++) rows = mergeScore(rows, 'p' + i, 100 + i);
  that(rows.length === 10, 'the board keeps ten rows'); }
{ const store = memoryStore();
  store.setItem('krinkerlabs.breakwall.top10', '[{"name":"<img>","score":5},{"name":"x","score":-1},"junk"]');
  that(JSON.stringify(loadTop(store)) === '[{"name":"IMG","score":5}]', 'rows from storage are cleaned'); }
{ const rows = boardRows([{ name: 'ANNA', score: 1500 }], 'ANNA', formatScore);
  that(rows.length === 10 && rows[0].me && rows[0].score === '1 500' && rows[1].vacant, 'the board shows ten places, the player marked'); }
{ const store = memoryStore();
  rememberPlayer(store, 'anna'); rememberPlayer(store, 'boris'); rememberPlayer(store, 'anna');
  that(loadPlayer(store) === 'ANNA' && JSON.stringify(recentPlayers(store)) === '["ANNA","BORIS"]', 'the last nickname is the player, the recent list has no repeats'); }

// ---------- the screen, input, texts ----------
{ const loop = new FixedStep(); let ticks = 0;
  for (let i = 0; i < 30; i++) loop.advance(1 / 30, () => ticks++);
  that(ticks === 120, 'one second at 30 frames a second is 120 steps');
  ticks = 0; new FixedStep().advance(2, () => ticks++);
  that(ticks === 30, 'a two-second freeze runs only a quarter of a second'); }
that(OUTER_W === FIELD_W + 2 * RAIL && OUTER_H === FIELD_H + RAIL, 'the table is the field with a rail left, right and on top');
{ const f = fitField(OUTER_W * 3, OUTER_H); that(f.scale === 1 && f.left === OUTER_W && f.top === 0, 'a wide screen gives the table its full height, centred'); }
that(screenToField(400, 390, 1) === 10 && screenToField(400, 0, 0.5) === 800, 'screen x turns into field x');
that(SPECTRUM[0] === SPECTRUM[SPECTRUM.length - 1] && near(spectrumAngle(SPECTRUM_SECONDS / 4, false), Math.PI / 2) && spectrumAngle(5, true) === 0, 'the rails turn their colours once a period, without a seam, and stand still when motion is reduced');
that(keyAction('ShiftLeft') === 'left' && keyAction('ShiftRight') === 'right' && keyAction('Enter') === 'launch' && keyAction('Space') === 'pause' && keyAction('KeyM') === 'sound' && keyAction('Escape') === 'leave', 'the keys do what the controls list says');
that(movedTarget(400, 30, 0.5, 124, 656) === 460 && movedTarget(640, 300, 0.5, 124, 656) === 656, 'a held mouse moves the paddle by its movement and not past the walls');
that(!isCompact(1440, 900) && isCompact(390, 844) && isCompact(810, 1080) && isCompact(915, 412), 'side panels on computers, the phone layout on phones and upright tablets');
{ const g = gameOf(['a . . . . . .']);
  that(messageFor(g, false) === 'serve' && messageFor(g, true) === 'paused', 'serve and pause messages');
  g.phase = 'won'; that(messageFor(g, false) === null, 'the end of a level has its own screen, not the message'); }
that(leaveFirst('ANNA', true) === 'save' && leaveFirst('', true) === 'name' && leaveFirst('ANNA', false) === null, 'leaving offers to save, to give a name, or just to go');
that(formatScore(11000) === '11 000' && formatScore(1250000) === '1 250 000' && formatScore(999) === '999', 'scores have a space between thousands in every language');
that(starText(2) === '★★☆' && meterPercent(-1) === 100, 'stars and the meter as shown');
that(JSON.stringify(Object.keys(TEXTS.ru).sort()) === JSON.stringify(Object.keys(TEXTS.en).sort()) && Object.values(TEXTS.ru).every((s) => s.trim()), 'Russian and English have the same strings, none empty');
that(Object.values(BONUS_CODES).every((b) => (TEXTS.ru as Record<string, string>)[`bonus_${b}`]), 'every bonus has a name to show');
that(fill(TEXTS.ru.next, { id: '1-4', name: 'Двойные' }) === 'Дальше: 1-4 «Двойные»', 'the way on names the next level');
that(pickLanguage(['ru-RU']) === 'ru' && pickLanguage(['de']) === 'en', 'the language follows the browser, English by default');
that(isTierStart(8) && isTierEnd(7) && tierStart(13) === 8 && indexOf('2-1') === 8 && TIERS.length === 3, 'tiers start at 1-1, 2-1, 3-1');
that(PADDLE_MAX_SPEED > 0 && TIERS.every((t, i) => i === 0 || (t.paddle < TIERS[i - 1].paddle && t.ball < TIERS[i - 1].ball && t.startSpeed > TIERS[i - 1].startSpeed)), 'each tier has a shorter paddle, a smaller ball and a faster start');
{ const broken: KeyValueStore = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); } };
  let threw = false; try { writeFlag(broken, 'sound', false); rememberPlayer(broken, 'x'); addToTop(broken, 'x', 5); } catch { threw = true; }
  that(!threw && readFlag(broken, 'sound', true), 'a refused storage never breaks the game'); }

console.log(`${run - failed} of ${run} checks passed`);
if (failed) process.exit(1);
