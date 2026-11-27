// The three tiers of the game. Each has its own world (look and sound) and its own difficulty.
// Difficulty comes from the size of the paddle and ball, the speed, how often an extra ball comes, and the points multiplier.
import { Text2 } from './level';

export type WorldId = 'lab' | 'neon' | 'reactor';

export interface Tier {
  tier: number;
  world: WorldId;
  name: Text2;
  worldName: Text2;
  paddle: number;
  ball: number;
  startSpeed: number;
  maxSpeed: number;
  extraBallSeconds: number;
  multiplier: number;
}

export const LEVELS_PER_TIER = 8;

export const TIERS: readonly Tier[] = [
  { tier: 1, world: 'lab', name: { en: 'Beginner', ru: 'Новичок' }, worldName: { en: 'Laboratory', ru: 'Лаборатория' },
    paddle: 248, ball: 18, startSpeed: 620, maxSpeed: 1100, extraBallSeconds: 60, multiplier: 1 },
  { tier: 2, world: 'neon', name: { en: 'Skilled', ru: 'Опытный' }, worldName: { en: 'Neon City', ru: 'Неоновый город' },
    paddle: 210, ball: 16, startSpeed: 700, maxSpeed: 1300, extraBallSeconds: 75, multiplier: 1.5 },
  { tier: 3, world: 'reactor', name: { en: 'Pro', ru: 'Профи' }, worldName: { en: 'Reactor', ru: 'Реактор' },
    paddle: 176, ball: 14, startSpeed: 780, maxSpeed: 1450, extraBallSeconds: 90, multiplier: 2 },
];

export const tierOf = (n: number): Tier => TIERS[Math.min(TIERS.length, Math.max(1, n)) - 1];
