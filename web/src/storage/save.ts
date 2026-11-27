// A saved game: what the player had at the start of the current ball. Never the middle of a ball's flight,
// so leaving and coming back cannot be used to save a ball that is about to fall.
import { placeBrick } from '../rules/bricks';
import { TRAY_MAX } from '../rules/config';
import { createGame, Game } from '../rules/state';
import { indexOf, levelAt, tierFor } from '../levels/catalog';
import { KeyValueStore, readJson, writeJson, writeText } from './kv';

export interface SaveData {
  v: 2;
  /** The level, as its id ("2-5"). */
  level: string;
  score: number;
  tray: number;
  /** A run that counts for the top 10 (it started at the first level of a tier, not in the review mode). */
  ranked: boolean;
  /** Strength left of every brick of the level, in the level's order. */
  hits: number[];
  /** How far the creeping wall has come down, and the time and balls lost on this level so far. */
  drop: number;
  time: number;
  lost: number;
  savedAt: number;
}

const isNum = (n: unknown, lo: number, hi: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const isInt = (n: unknown, lo: number, hi: number): n is number => isNum(n, lo, hi) && Number.isInteger(n);

/** The game as it stands; call it while a ball waits on the paddle. */
export function snapshot(g: Game, ranked: boolean, now = Date.now()): SaveData {
  return {
    v: 2, level: g.level.id, score: g.score, tray: g.tray, ranked, hits: g.bricks.map((b) => Math.max(0, b.hits)),
    drop: g.wall.drop, time: g.time, lost: g.lost, savedAt: now,
  };
}

/** Checks a save against the level it belongs to. Anything unexpected gives null, never a broken game. */
export function decode(raw: unknown): SaveData | null {
  const d = raw as Partial<SaveData> | null;
  if (!d || d.v !== 2 || typeof d.level !== 'string') return null;
  const index = indexOf(d.level);
  if (index < 0) return null;
  const level = levelAt(index);
  if (!isInt(d.score, 0, 1e12) || !isInt(d.tray, 1, TRAY_MAX) || !isInt(d.savedAt, 0, 1e15) || typeof d.ranked !== 'boolean') return null;
  if (!isNum(d.drop, 0, 2000) || !isNum(d.time, 0, 1e6) || !isInt(d.lost, 0, 1000)) return null;
  if (!Array.isArray(d.hits) || d.hits.length !== level.bricks.length) return null;
  if (!d.hits.every((h, i) => isInt(h, 0, level.bricks[i].hits))) return null;
  if (!d.hits.some((h, i) => h > 0 && level.bricks[i].kind !== 'steel')) return null;
  return { v: 2, level: d.level, score: d.score, tray: d.tray, ranked: d.ranked, hits: [...d.hits], drop: d.drop, time: d.time, lost: d.lost, savedAt: d.savedAt };
}

/** A game in the saved state, with a ball waiting on the paddle. */
export function restore(save: SaveData): Game {
  const index = indexOf(save.level);
  const g = createGame(levelAt(index), tierFor(index), { tray: save.tray, score: save.score });
  g.bricks.forEach((b, i) => {
    b.hits = save.hits[i];
    if (b.kind === 'morph' && b.hits > 0) b.stage = Math.min(b.shapes.length - 1, b.maxHits - b.hits);
    placeBrick(b);
  });
  g.bricksLeft = g.bricks.filter((b) => b.hits > 0 && b.kind !== 'steel').length;
  g.wall.drop = g.wall.target = save.drop;
  g.time = save.time;
  g.lost = save.lost;
  return g;
}

const keyFor = (player: string) => 'save:' + player;
export const readSave = (store: KeyValueStore | null, player: string) => (player ? decode(readJson(store, keyFor(player))) : null);
export const writeSave = (store: KeyValueStore | null, player: string, save: SaveData) => !!player && writeJson(store, keyFor(player), save);
export const clearSave = (store: KeyValueStore | null, player: string) => !!player && writeText(store, keyFor(player), null);
