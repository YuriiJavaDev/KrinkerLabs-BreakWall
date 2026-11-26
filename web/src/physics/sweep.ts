// Continuous collision of a moving ball (a circle) with walls and boxes.
// A move is the straight segment p → p + d; t is the part of that move (0..1) at the moment of contact.
// Checking the whole segment, not only the end point, is what keeps a fast ball from passing through a thin brick.

export interface Hit { t: number; nx: number; ny: number }

export const newHit = (): Hit => ({ t: Infinity, nx: 0, ny: 0 });

const EPS = 1e-9;

/**
 * First contact of a circle of radius r moving by (dx, dy) from (px, py) with the box [x0, x1] × [y0, y1].
 * Writes the time and the outward normal of the contact into `out`. A ball that is already moving away does not hit.
 */
export function sweepCircleBox(px: number, py: number, dx: number, dy: number, r: number,
  x0: number, y0: number, x1: number, y1: number, out: Hit): boolean {
  // The circle touches the box exactly when its centre touches the box grown by r with rounded corners.
  let enter = -Infinity, exit = Infinity, nx = 0, ny = 0;
  if (dx === 0) { if (px < x0 - r || px > x1 + r) return false; } else {
    const a = (x0 - r - px) / dx, b = (x1 + r - px) / dx;
    const tIn = Math.min(a, b), tOut = Math.max(a, b);
    if (tIn > enter) { enter = tIn; nx = dx > 0 ? -1 : 1; ny = 0; }
    exit = Math.min(exit, tOut);
  }
  if (dy === 0) { if (py < y0 - r || py > y1 + r) return false; } else {
    const a = (y0 - r - py) / dy, b = (y1 + r - py) / dy;
    const tIn = Math.min(a, b), tOut = Math.max(a, b);
    if (tIn > enter) { enter = tIn; nx = 0; ny = dy > 0 ? -1 : 1; }
    exit = Math.min(exit, tOut);
  }
  if (enter > exit || enter > 1 || enter < -EPS) return false;

  const qx = px + dx * enter, qy = py + dy * enter;
  const cx = qx < x0 ? x0 : qx > x1 ? x1 : NaN, cy = qy < y0 ? y0 : qy > y1 ? y1 : NaN;
  if (!Number.isNaN(cx) && !Number.isNaN(cy)) return sweepCircleCorner(px, py, dx, dy, r, cx, cy, out);
  return accept(enter, nx, ny, dx, dy, out);
}

/** Contact with one corner point of a box: the centre path against a circle of radius r around the corner. */
function sweepCircleCorner(px: number, py: number, dx: number, dy: number, r: number, cx: number, cy: number, out: Hit): boolean {
  const ox = px - cx, oy = py - cy;
  const a = dx * dx + dy * dy, b = 2 * (ox * dx + oy * dy), c = ox * ox + oy * oy - r * r;
  const disc = b * b - 4 * a * c;
  if (a === 0 || disc < 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < -EPS || t > 1) return false;
  return accept(t, (ox + dx * t) / r, (oy + dy * t) / r, dx, dy, out);
}

function accept(t: number, nx: number, ny: number, dx: number, dy: number, out: Hit): boolean {
  if (dx * nx + dy * ny >= 0) return false;
  out.t = Math.max(0, t); out.nx = nx; out.ny = ny;
  return true;
}

/** Mirror the velocity in the surface with unit normal (nx, ny). */
export function reflect(v: { vx: number; vy: number }, nx: number, ny: number) {
  const dot = v.vx * nx + v.vy * ny;
  v.vx -= 2 * dot * nx; v.vy -= 2 * dot * ny;
}
