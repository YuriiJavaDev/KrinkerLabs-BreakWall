// Sizes are in field units: the inner field (between the rails) is always FIELD_W × FIELD_H,
// and the renderer scales it to the screen. The field is tall: the ball goes up, and on harder levels the wall creeps down.
// Paddle and ball sizes and speeds depend on the tier (levels/tiers.ts); everything shared by all tiers is here.

export const FIELD_W = 780;
export const FIELD_H = 1300;
/** Thickness of the side and top rails, drawn outside the inner field. */
export const RAIL = 46;

export const PADDLE_H = 34;
/** Top of the paddle. The strip below it is where a finger rests on a phone, so the finger does not hide the paddle. */
export const PADDLE_TOP = FIELD_H - 170;
export const PADDLE_MAX_SPEED = 3400;
/** A creeping wall that reaches this line costs a ball. */
export const DANGER_Y = PADDLE_TOP - 90;

export const SPEED_UP_PER_PADDLE_HIT = 1.025;
const DEG = Math.PI / 180;
/** A hit on the very edge of the paddle sends the ball this far from straight up. */
export const MAX_BOUNCE_ANGLE = 60 * DEG;
/** A moving paddle adds up to this much "spin" to the bounce. */
export const SPIN_ANGLE = 8 * DEG;
/** The ball never flies flatter than this from straight up or down, so it cannot get stuck between the side walls. */
export const MAX_FLIGHT_ANGLE = 70 * DEG;
export const LAUNCH_OFFSET = 0.25;
/** A ball that has touched neither the paddle nor a brick for this long gets a small turn at its next bounce, so it cannot loop forever. */
export const LOOP_SECONDS = 12;
export const LOOP_TURN = 9 * DEG;

/** Balls in the tray: a run starts with TRAY_START and the tray holds at most TRAY_MAX. */
export const TRAY_START = 3;
export const TRAY_MAX = 5;
/** Balls on the field at the same time (multiball, the time bomb). This has nothing to do with the balls in the tray. */
export const FIELD_BALLS_MAX = 3;

export const BRICK_POINTS = 1000;
export const BONUS_BRICK_POINTS = 2000;
export const COMBO_CAP = 10;
export const BUMPER_POINTS = 100;
export const BALL_LEFT_POINTS = 10000;
export const SECOND_POINTS = 500;

// bonuses
export const CAPSULE_SPEED = 300;
export const CAPSULE_R = 22;
export const WIDE = { scale: 1.5, seconds: 20 };
export const NARROW = { scale: 0.65, seconds: 15 };
export const SLOW = { pace: 0.7, seconds: 15 };
export const FAST = { pace: 1.25, seconds: 10 };
export const LASER = { seconds: 20, wait: 0.3, speed: 1500 };
export const STICKY_CATCHES = 5;
export const COMET_SECONDS = 6;
export const SPLIT_ANGLE = 22 * DEG;
/** The bomb capsule: the next brick a ball hits blows up this far around. */
export const BOMB_RADIUS = 165;
/** The explosive brick blows up this far around its centre. */
export const EXPLOSIVE_RADIUS = 125;

// the time bomb
export const TIME_BOMB = { fuse: 12, radius: 270, stunSeconds: 8, stunScale: 0.7, stunAngle: 20 * DEG, warn: 3 };

/** How long a broken regrowing brick stays away, and the run of bricks after which it stays broken for good. */
export const REGEN_SECONDS = 12;
export const REGEN_RUN = 3;
/** How long an invisible brick shows after a hit. */
export const FLASH_SECONDS = 0.7;
/** How fast the creeping wall slides one step down, field units per second, and how far it goes back after it reached the line. */
export const WALL_SLIDE = 140;
export const WALL_BACK_STEPS = 3;
