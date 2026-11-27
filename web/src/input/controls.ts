import { FIELD_W } from '../rules/config';
import { StepInput } from '../rules/step';
import { keyAction, movedTarget } from './keys';
import { MouseLock } from './mouseLock';

/** How fast the keys move the paddle, field units per second. */
export const KEY_SPEED = 1400;

/** Field x under a screen x, for a field drawn from `left` at `scale` screen pixels per field unit. */
export const screenToField = (clientX: number, left: number, scale: number) => (clientX - left) / scale;

export interface ControlHooks {
  /** Screen x to field x, and screen pixels per field unit, from the renderer. */
  toFieldX(clientX: number): number;
  scale(): number;
  /** Half the paddle's width now, so the held mouse stops where the paddle stops. */
  paddleHalf(): number;
  /** A click or tap on the table that may launch the ball. */
  onLaunchGesture(): void;
  onPause(): void;
  onSound(): void;
  onLeave(): void;
  /** True while a window is open over the game: the keys then belong to it. */
  blocked(): boolean;
  /** True while the game is paused: the mouse is then free and does not move the paddle. */
  paused(): boolean;
}

/** Mouse, finger and keyboard in one place. The game reads one StepInput per fixed step. */
export class Controls {
  /** Where the free cursor or the finger points, in field x. */
  private pointerX: number | null = null;
  /** Where the held mouse has moved the paddle to, in field x; null until it moves. */
  private heldX: number | null = null;
  private lastPaddleX = FIELD_W / 2;
  private held = { left: false, right: false };
  private launchWanted = false;
  private readonly input: StepInput = { targetX: null, launch: false };

  constructor(surface: HTMLElement, private lock: MouseLock, private hooks: ControlHooks) {
    surface.addEventListener('pointermove', (e) => this.move(e));
    surface.addEventListener('pointerdown', (e) => {
      if (hooks.paused() || hooks.blocked()) return;
      if (!this.lock.locked) this.pointerX = hooks.toFieldX(e.clientX);
      this.launchWanted = true;
      hooks.onLaunchGesture();
    });
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.releaseKeys());
  }

  private move(e: PointerEvent) {
    if (this.lock.locked) {
      const half = this.hooks.paddleHalf();
      this.heldX = movedTarget(this.heldX ?? this.lastPaddleX, e.movementX, this.hooks.scale(), half, FIELD_W - half);
      return;
    }
    if (!this.hooks.paused()) this.pointerX = this.hooks.toFieldX(e.clientX);
  }

  private key(e: KeyboardEvent, down: boolean) {
    const on = e.target instanceof HTMLElement ? e.target : null;
    if (this.hooks.blocked() || on?.closest('input, textarea')) { this.releaseKeys(); return; }
    const action = keyAction(e.code);
    if (!action) return;
    // Enter on a focused button presses that button, not the game
    if (action === 'launch' && on?.closest('button, a')) return;
    e.preventDefault();
    if (action === 'left') this.held.left = down;
    else if (action === 'right') this.held.right = down;
    else if (!down || e.repeat) return;
    else if (action === 'launch') { this.launchWanted = true; this.hooks.onLaunchGesture(); }
    else if (action === 'pause') this.hooks.onPause();
    else if (action === 'sound') this.hooks.onSound();
    else if (action === 'leave') this.hooks.onLeave();
    if (this.keyDir !== 0) { this.pointerX = null; this.heldX = null; }
  }

  private get keyDir() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); }

  private releaseKeys() { this.held.left = this.held.right = false; }

  /** The input for one step of dt seconds, with the paddle now at paddleX. */
  next(paddleX: number, dt: number): StepInput {
    this.lastPaddleX = paddleX;
    const dir = this.keyDir;
    this.input.targetX = dir !== 0 ? paddleX + dir * KEY_SPEED * dt : this.lock.locked ? this.heldX : this.pointerX;
    this.input.launch = this.launchWanted;
    this.launchWanted = false;
    return this.input;
  }

  /** The mouse was just taken or let go: the paddle stays where it is until the mouse moves. */
  resetPointer() { this.pointerX = null; this.heldX = null; }

  /** Forget a launch asked for while the game could not take it (paused, finished). */
  dropLaunch() { this.launchWanted = false; }
}
