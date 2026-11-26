// The top 10 of this browser. A shared online board comes later, with the same rows.
import { KeyValueStore, readJson, writeJson } from '../storage/kv';
import { cleanName } from './names';

export interface Entry { name: string; score: number }
export const TOP = 10;
const KEY = 'top10';

/** One row per player: the best result under a name stays, a lower one changes nothing. Best first, at most TOP rows. */
export function mergeScore(rows: readonly Entry[], name: string, score: number): Entry[] {
  const clean = cleanName(name);
  if (!clean || !(score > 0)) return [...rows];
  const own = rows.find((e) => e.name === clean);
  if (own && own.score >= score) return [...rows];
  return rows.filter((e) => e !== own).concat([{ name: clean, score: Math.floor(score) }]).sort((a, b) => b.score - a.score).slice(0, TOP);
}

/** Only well-formed rows survive: storage can hold anything. */
export function cleanEntries(raw: unknown): Entry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e.name === 'string' && cleanName(e.name) && Number.isFinite(e.score) && e.score > 0)
    .map((e) => ({ name: cleanName(e.name), score: Math.floor(e.score) })).sort((a, b) => b.score - a.score).slice(0, TOP);
}

export const loadTop = (store: KeyValueStore | null) => cleanEntries(readJson(store, KEY));

export function addToTop(store: KeyValueStore | null, name: string, score: number): Entry[] {
  const rows = mergeScore(loadTop(store), name, score);
  writeJson(store, KEY, rows);
  return rows;
}
