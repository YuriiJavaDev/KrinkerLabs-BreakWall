import { TRAY_MAX } from '../rules/config';
import { Game } from '../rules/state';
import { extraBallProgress } from '../rules/tray';
import { Language } from './texts';
import { formatScore, Texts } from './texts';

/** The message over the table: before the launch, or in a pause. The end of a level or a game has its own screen. */
export type Message = 'serve' | 'paused' | null;

export function messageFor(g: Game, paused: boolean): Message {
  if (g.phase === 'won' || g.phase === 'over') return null;
  if (paused) return 'paused';
  return g.phase === 'serve' ? 'serve' : null;
}

/** The extra-ball meter in whole percent (a full tray shows a full bar), so the page is touched only when the bar visibly moves. */
export const meterPercent = (progress: number) => (progress < 0 ? 100 : Math.floor(progress * 100));

/** Three stars as text, the earned ones filled. */
export const starText = (stars: number) => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

interface Shown {
  score: number; tray: number; meter: number; full: boolean | undefined; message: Message | undefined; paused: boolean | undefined;
  level: string; stars: number; total: number;
}
const nothingShown = (): Shown => ({ score: -1, tray: -1, meter: -1, full: undefined, message: undefined, paused: undefined, level: '', stars: -1, total: -1 });

/**
 * The left panel (level, stars, score, tray, extra-ball meter) and the message over the table.
 * Touches the page only when something shown has changed.
 */
export class Hud {
  private shown = nothingShown();
  private readonly score = byId('score');
  private readonly slots = Array.from({ length: TRAY_MAX }, (_, i) => byId(`slot${i}`));
  private readonly tray = byId('tray');
  private readonly fill = byId('extraFill');
  private readonly extraLabel = byId('extraLabel');
  private readonly levelId = byId('levelId');
  private readonly levelName = byId('levelName');
  private readonly levelStars = byId('levelStars');
  private readonly starsTotal = byId('starsTotal');
  private readonly box = byId('message');
  private readonly title = byId('messageTitle');
  private readonly line = byId('messageLine');
  private readonly hint = byId('messageHint');
  private readonly pauseLabel = byId('pauseLabel');
  private readonly pause = byId<HTMLButtonElement>('pause');

  constructor(private texts: Texts, private language: Language) {}

  /** Forget what was shown, so the next update draws everything (after a new game). */
  reset() { this.shown = nothingShown(); }

  update(g: Game, paused: boolean, levelStars: number, totalStars: number) {
    const s = this.shown, t = this.texts;
    if (g.level.id !== s.level) {
      s.level = g.level.id;
      this.levelId.textContent = g.level.id;
      this.levelName.textContent = g.level.name[this.language];
      s.message = undefined;
    }
    if (levelStars !== s.stars) { s.stars = levelStars; this.levelStars.textContent = starText(levelStars); }
    if (totalStars !== s.total) { s.total = totalStars; this.starsTotal.textContent = String(totalStars); }
    if (g.score !== s.score) { s.score = g.score; this.score.textContent = formatScore(g.score); }
    if (g.tray !== s.tray) {
      s.tray = g.tray;
      this.slots.forEach((slot, i) => slot.classList.toggle('full', i < g.tray));
      this.tray.setAttribute('aria-label', `${t.tray}: ${g.tray} / ${TRAY_MAX}`);
    }
    const progress = extraBallProgress(g), meter = meterPercent(progress), full = progress < 0;
    if (meter !== s.meter) { s.meter = meter; this.fill.style.width = `${meter}%`; }
    if (full !== s.full) {
      s.full = full;
      this.fill.classList.toggle('full', full);
      this.extraLabel.textContent = full ? t.trayFull : t.extraBall;
    }
    if (paused !== s.paused) {
      s.paused = paused;
      this.pauseLabel.textContent = paused ? t.resume : t.pause;
      this.pause.setAttribute('aria-pressed', String(paused));
    }
    const message = messageFor(g, paused);
    if (message !== s.message) { s.message = message; this.showMessage(message, g); }
  }

  private showMessage(message: Message, g: Game) {
    this.box.hidden = message === null;
    const t = this.texts;
    if (message === 'serve') {
      this.title.textContent = `${g.level.id} · ${g.level.name[this.language]}`;
      this.line.textContent = g.level.intro[this.language];
      this.hint.textContent = t.serve;
    }
    if (message === 'paused') { this.title.textContent = t.paused; this.line.textContent = t.pausedHelp; this.hint.textContent = ''; }
  }
}
