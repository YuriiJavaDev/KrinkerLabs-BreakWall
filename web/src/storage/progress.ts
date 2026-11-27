// What a player has reached: stars and the best result of each cleared level. Kept apart from saved games, so it is never lost.
import { KeyValueStore, readJson, writeJson } from './kv';

export interface Progress { stars: Record<string, number>; best: Record<string, number> }

const ID = /^[1-3]-[1-8]$/;
const keyFor = (player: string) => 'progress:' + (player || '-');

export const emptyProgress = (): Progress => ({ stars: {}, best: {} });

/** Only well-formed entries survive: storage can hold anything. */
export function cleanProgress(raw: unknown): Progress {
  const p = emptyProgress(), d = raw as Partial<Progress> | null;
  if (!d || typeof d !== 'object') return p;
  for (const [id, n] of Object.entries(d.stars ?? {})) if (ID.test(id) && Number.isInteger(n) && n >= 1 && n <= 3) p.stars[id] = n;
  for (const [id, n] of Object.entries(d.best ?? {})) if (ID.test(id) && Number.isFinite(n) && n >= 0) p.best[id] = Math.floor(n);
  return p;
}

export const loadProgress = (store: KeyValueStore | null, player: string) => cleanProgress(readJson(store, keyFor(player)));
export const storeProgress = (store: KeyValueStore | null, player: string, p: Progress) => writeJson(store, keyFor(player), p);

/** A cleared level keeps its best stars and its best result; returns true when either improved. */
export function recordLevel(p: Progress, id: string, stars: number, result: number): boolean {
  let better = false;
  if ((p.stars[id] ?? 0) < stars) { p.stars[id] = stars; better = true; }
  if ((p.best[id] ?? -1) < result) { p.best[id] = result; better = true; }
  return better;
}

export const isCleared = (p: Progress, id: string) => (p.stars[id] ?? 0) > 0;
export const totalStars = (p: Progress) => Object.values(p.stars).reduce((a, b) => a + b, 0);

/** The first level is always open; any other level opens when the one before it is cleared (or it was cleared itself). */
export function isOpen(p: Progress, ids: readonly string[], index: number): boolean {
  if (index === 0) return true;
  return isCleared(p, ids[index]) || isCleared(p, ids[index - 1]);
}
