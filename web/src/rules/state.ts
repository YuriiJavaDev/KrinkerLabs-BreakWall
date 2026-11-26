import { Level } from '../levels/level';
import {
  BALL_R, BRICK_GAP, CELL_H, CELL_W, FIELD_W, GRID_LEFT, GRID_TOP, LIVES, PADDLE_H, PADDLE_TOP, PADDLE_W, START_SPEED,
} from './config';

/** serve: the ball waits on the paddle; play: it flies; won: no bricks left; over: no lives left. */
export type Phase = 'serve' | 'play' | 'won' | 'over';

export type GameEvent = 'launch' | 'wall' | 'paddle' | 'brick' | 'lost' | 'won' | 'over';

export interface Brick { x0: number; y0: number; x1: number; y1: number; color: number; hits: number }
export interface Ball { x: number; y: number; vx: number; vy: number; r: number; prevX: number; prevY: number }
export interface Paddle { x: number; w: number; top: number; h: number; vx: number; prevX: number }

export interface Game {
  phase: Phase;
  lives: number;
  score: number;
  /** Bricks broken since the ball last touched the paddle. */
  combo: number;
  speed: number;
  bricks: Brick[];
  bricksLeft: number;
  ball: Ball;
  paddle: Paddle;
  /** What happened during the last steps, for sound and effects. The reader empties it. */
  events: GameEvent[];
}

export function brickFromSpec(col: number, row: number, color: number, hits: number): Brick {
  const x0 = GRID_LEFT + col * CELL_W + BRICK_GAP / 2, y0 = GRID_TOP + row * CELL_H + BRICK_GAP / 2;
  return { x0, y0, x1: x0 + CELL_W - BRICK_GAP, y1: y0 + CELL_H - BRICK_GAP, color, hits };
}

export function createGame(level: Level): Game {
  const bricks = level.bricks.map((b) => brickFromSpec(b.col, b.row, b.color, b.hits));
  const paddle: Paddle = { x: FIELD_W / 2, w: PADDLE_W, top: PADDLE_TOP, h: PADDLE_H, vx: 0, prevX: FIELD_W / 2 };
  const ball: Ball = { x: paddle.x, y: PADDLE_TOP - BALL_R, vx: 0, vy: 0, r: BALL_R, prevX: paddle.x, prevY: PADDLE_TOP - BALL_R };
  return { phase: 'serve', lives: LIVES, score: 0, combo: 0, speed: START_SPEED, bricks, bricksLeft: bricks.length, ball, paddle, events: [] };
}
