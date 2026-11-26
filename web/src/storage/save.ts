// A saved game: what the player had at the start of the current ball. Never the middle of a ball's flight,
// so leaving and coming back cannot be used to save a ball that is about to fall.
import { Level } from '../levels/level';
import { TRAY_MAX } from '../rules/config';
import { createGame, Game } from '../rules/state';
import { KeyValueStore, readJson, writeJson, writeText } from './kv';

export interface SaveData { v: 1; level: number; score: number; tray: number; hits: number[]; savedAt: number }

const isInt = (n: unknown, lo: number, hi: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

/** The game as it stands; call it while a ball waits on the paddle. */
export function snapshot(g: Game, level: number, now = Date.now()): SaveData {
  return { v: 1, level, score: g.score, tray: g.tray, hits: g.bricks.map((b) => Math.max(0, b.hits)), savedAt: now };
}

/** Checks a save against the level it belongs to. Anything unexpected gives null, never a broken game. */
export function decode(raw: unknown, level: Level, levelIndex: number): SaveData | null {
  const d = raw as Partial<SaveData> | null;
  if (!d || d.v !== 1 || d.level !== levelIndex || !isInt(d.score, 0, 1e12) || !isInt(d.tray, 1, TRAY_MAX) || !isInt(d.savedAt, 0, 1e15)) return null;
  if (!Array.isArray(d.hits) || d.hits.length !== level.bricks.length) return null;
  if (!d.hits.every((h, i) => isInt(h, 0, level.bricks[i].hits))) return null;
  if (!d.hits.some((h) => h > 0)) return null;
  return { v: 1, level: d.level, score: d.score, tray: d.tray, hits: [...d.hits], savedAt: d.savedAt };
}

/** A new game in the saved state, with a ball waiting on the paddle. */
export function restore(level: Level, save: SaveData): Game {
  const g = createGame(level, save.tray);
  g.score = save.score;
  g.bricks.forEach((b, i) => { b.hits = save.hits[i]; });
  g.bricksLeft = g.bricks.filter((b) => b.hits > 0).length;
  return g;
}

const keyFor = (player: string) => 'save:' + player;
export const readSave = (store: KeyValueStore | null, player: string, level: Level, levelIndex: number) =>
  player ? decode(readJson(store, keyFor(player)), level, levelIndex) : null;
export const writeSave = (store: KeyValueStore | null, player: string, save: SaveData) => !!player && writeJson(store, keyFor(player), save);
export const clearSave = (store: KeyValueStore | null, player: string) => !!player && writeText(store, keyFor(player), null);
