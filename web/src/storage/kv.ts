// Small values kept in the browser. Storage can be missing or refused (private mode, strict settings); the game works without it.

const PREFIX = 'krinkerlabs.breakwall.';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readText(store: KeyValueStore | null, name: string): string | null {
  try { return store?.getItem(PREFIX + name) ?? null; } catch { return null; }
}

/** Returns false when the value could not be kept (no storage, full or refused). */
export function writeText(store: KeyValueStore | null, name: string, value: string | null): boolean {
  if (!store) return false;
  try { value === null ? store.removeItem(PREFIX + name) : store.setItem(PREFIX + name, value); return true; } catch { return false; }
}

export function readJson(store: KeyValueStore | null, name: string): unknown {
  const text = readText(store, name);
  if (text === null) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export const writeJson = (store: KeyValueStore | null, name: string, value: unknown) => writeText(store, name, JSON.stringify(value));

export function readFlag(store: KeyValueStore | null, name: string, fallback: boolean): boolean {
  const value = readText(store, name);
  return value === null ? fallback : value === '1';
}

export const writeFlag = (store: KeyValueStore | null, name: string, value: boolean) => writeText(store, name, value ? '1' : '0');

/** window.localStorage, or null where even reading the property throws. */
export function browserStore(): KeyValueStore | null {
  try { return window.localStorage; } catch { return null; }
}

/** A store in memory, for tests and for browsers that refuse storage. */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
}
