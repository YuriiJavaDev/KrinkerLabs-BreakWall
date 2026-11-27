// A brick's shape and place: making it from a level cell, moving it, and the shapes of a brick that changes on each hit.
import { BrickSpec } from '../levels/level';
import { bbox, centre, clockwise, Poly } from '../levels/shapes';
import type { Brick } from './state';

/**
 * The shapes of a brick that gets smaller and simpler with each hit, all inside the original bounds so it never grows
 * into a neighbour: the original, a diamond, a triangle, a small triangle.
 */
export function morphStages(base: Poly, count: number): Poly[] {
  const b = bbox(base), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, hw = (b.x1 - b.x0) / 2, hh = (b.y1 - b.y0) / 2;
  const diamond = [cx, cy - hh * 0.9, cx + hw * 0.8, cy, cx, cy + hh * 0.9, cx - hw * 0.8, cy];
  const triangle = (k: number) => [cx, cy - hh * 0.8 * k, cx + hw * 0.62 * k, cy + hh * 0.62 * k, cx - hw * 0.62 * k, cy + hh * 0.62 * k];
  return [base, diamond, triangle(1), triangle(0.7)].slice(0, Math.max(1, count)).map(clockwise);
}

export function makeBrick(spec: BrickSpec): Brick {
  const shapes = spec.kind === 'morph' ? morphStages(spec.poly, spec.hits) : [spec.poly];
  const brick: Brick = {
    kind: spec.kind, hits: spec.hits, maxHits: spec.hits, color: spec.color, bonus: spec.bonus, weak: spec.weak,
    shapes, stage: 0, poly: [...shapes[0]], x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0,
    ox: 0, oy: 0, vx: 0, move: spec.move, regenAt: 0, flash: 0, version: 0,
  };
  placeBrick(brick);
  return brick;
}

/** Writes the current shape at the current offsets into `poly` and updates the bounds and centre. Allocates only when the shape changes size. */
export function placeBrick(b: Brick) {
  const shape = b.shapes[b.stage];
  if (b.poly.length !== shape.length) b.poly = new Array<number>(shape.length);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < shape.length; i += 2) {
    const x = shape[i] + b.ox, y = shape[i + 1] + b.oy;
    b.poly[i] = x; b.poly[i + 1] = y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  b.x0 = x0; b.y0 = y0; b.x1 = x1; b.y1 = y1;
  const [cx, cy] = centre(b.poly);
  b.cx = cx; b.cy = cy;
}

/** A brick the ball can meet: not broken (a regrowing brick that is away does not count). */
export const isSolid = (b: Brick) => b.hits > 0;

/** A brick that has to break for the level to be cleared. */
export const counts = (b: Brick) => b.kind !== 'steel';
