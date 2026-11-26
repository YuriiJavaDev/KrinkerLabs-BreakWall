// Small settings kept in the browser. Storage can be missing or refused (private mode, strict settings); the game works without it.

const PREFIX = 'krinkerlabs.breakwall.';

export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function readFlag(store: KeyValueStore | null, name: string, fallback: boolean): boolean {
  try {
    const value = store?.getItem(PREFIX + name);
    return value === null || value === undefined ? fallback : value === '1';
  } catch { return fallback; }
}

export function writeFlag(store: KeyValueStore | null, name: string, value: boolean) {
  try { store?.setItem(PREFIX + name, value ? '1' : '0'); } catch { /* nothing to keep it in: the setting lasts until the page closes */ }
}

/** window.localStorage, or null where even reading the property throws. */
export function browserStore(): KeyValueStore | null {
  try { return window.localStorage; } catch { return null; }
}
