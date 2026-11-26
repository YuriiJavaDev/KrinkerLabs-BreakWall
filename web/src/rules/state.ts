import { Level } from '../levels/level';
import {
  BALL_R, BRICK_GAP, CELL_H, CELL_W, EXTRA_BALL_SECONDS, FIELD_W, GRID_LEFT, GRID_TOP, PADDLE_H, PADDLE_TOP, PADDLE_W, START_SPEED, TRAY_START,
} from './config';

/** serve: a ball waits on the paddle; play: balls fly; won: no bricks left; over: the tray is empty. */
export type Phase = 'serve' | 'play' | 'won' | 'over';

export type GameEvent = 'serve' | 'launch' | 'wall' | 'paddle' | 'brick' | 'drain' | 'lost' | 'extra' | 'won' | 'over';

export interface Brick { x0: number; y0: number; x1: number; y1: number; color: number; hits: number }
export interface Ball { x: number; y: number; vx: number; vy: number; r: number; prevX: number; prevY: number }
export interface Paddle { x: number; w: number; top: number; h: number; vx: number; prevX: number }

export interface Game {
  phase: Phase;
  /** Balls left, the one in play included. Losing the last ball on the field takes one; the game ends at zero. */
  tray: number;
  score: number;
  /** Bricks broken since a ball last touched the paddle. */
  combo: number;
  speed: number;
  bricks: Brick[];
  bricksLeft: number;
  /** Balls on the field: one while serving, up to FIELD_BALLS_MAX in multiball. */
  balls: Ball[];
  paddle: Paddle;
  /** Seconds the current ball has been in play, for the extra ball. */
  ballTime: number;
  nextExtraAt: number;
  /** What happened during the last steps, for sound, effects and saving. The reader empties it. */
  events: GameEvent[];
}

export function brickFromSpec(col: number, row: number, color: number, hits: number): Brick {
  const x0 = GRID_LEFT + col * CELL_W + BRICK_GAP / 2, y0 = GRID_TOP + row * CELL_H + BRICK_GAP / 2;
  return { x0, y0, x1: x0 + CELL_W - BRICK_GAP, y1: y0 + CELL_H - BRICK_GAP, color, hits };
}

export function newBall(x: number, y: number): Ball {
  return { x, y, vx: 0, vy: 0, r: BALL_R, prevX: x, prevY: y };
}

export function createGame(level: Level, tray = TRAY_START): Game {
  const bricks = level.bricks.map((b) => brickFromSpec(b.col, b.row, b.color, b.hits));
  const paddle: Paddle = { x: FIELD_W / 2, w: PADDLE_W, top: PADDLE_TOP, h: PADDLE_H, vx: 0, prevX: FIELD_W / 2 };
  return {
    phase: 'serve', tray, score: 0, combo: 0, speed: START_SPEED, bricks, bricksLeft: bricks.length,
    balls: [newBall(paddle.x, PADDLE_TOP - BALL_R)], paddle, ballTime: 0, nextExtraAt: EXTRA_BALL_SECONDS, events: [],
  };
}
