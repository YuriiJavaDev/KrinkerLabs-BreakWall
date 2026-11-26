import { StepInput } from '../rules/step';

/** How fast the arrow keys move the paddle, field units per second. */
export const KEY_SPEED = 1100;

/** Field x under a screen x, for a field drawn from `left` at `scale` screen pixels per field unit. */
export const screenToField = (clientX: number, left: number, scale: number) => (clientX - left) / scale;

export interface ControlHooks {
  /** Screen x to field x, from the renderer. */
  toFieldX(clientX: number): number;
  onLaunchGesture(): void;
  onPause(): void;
  onSound(): void;
  onLeave(): void;
  /** True while a window (who is playing, leave) is open: the keys then belong to it. */
  blocked(): boolean;
}

/** Mouse, finger and keyboard in one place. The game reads one StepInput per fixed step. */
export class Controls {
  private pointerX: number | null = null;
  private keyDir = 0;
  private held = { left: false, right: false };
  private launchWanted = false;
  private readonly input: StepInput = { targetX: null, launch: false };

  constructor(surface: HTMLElement, private hooks: ControlHooks) {
    surface.addEventListener('pointermove', (e) => { this.pointerX = hooks.toFieldX(e.clientX); });
    surface.addEventListener('pointerdown', (e) => {
      this.pointerX = hooks.toFieldX(e.clientX);
      this.launchWanted = true;
      hooks.onLaunchGesture();
    });
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => { this.held.left = this.held.right = false; this.keyDir = 0; });
  }

  private key(e: KeyboardEvent, down: boolean) {
    const k = e.key, on = e.target instanceof HTMLElement ? e.target : null;
    if (this.hooks.blocked() || on?.closest('input, textarea')) { this.held.left = this.held.right = false; this.keyDir = 0; return; }
    // Space and Enter on a focused button press that button, not the game
    if ((k === ' ' || k === 'Enter') && on?.closest('button, a')) return;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.held.left = down;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.held.right = down;
    else if (down && (k === ' ' || k === 'Enter')) { this.launchWanted = true; this.hooks.onLaunchGesture(); }
    else if (down && (k === 'p' || k === 'P')) this.hooks.onPause();
    else if (down && (k === 'm' || k === 'M')) this.hooks.onSound();
    else if (down && k === 'Escape') this.hooks.onLeave();
    else return;
    e.preventDefault();
    this.keyDir = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    if (this.keyDir !== 0) this.pointerX = null;
  }

  /** The input for one step of dt seconds, with the paddle now at paddleX. */
  next(paddleX: number, dt: number): StepInput {
    this.input.targetX = this.keyDir !== 0 ? paddleX + this.keyDir * KEY_SPEED * dt : this.pointerX;
    this.input.launch = this.launchWanted;
    this.launchWanted = false;
    return this.input;
  }

  /** Forget a launch asked for while the game could not take it (paused, finished). */
  dropLaunch() { this.launchWanted = false; }
}
