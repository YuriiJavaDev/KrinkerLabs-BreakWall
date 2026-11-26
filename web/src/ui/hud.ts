import { TRAY_MAX } from '../rules/config';
import { Game } from '../rules/state';
import { extraBallProgress } from '../rules/tray';
import { Texts } from './texts';

export type Message = 'serve' | 'paused' | 'won' | 'over' | null;

/** Which message the field shows for a game, given whether it is paused. */
export function messageFor(g: Game, paused: boolean): Message {
  if (g.phase === 'won') return 'won';
  if (g.phase === 'over') return 'over';
  if (paused) return 'paused';
  return g.phase === 'serve' ? 'serve' : null;
}

/** The extra-ball meter in whole percent (a full tray shows a full bar), so the page is touched only when the bar visibly moves. */
export const meterPercent = (progress: number) => (progress < 0 ? 100 : Math.floor(progress * 100));

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

interface Shown { score: number; tray: number; meter: number; full: boolean | undefined; message: Message | undefined; paused: boolean | undefined }
const nothingShown = (): Shown => ({ score: -1, tray: -1, meter: -1, full: undefined, message: undefined, paused: undefined });

/** Score, the tray of balls, the extra-ball meter and the message over the field. Touches the page only when something changed. */
export class Hud {
  private shown = nothingShown();
  private readonly score = byId('score');
  private readonly slots = Array.from({ length: TRAY_MAX }, (_, i) => byId(`slot${i}`));
  private readonly tray = byId('tray');
  private readonly fill = byId('extraFill');
  private readonly extraLabel = byId('extraLabel');
  private readonly box = byId('message');
  private readonly title = byId('messageTitle');
  private readonly line = byId('messageLine');
  private readonly again = byId<HTMLButtonElement>('again');
  private readonly pauseLabel = byId('pauseLabel');
  private readonly pause = byId<HTMLButtonElement>('pause');
  private readonly numbers: Intl.NumberFormat;

  constructor(private texts: Texts, language: string) {
    this.numbers = new Intl.NumberFormat(language);
  }

  format(n: number) { return this.numbers.format(n); }

  /** Forget what was shown, so the next update draws everything (after a new game). */
  reset() { this.shown = nothingShown(); }

  update(g: Game, paused: boolean) {
    const s = this.shown;
    if (g.score !== s.score) { s.score = g.score; this.score.textContent = this.format(g.score); }
    if (g.tray !== s.tray) {
      s.tray = g.tray;
      this.slots.forEach((slot, i) => slot.classList.toggle('full', i < g.tray));
      this.tray.setAttribute('aria-label', `${this.texts.tray}: ${g.tray} / ${TRAY_MAX}`);
    }
    const progress = extraBallProgress(g), meter = meterPercent(progress), full = progress < 0;
    if (meter !== s.meter) { s.meter = meter; this.fill.style.width = `${meter}%`; }
    if (full !== s.full) {
      s.full = full;
      this.fill.classList.toggle('full', full);
      this.extraLabel.textContent = full ? this.texts.trayFull : this.texts.extraBall;
    }
    if (paused !== s.paused) {
      s.paused = paused;
      this.pauseLabel.textContent = paused ? this.texts.resume : this.texts.pause;
      this.pause.setAttribute('aria-pressed', String(paused));
    }
    const message = messageFor(g, paused);
    if (message !== s.message) { s.message = message; this.showMessage(message, g); }
  }

  private showMessage(message: Message, g: Game) {
    this.box.hidden = message === null;
    this.again.hidden = message !== 'won' && message !== 'over';
    const t = this.texts;
    if (message === 'serve') { this.title.textContent = t.serve; this.line.textContent = t.serveHelp; }
    if (message === 'paused') { this.title.textContent = t.paused; this.line.textContent = t.pausedHelp; }
    if (message === 'won' || message === 'over') {
      this.title.textContent = message === 'won' ? t.won : t.over;
      this.line.textContent = `${t.finalScore}: ${this.format(g.score)}`;
    }
  }
}
