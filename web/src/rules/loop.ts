/** The simulation runs at this fixed rate whatever the refresh rate of the screen. */
export const STEP_HZ = 120;
export const STEP_DT = 1 / STEP_HZ;
/** A longer frame (a hidden tab, a slow phone) is cut to this, so the game slows down instead of jumping. */
export const MAX_FRAME = 0.25;

/** Turns frame times into a whole number of fixed steps and tells how far the picture is between the last two steps. */
export class FixedStep {
  private stored = 0;

  /** Runs `tick` once per whole step in `frameSeconds` and returns the blend (0..1) for drawing between steps. */
  advance(frameSeconds: number, tick: () => void): number {
    this.stored += Math.min(MAX_FRAME, Math.max(0, frameSeconds));
    // The tolerance stops rounding errors from losing a step when a frame is an exact number of steps long.
    while (this.stored >= STEP_DT - 1e-9) { tick(); this.stored = Math.max(0, this.stored - STEP_DT); }
    return this.stored / STEP_DT;
  }

  reset() { this.stored = 0; }
}
