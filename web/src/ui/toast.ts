const SHOW_MS = 2200;

/** A short line over the table: the name of a caught bonus, or a hint shown once. */
export class Toast {
  private timer = 0;
  private readonly seen = new Set<string>();
  constructor(private el: HTMLElement) {}

  show(text: string) {
    this.el.textContent = text;
    this.el.hidden = false;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.el.hidden = true; }, SHOW_MS);
  }

  /** Shows a hint only the first time in this visit. */
  once(key: string, text: string) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.show(text);
  }

  hide() { this.el.hidden = true; clearTimeout(this.timer); }
}
