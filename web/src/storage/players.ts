// Who plays in this browser: the current nickname, the last few used, and the autosave choice.
import { cleanName } from '../scores/names';
import { KeyValueStore, readFlag, readJson, readText, writeFlag, writeJson, writeText } from './kv';

const RECENT_MAX = 8;

export const loadPlayer = (store: KeyValueStore | null) => cleanName(readText(store, 'player') ?? '');

export function recentPlayers(store: KeyValueStore | null): string[] {
  const raw = readJson(store, 'recent');
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && !!cleanName(x)).slice(0, RECENT_MAX) : [];
}

/** Keeps the name as the current player and first in the recent list. An empty name clears the current player. */
export function rememberPlayer(store: KeyValueStore | null, raw: string): string {
  const name = cleanName(raw);
  writeText(store, 'player', name || null);
  if (name) writeJson(store, 'recent', [name, ...recentPlayers(store).filter((x) => x !== name)].slice(0, RECENT_MAX));
  return name;
}

export const loadAutosave = (store: KeyValueStore | null) => readFlag(store, 'autosave', true);
export const storeAutosave = (store: KeyValueStore | null, on: boolean) => writeFlag(store, 'autosave', on);
