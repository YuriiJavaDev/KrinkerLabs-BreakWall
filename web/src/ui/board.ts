import { Entry, TOP } from '../scores/top10';

export interface BoardRow { name: string; score: string; me: boolean; vacant: boolean }

/** Always TOP rows: the players first, then empty places, so the panel keeps its size. */
export function boardRows(entries: readonly Entry[], me: string, format: (n: number) => string): BoardRow[] {
  return Array.from({ length: TOP }, (_, i) => {
    const e = entries[i];
    return e ? { name: e.name, score: format(e.score), me: !!me && e.name === me, vacant: false } : { name: '—', score: '', me: false, vacant: true };
  });
}

/** Fills the list. Names are other people's text, so they go in as text, never as markup. */
export function renderBoard(list: HTMLElement, rows: readonly BoardRow[]) {
  list.replaceChildren(...rows.map((row) => {
    const li = document.createElement('li'), name = document.createElement('span'), score = document.createElement('b');
    name.textContent = row.name; score.textContent = row.score;
    li.classList.toggle('me', row.me); li.classList.toggle('vacant', row.vacant);
    li.append(name, score);
    return li;
  }));
}
