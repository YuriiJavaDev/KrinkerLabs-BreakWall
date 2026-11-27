import { BonusKind, BrickKind, Level, MoveSpec, Spinner } from '../levels/level';
import { Poly } from '../levels/shapes';
import { Tier } from '../levels/tiers';
import { FIELD_W, PADDLE_H, PADDLE_TOP, TRAY_START } from './config';
import { makeBrick } from './bricks';

/** serve: a ball waits on the paddle; play: balls fly; won: the level is cleared; over: the tray is empty. */
export type Phase = 'serve' | 'play' | 'won' | 'over';

export type GameEvent =
  | 'serve' | 'launch' | 'wall' | 'paddle' | 'brick' | 'crack' | 'clank' | 'steel' | 'drain' | 'lost' | 'extra' | 'won' | 'over'
  | 'capsule' | 'bonus' | 'harm' | 'laser' | 'explode' | 'bump' | 'portal' | 'tick' | 'stun' | 'crush' | 'creep' | 'regrow';

export interface Brick {
  kind: BrickKind;
  hits: number;
  maxHits: number;
  color: number;
  bonus: BonusKind | null;
  weak: [number, number] | null;
  /** The shape for each strength step; a brick that does not change shape has one. Positions without the offsets below. */
  shapes: Poly[];
  stage: number;
  /** The current shape in field coordinates and its bounds and centre. */
  poly: Poly;
  x0: number; y0: number; x1: number; y1: number; cx: number; cy: number;
  /** Offset of a moving row (x) and of the creeping wall (y); speed of a moving row. */
  ox: number; oy: number; vx: number;
  move: MoveSpec | null;
  /** Game time when a broken regrowing brick comes back; 0 when it is not waiting. */
  regenAt: number;
  /** Seconds the brick still shows a hit (and an invisible brick is visible). */
  flash: number;
  /** Changes whenever the look of the brick changes, so the renderer knows when to repaint it. */
  version: number;
}

export type BallKind = 'normal' | 'bomb';

export interface Ball {
  kind: BallKind;
  x: number; y: number; vx: number; vy: number; r: number; prevX: number; prevY: number;
  /** Seconds to the blast of a time bomb. */
  fuse: number;
  /** Where on the paddle a caught ball sits (sticky paddle), or null. */
  stuck: number | null;
  /** Seconds before a portal can take this ball again. */
  portalWait: number;
}

export interface Paddle { x: number; w: number; baseW: number; top: number; h: number; vx: number; prevX: number }
export interface Capsule { kind: BonusKind; x: number; y: number; prevY: number }
export interface Shot { x: number; y: number; prevY: number }
export interface SpinnerState { spec: Spinner; angle: number; poly: Poly }

export interface Effects {
  size: { kind: 'wide' | 'narrow'; left: number } | null;
  pace: { kind: 'slow' | 'fast'; left: number } | null;
  laser: number;
  laserWait: number;
  sticky: number;
  comet: number;
  bomb: boolean;
  barrier: boolean;
  stun: number;
}

/** Something to show where it happened: broken pieces, a blast, sparks. Only for the picture. */
export interface Fx { kind: 'shards' | 'blast' | 'spark' | 'portal' | 'catch' | 'crush'; x: number; y: number; r: number; color: number }

export interface LevelResult { stars: number; time: number; lost: number; bricks: number; timeBonus: number; ballsBonus: number; total: number }

export interface Game {
  level: Level;
  tier: Tier;
  phase: Phase;
  /** Balls left, the one in play included. Losing the last ball on the field takes one; the game ends at zero. */
  tray: number;
  score: number;
  /** Points from bricks on this level, for the summary. */
  levelPoints: number;
  combo: number;
  speed: number;
  /** Seconds of play on this level (not counting serves and pauses). */
  time: number;
  /** Balls lost on this level. */
  lost: number;
  bricks: Brick[];
  /** Bricks that still have to break; steel ones never count. */
  bricksLeft: number;
  balls: Ball[];
  paddle: Paddle;
  capsules: Capsule[];
  shots: Shot[];
  spinners: SpinnerState[];
  effects: Effects;
  /** The creeping wall: how far it is down now, where it is going, and the time to its next step. */
  wall: { drop: number; target: number; timer: number };
  ballTime: number;
  nextExtraAt: number;
  /** Seconds since a ball last touched the paddle or a brick. */
  idle: number;
  /** State of the game's own random numbers, so a game can be replayed exactly. */
  seed: number;
  result: LevelResult | null;
  /** The bonus caught last, for its name on the screen; the reader sets it back to null. */
  lastBonus: BonusKind | null;
  events: GameEvent[];
  fx: Fx[];
}

export const noEffects = (): Effects => ({ size: null, pace: null, laser: 0, laserWait: 0, sticky: 0, comet: 0, bomb: false, barrier: false, stun: 0 });

export function newBall(x: number, y: number, r: number, kind: BallKind = 'normal'): Ball {
  return { kind, x, y, vx: 0, vy: 0, r, prevX: x, prevY: y, fuse: 0, stuck: null, portalWait: 0 };
}

export interface GameStart { tray?: number; score?: number; seed?: number }

export function createGame(level: Level, tier: Tier, start: GameStart = {}): Game {
  const bricks = level.bricks.map(makeBrick);
  const paddle: Paddle = { x: FIELD_W / 2, w: tier.paddle, baseW: tier.paddle, top: PADDLE_TOP, h: PADDLE_H, vx: 0, prevX: FIELD_W / 2 };
  return {
    level, tier, phase: 'serve', tray: start.tray ?? TRAY_START, score: start.score ?? 0, levelPoints: 0, combo: 0,
    speed: level.startSpeed ?? tier.startSpeed, time: 0, lost: 0,
    bricks, bricksLeft: bricks.filter((b) => b.kind !== 'steel').length,
    balls: [newBall(paddle.x, PADDLE_TOP - tier.ball, tier.ball)], paddle, capsules: [], shots: [],
    spinners: level.spinners.map((spec) => ({ spec, angle: spec.angle, poly: [0, 0, 0, 0, 0, 0, 0, 0] })),
    effects: noEffects(), wall: { drop: 0, target: 0, timer: 0 },
    ballTime: 0, nextExtraAt: tier.extraBallSeconds, idle: 0, seed: start.seed ?? 20261127, result: null, lastBonus: null, events: ['serve'], fx: [],
  };
}

/** The game's own random number in [0, 1): a small linear congruential generator, the same on every machine. */
export function random(g: Game): number {
  g.seed = (Math.imul(g.seed, 1103515245) + 12345) >>> 0;
  return g.seed / 4294967296;
}
