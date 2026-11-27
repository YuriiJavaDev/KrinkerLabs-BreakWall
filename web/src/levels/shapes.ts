// Convex polygons as flat arrays [x0, y0, x1, y1, ...], points in clockwise order on screen (y down).

export type Poly = number[];

export interface Box { x0: number; y0: number; x1: number; y1: number }

export function bbox(p: Poly): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
    y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
  }
  return { x0, y0, x1, y1 };
}

/** The average of the corners: inside any convex polygon. */
export function centre(p: Poly): [number, number] {
  let x = 0, y = 0;
  const n = p.length / 2;
  for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; }
  return [x / n, y / n];
}

/** Twice the signed area; positive for clockwise order on a y-down screen. */
export function area2(p: Poly): number {
  let a = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    a += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return a;
}

/** The same polygon, points listed clockwise (y down), whatever order it came in. */
export const clockwise = (p: Poly): Poly => (area2(p) >= 0 ? p : reversePoints(p));

function reversePoints(p: Poly): Poly {
  const out: Poly = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
}

/** Shrinks a polygon towards its centre by `k` (0..1). Used to leave a gap between neighbouring bricks. */
export function scaled(p: Poly, k: number): Poly {
  const [cx, cy] = centre(p);
  return p.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * k : cy + (v - cy) * k));
}

/**
 * Moves every edge of a convex polygon (clockwise, y down) inwards by `d`: the same shape with an even border taken off.
 * This is how the gap between bricks is made, so long and short bricks get the same gap.
 */
export function inset(p: Poly, d: number): Poly {
  const n = p.length / 2, lines: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const ax = p[2 * i], ay = p[2 * i + 1], bx = p[(2 * i + 2) % p.length], by = p[(2 * i + 3) % p.length];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    // inward normal of a clockwise edge on a y-down screen
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    lines.push([nx, ny, nx * ax + ny * ay + d]);
  }
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const [a1, b1, c1] = lines[(i + n - 1) % n], [a2, b2, c2] = lines[i];
    const det = a1 * b2 - a2 * b1;
    out.push((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det);
  }
  return out;
}

export const moved = (p: Poly, dx: number, dy: number): Poly => p.map((v, i) => v + (i % 2 === 0 ? dx : dy));

/** A regular polygon with `n` corners around (cx, cy), `r` from the centre to a corner, the first corner at `angle` (radians, 0 = right). */
export function regular(n: number, cx: number, cy: number, r: number, angle = -Math.PI / 2): Poly {
  const p: Poly = [];
  for (let i = 0; i < n; i++) {
    const a = angle + (i * 2 * Math.PI) / n;
    p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return clockwise(p);
}

/** True when the point lies inside the convex polygon (clockwise, y down) or on its edge. */
export function contains(p: Poly, x: number, y: number): boolean {
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    const ex = p[j] - p[i], ey = p[j + 1] - p[i + 1];
    if (ex * (y - p[i + 1]) - ey * (x - p[i]) < -1e-9) return false;
  }
  return true;
}

/** Distance from a point to the polygon: 0 inside, otherwise to the nearest edge. */
export function distanceTo(p: Poly, x: number, y: number): number {
  if (contains(p, x, y)) return 0;
  let best = Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    best = Math.min(best, segmentDistance(x, y, p[i], p[i + 1], p[j], p[j + 1]));
  }
  return best;
}

export function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / len2));
  return Math.hypot(x - (ax + ex * t), y - (ay + ey * t));
}

/** Two convex polygons overlap (separating axis test); touching edges do not count. */
export function overlaps(a: Poly, b: Poly): boolean {
  return !hasSeparatingAxis(a, b) && !hasSeparatingAxis(b, a);
}

function hasSeparatingAxis(a: Poly, b: Poly): boolean {
  for (let i = 0; i < a.length; i += 2) {
    const j = (i + 2) % a.length;
    const nx = a[j + 1] - a[i + 1], ny = a[i] - a[j];
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (let k = 0; k < a.length; k += 2) { const d = a[k] * nx + a[k + 1] * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
    for (let k = 0; k < b.length; k += 2) { const d = b[k] * nx + b[k + 1] * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
    const scale = Math.hypot(nx, ny) || 1;
    if (aMax - bMin <= 1e-6 * scale || bMax - aMin <= 1e-6 * scale) return true;
  }
  return false;
}
