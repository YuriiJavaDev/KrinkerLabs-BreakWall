// Where the cells of a block of bricks lie, for each kind of grid. A block is centred across the field;
// `top` is the y of its first row. Every cell is a convex polygon, shrunk a little to leave a gap between bricks.
import { FIELD_W } from '../rules/config';
import { inset, moved, Poly } from './shapes';

export type GridKind = 'rect' | 'hex' | 'tri' | 'rhomb' | 'para';
export const GRID_KINDS: readonly GridKind[] = ['rect', 'hex', 'tri', 'rhomb', 'para'];

/** Gap between neighbouring bricks, in field units. */
export const BRICK_GAP = 6;

export interface GridSpec {
  grid: GridKind;
  /** rect, rhomb: [width, height]; hex: [width across the flat sides]; tri: [side]; para: [width, height, skew]. */
  cell: number[];
  top: number;
  cols: number;
  rows: number;
}

const SQRT3 = Math.sqrt(3);

/** Height of one row step of the grid, used for the creeping wall and for checks. */
export function rowStep(spec: Pick<GridSpec, 'grid' | 'cell'>): number {
  const [a, b] = spec.cell;
  switch (spec.grid) {
    case 'rect': case 'para': return b;
    case 'hex': return (a / SQRT3) * 1.5;
    case 'tri': return (a * SQRT3) / 2;
    case 'rhomb': return b / 2;
  }
}

/** Width of the whole block, for centring. */
export function blockWidth(spec: Pick<GridSpec, 'grid' | 'cell' | 'cols' | 'rows'>): number {
  const [a, , c] = spec.cell;
  const staggered = spec.rows > 1;
  switch (spec.grid) {
    case 'rect': return spec.cols * a;
    case 'para': return spec.cols * a + c;
    case 'hex': case 'rhomb': return spec.cols * a + (staggered ? a / 2 : 0);
    case 'tri': return ((spec.cols + 1) * a) / 2;
  }
}

/** The polygon of the cell in column `col`, row `row`, before the gap is taken off, with the block's left edge at x = 0. */
function rawCell(spec: GridSpec, col: number, row: number): Poly {
  const [a, b, c] = spec.cell;
  switch (spec.grid) {
    case 'rect': {
      const x = col * a, y = row * b;
      return [x, y, x + a, y, x + a, y + b, x, y + b];
    }
    case 'para': {
      const x = col * a, y = row * b;
      return [x + c, y, x + a + c, y, x + a, y + b, x, y + b];
    }
    case 'hex': {
      // pointy-top hexagons; odd rows shift half a cell to the right
      const r = a / SQRT3, cx = col * a + a / 2 + (row % 2 ? a / 2 : 0), cy = row * r * 1.5 + r;
      const p: Poly = [];
      for (let i = 0; i < 6; i++) { const ang = -Math.PI / 2 + (i * Math.PI) / 3; p.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); }
      return p;
    }
    case 'tri': {
      // equilateral triangles, point up and point down in turn, like a mosaic
      const h = (a * SQRT3) / 2, x = (col * a) / 2, y = row * h;
      return (col + row) % 2 === 0 ? [x + a / 2, y, x + a, y + h, x, y + h] : [x, y, x + a, y, x + a / 2, y + h];
    }
    case 'rhomb': {
      // diamonds; odd rows sit between the diamonds of the row above
      const cx = col * a + a / 2 + (row % 2 ? a / 2 : 0), cy = (row * b) / 2 + b / 2;
      return [cx, cy - b / 2, cx + a / 2, cy, cx, cy + b / 2, cx - a / 2, cy];
    }
  }
}

/** The polygon of a cell in field coordinates, with half the gap taken off every edge. */
export function cellPolygon(spec: GridSpec, col: number, row: number): Poly {
  const left = (FIELD_W - blockWidth(spec)) / 2;
  return inset(moved(rawCell(spec, col, row), left, spec.top), BRICK_GAP / 2);
}
