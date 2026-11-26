// What each key does. Keys are matched by their place on the keyboard (KeyboardEvent.code),
// so they work the same with a Russian, Hebrew or any other layout.

export type KeyAction = 'left' | 'right' | 'launch' | 'pause' | 'sound' | 'leave';

const ACTIONS: Record<string, KeyAction> = {
  ArrowLeft: 'left', KeyA: 'left', ShiftLeft: 'left',
  ArrowRight: 'right', KeyD: 'right', ShiftRight: 'right',
  Enter: 'launch', NumpadEnter: 'launch',
  KeyP: 'pause', Space: 'pause',
  KeyM: 'sound',
  Escape: 'leave',
};

export const keyAction = (code: string): KeyAction | null => ACTIONS[code] ?? null;

/**
 * The paddle target after the mouse moved by `dx` screen pixels while it is held by the game:
 * the movement in field units, kept where the paddle can be.
 */
export const movedTarget = (target: number, dx: number, scale: number, min: number, max: number) =>
  Math.min(max, Math.max(min, target + dx / scale));
