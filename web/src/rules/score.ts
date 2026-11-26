import { BRICK_POINTS, COMBO_CAP } from './config';

/** Points for the n-th brick (1, 2, 3 ...) broken without touching the paddle: each one in a row is worth one more step, up to the cap. */
export const brickPoints = (comboIndex: number) => BRICK_POINTS * Math.min(Math.max(1, comboIndex), COMBO_CAP);
