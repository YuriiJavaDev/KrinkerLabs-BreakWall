// Sizes are in field units: the inner field (between the rails) is always FIELD_W × FIELD_H,
// and the renderer scales it to the screen. The field is tall: the ball goes up, and on harder levels the wall will creep down.

export const FIELD_W = 780;
export const FIELD_H = 1300;
/** Thickness of the side and top rails, drawn outside the inner field. */
export const RAIL = 46;

export const GRID_COLS = 7;
export const GRID_MAX_ROWS = 18;
export const CELL_W = 108;
export const CELL_H = 52;
export const BRICK_GAP = 6;
export const GRID_LEFT = (FIELD_W - GRID_COLS * CELL_W) / 2;
export const GRID_TOP = 130;

export const BALL_R = 18;
export const PADDLE_W = 248;
export const PADDLE_H = 34;
/** Top of the paddle. The strip below it is where a finger rests on a phone, so the finger does not hide the paddle. */
export const PADDLE_TOP = FIELD_H - 170;
export const PADDLE_MAX_SPEED = 3400;

/** Ball speed in field units per second. */
export const START_SPEED = 620;
export const MAX_SPEED = 1200;
export const SPEED_UP_PER_PADDLE_HIT = 1.025;

const DEG = Math.PI / 180;
/** A hit on the very edge of the paddle sends the ball this far from straight up. */
export const MAX_BOUNCE_ANGLE = 60 * DEG;
/** A moving paddle adds up to this much "spin" to the bounce. */
export const SPIN_ANGLE = 8 * DEG;
/** The ball never flies flatter than this from straight up or down, so it cannot get stuck between the side walls. */
export const MAX_FLIGHT_ANGLE = 70 * DEG;
export const LAUNCH_OFFSET = 0.25;

/** Balls in the tray: the game starts with TRAY_START and the tray holds at most TRAY_MAX. */
export const TRAY_START = 3;
export const TRAY_MAX = 5;
/** Every this many seconds a ball stays in play, one more ball goes into the tray while it has room. */
export const EXTRA_BALL_SECONDS = 60;
/** Balls on the field at the same time (multiball). This has nothing to do with the balls in the tray. */
export const FIELD_BALLS_MAX = 3;

export const BRICK_POINTS = 1000;
export const COMBO_CAP = 10;
