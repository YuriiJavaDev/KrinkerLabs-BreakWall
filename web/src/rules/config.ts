// Sizes are in field units: the field is always FIELD_W × FIELD_H and the renderer scales it to the screen.

export const FIELD_W = 780;
export const FIELD_H = 1040;

export const GRID_COLS = 13;
export const GRID_MAX_ROWS = 18;
export const CELL_W = 56;
export const CELL_H = 28;
export const BRICK_GAP = 4;
export const GRID_LEFT = (FIELD_W - GRID_COLS * CELL_W) / 2;
export const GRID_TOP = 110;

export const BALL_R = 9;
export const PADDLE_W = 124;
export const PADDLE_H = 18;
/** Top of the paddle. The strip below it is where a finger rests on a phone, so the finger does not hide the paddle. */
export const PADDLE_TOP = FIELD_H - 120;
export const PADDLE_MAX_SPEED = 2600;

/** Ball speed in field units per second. */
export const START_SPEED = 480;
export const MAX_SPEED = 960;
export const SPEED_UP_PER_PADDLE_HIT = 1.025;

const DEG = Math.PI / 180;
/** A hit on the very edge of the paddle sends the ball this far from straight up. */
export const MAX_BOUNCE_ANGLE = 60 * DEG;
/** A moving paddle adds up to this much "spin" to the bounce. */
export const SPIN_ANGLE = 8 * DEG;
/** The ball never flies flatter than this from straight up or down, so it cannot get stuck between the side walls. */
export const MAX_FLIGHT_ANGLE = 70 * DEG;
export const LAUNCH_OFFSET = 0.25;

export const LIVES = 3;
export const BRICK_POINTS = 1000;
export const COMBO_CAP = 10;
