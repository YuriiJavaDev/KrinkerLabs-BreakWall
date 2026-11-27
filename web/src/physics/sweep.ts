// Continuous collision of a moving ball (a circle) with walls, polygons and circles.
// A move is the straight segment p → p + d; t is the part of that move (0..1) at the moment of contact.
// Checking the whole segment, not only the end point, is what keeps a fast ball from passing through a thin brick.

export interface Hit { t: number; nx: number; ny: number }

export const newHit = (): Hit => ({ t: Infinity, nx: 0, ny: 0 });

const EPS = 1e-9;

/**
 * First contact of a circle of radius r moving by (dx, dy) from (px, py) with a convex polygon
 * (points clockwise on a y-down screen, as a flat array). Faces and corners are both checked;
 * the outward normal at the contact is written into `out`. A ball that is already moving away does not hit.
 */
export function sweepCirclePoly(px: number, py: number, dx: number, dy: number, r: number, poly: ArrayLike<number>, out: Hit): boolean {
  let bestT = Infinity, bestX = 0, bestY = 0;
  const n = poly.length;
  for (let i = 0; i < n; i += 2) {
    const ax = poly[i], ay = poly[i + 1], bx = poly[(i + 2) % n], by = poly[(i + 3) % n];
    const ex = bx - ax, ey = by - ay, len = Math.hypot(ex, ey);
    if (len === 0) continue;
    const nx = ey / len, ny = -ex / len;
    const toward = dx * nx + dy * ny;
    if (toward >= 0) continue;
    const t = ((px - ax) * nx + (py - ay) * ny - r) / -toward;
    if (t < -EPS || t > 1 || t >= bestT) continue;
    const qx = px + dx * t - ax, qy = py + dy * t - ay, along = (qx * ex + qy * ey) / (len * len);
    if (along < 0 || along > 1) continue;
    bestT = t; bestX = nx; bestY = ny;
  }
  for (let i = 0; i < n; i += 2) {
    if (sweepCirclePoint(px, py, dx, dy, r, poly[i], poly[i + 1], probe) && probe.t < bestT) { bestT = probe.t; bestX = probe.nx; bestY = probe.ny; }
  }
  if (bestT === Infinity) return false;
  out.t = Math.max(0, bestT); out.nx = bestX; out.ny = bestY;
  return true;
}

const probe: Hit = newHit();

/** The box [x0, x1] × [y0, y1] as a polygon: kept for walls and for checks. */
export function sweepCircleBox(px: number, py: number, dx: number, dy: number, r: number,
  x0: number, y0: number, x1: number, y1: number, out: Hit): boolean {
  box[0] = x0; box[1] = y0; box[2] = x1; box[3] = y0; box[4] = x1; box[5] = y1; box[6] = x0; box[7] = y1;
  return sweepCirclePoly(px, py, dx, dy, r, box, out);
}
const box = new Float64Array(8);

/**
 * Contact of a circle of radius r with a point, or with a round bumper when r is the sum of both radii:
 * the centre path against a circle of radius r around (cx, cy).
 */
export function sweepCirclePoint(px: number, py: number, dx: number, dy: number, r: number, cx: number, cy: number, out: Hit): boolean {
  const ox = px - cx, oy = py - cy;
  const a = dx * dx + dy * dy, b = 2 * (ox * dx + oy * dy), c = ox * ox + oy * oy - r * r;
  const disc = b * b - 4 * a * c;
  if (a === 0 || disc < 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < -EPS || t > 1) return false;
  const nx = (ox + dx * t) / r, ny = (oy + dy * t) / r;
  if (dx * nx + dy * ny >= 0) return false;
  out.t = Math.max(0, t); out.nx = nx; out.ny = ny;
  return true;
}

/** Mirror the velocity in the surface with unit normal (nx, ny). */
export function reflect(v: { vx: number; vy: number }, nx: number, ny: number) {
  const dot = v.vx * nx + v.vy * ny;
  v.vx -= 2 * dot * nx; v.vy -= 2 * dot * ny;
}

/** Turn a velocity by an angle (radians), keeping its speed. */
export function turn(v: { vx: number; vy: number }, angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle), x = v.vx;
  v.vx = x * c - v.vy * s; v.vy = x * s + v.vy * c;
}
