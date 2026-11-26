import { MAX_BOUNCE_ANGLE, MAX_FLIGHT_ANGLE, PADDLE_MAX_SPEED, SPIN_ANGLE } from '../rules/config';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Angle from straight up after a paddle hit. `offset` is where the ball met the paddle: -1 left edge, 0 centre, 1 right edge.
 * A paddle moving at the moment of the hit adds a little spin in its direction.
 */
export function bounceAngle(offset: number, paddleVx: number): number {
  const spin = clamp(paddleVx / PADDLE_MAX_SPEED, -1, 1) * SPIN_ANGLE;
  return clamp(clamp(offset, -1, 1) * MAX_BOUNCE_ANGLE + spin, -MAX_BOUNCE_ANGLE, MAX_BOUNCE_ANGLE);
}

/** Sets the velocity to `speed` along `angle` from straight up. */
export function aim(v: { vx: number; vy: number }, angle: number, speed: number) {
  v.vx = Math.sin(angle) * speed;
  v.vy = -Math.cos(angle) * speed;
}

/** Keeps the flight at least as steep as MAX_FLIGHT_ANGLE allows, at the same speed and in the same quarter. */
export function keepSteep(v: { vx: number; vy: number }) {
  const speed = Math.hypot(v.vx, v.vy), minVy = speed * Math.cos(MAX_FLIGHT_ANGLE);
  if (speed === 0 || Math.abs(v.vy) >= minVy) return;
  v.vy = (v.vy < 0 ? -1 : 1) * minVy;
  v.vx = (v.vx < 0 ? -1 : 1) * Math.sqrt(speed * speed - minVy * minVy);
}
