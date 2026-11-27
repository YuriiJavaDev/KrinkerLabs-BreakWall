// All levels of the game in order: 1-1 … 1-8, 2-1 … 2-8, 3-1 … 3-8.
import tier1 from '../../data/levels-1.json';
import tier2 from '../../data/levels-2.json';
import tier3 from '../../data/levels-3.json';
import { Level, parseLevel } from './level';
import { LEVELS_PER_TIER, Tier, tierOf } from './tiers';

export const LEVELS: readonly Level[] = [...tier1, ...tier2, ...tier3].map(parseLevel);

export const levelCount = () => LEVELS.length;
export const levelAt = (index: number): Level => LEVELS[Math.min(LEVELS.length - 1, Math.max(0, index))];
export const indexOf = (id: string) => LEVELS.findIndex((l) => l.id === id);
export const tierFor = (index: number): Tier => tierOf(levelAt(index).tier);
/** The first level of the tier the level belongs to: where a run starts again after the game is over. */
export const tierStart = (index: number) => Math.floor(index / LEVELS_PER_TIER) * LEVELS_PER_TIER;
export const isTierStart = (index: number) => index % LEVELS_PER_TIER === 0;
export const isTierEnd = (index: number) => index % LEVELS_PER_TIER === LEVELS_PER_TIER - 1;
export const isLast = (index: number) => index === LEVELS.length - 1;
