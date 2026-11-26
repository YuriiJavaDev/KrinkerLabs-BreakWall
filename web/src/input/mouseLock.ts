/**
 * Holds the mouse on the table during a game (the browser's Pointer Lock): the cursor is hidden and cannot leave the window,
 * and the paddle follows the movement of the mouse. The browser may refuse (some frames and old browsers do);
 * then the game simply follows the cursor as before.
 */
export class MouseLock {
  private wasLocked = false;

  /** `onLost` runs when the hold ends for any reason: Esc, another window, or a release by the game. */
  constructor(private target: HTMLElement, onLost: () => void) {
    document.addEventListener('pointerlockchange', () => {
      const now = this.locked;
      if (this.wasLocked && !now) onLost();
      this.wasLocked = now;
    });
    document.addEventListener('pointerlockerror', () => { this.wasLocked = false; });
  }

  get locked() { return document.pointerLockElement === this.target; }

  /** Call from a click or a key press: browsers grant the hold only then. */
  lock() {
    if (this.locked || typeof this.target.requestPointerLock !== 'function') return;
    try {
      const request = this.target.requestPointerLock() as unknown;
      if (request instanceof Promise) request.catch(() => { /* refused: the cursor stays free */ });
    } catch { /* refused: the cursor stays free */ }
  }

  release() { if (this.locked) document.exitPointerLock(); }
}
