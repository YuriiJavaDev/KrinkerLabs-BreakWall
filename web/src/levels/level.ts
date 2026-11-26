import { GRID_COLS, GRID_MAX_ROWS } from '../rules/config';

/**
 * A level as stored in JSON: one string per row of the grid, one character per cell.
 * "." is an empty cell, "a" to "h" an ordinary brick of colour 0 to 7.
 * Later stages add more characters (strong, unbreakable, explosive bricks) here, in one place.
 */
export interface LevelJson { name: string; rows: string[] }

export interface BrickSpec { col: number; row: number; color: number; hits: number }
export interface Level { name: string; bricks: BrickSpec[] }

const COLOURS = 'abcdefgh';

export class LevelError extends Error {}

export function parseLevel(json: unknown): Level {
  const data = json as Partial<LevelJson> | null;
  if (!data || typeof data.name !== 'string' || !data.name.trim()) throw new LevelError('a level needs a name');
  if (!Array.isArray(data.rows) || data.rows.length === 0) throw new LevelError('a level needs rows');
  if (data.rows.length > GRID_MAX_ROWS) throw new LevelError(`at most ${GRID_MAX_ROWS} rows, got ${data.rows.length}`);

  const bricks: BrickSpec[] = [];
  data.rows.forEach((line, row) => {
    if (typeof line !== 'string' || line.length !== GRID_COLS) throw new LevelError(`row ${row + 1} must have ${GRID_COLS} cells`);
    [...line].forEach((ch, col) => {
      if (ch === '.') return;
      const color = COLOURS.indexOf(ch);
      if (color < 0) throw new LevelError(`unknown cell "${ch}" in row ${row + 1}`);
      bricks.push({ col, row, color, hits: 1 });
    });
  });
  if (bricks.length === 0) throw new LevelError('a level needs at least one brick');
  return { name: data.name, bricks };
}
