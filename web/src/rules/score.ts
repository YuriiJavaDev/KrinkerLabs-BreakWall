import { BALL_LEFT_POINTS, BONUS_BRICK_POINTS, BRICK_POINTS, COMBO_CAP, SECOND_POINTS } from './config';

/**
 * Points for a broken brick: 1 000 for each point of its strength, times its place in a run of bricks broken without
 * touching the paddle (1, 2, 3 … up to 10), plus 2 000 for a brick with a bonus, all times the tier's multiplier.
 * A brick broken by a blast gives half, without the run.
 */
export function brickPoints(comboIndex: number, strength: number, multiplier: number, withBonus = false, byBlast = false): number {
  const run = byBlast ? 0.5 : Math.min(Math.max(1, comboIndex), COMBO_CAP);
  return Math.round((BRICK_POINTS * strength * run + (withBonus ? BONUS_BRICK_POINTS : 0)) * multiplier);
}

/** Stars for a cleared level: one for clearing it, two when at most one ball was lost, three with no loss and within the par time. */
export function levelStars(lost: number, seconds: number, par: number): number {
  if (lost === 0 && seconds <= par) return 3;
  return lost <= 1 ? 2 : 1;
}

/** The bonus at the end of a level: seconds left under the par time and the balls left in the tray, times the multiplier. */
export function levelBonus(seconds: number, par: number, tray: number, multiplier: number) {
  const timeBonus = Math.round(Math.max(0, Math.floor(par - seconds)) * SECOND_POINTS * multiplier);
  const ballsBonus = Math.round(tray * BALL_LEFT_POINTS * multiplier);
  return { timeBonus, ballsBonus };
}
