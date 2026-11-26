import { Game } from '../rules/state';
import { Texts } from './texts';

export type Message = 'serve' | 'paused' | 'won' | 'over' | null;

/** Which message the field shows for a game, given whether it is paused. */
export function messageFor(g: Game, paused: boolean): Message {
  if (g.phase === 'won') return 'won';
  if (g.phase === 'over') return 'over';
  if (paused) return 'paused';
  return g.phase === 'serve' ? 'serve' : null;
}

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Score, lives and the message over the field. Touches the page only when something shown has changed. */
export class Hud {
  private shown = { score: -1, lives: -1, message: undefined as Message | undefined, paused: undefined as boolean | undefined };
  private readonly score = byId('score');
  private readonly lives = byId('lives');
  private readonly box = byId('message');
  private readonly title = byId('messageTitle');
  private readonly line = byId('messageLine');
  private readonly again = byId<HTMLButtonElement>('again');
  private readonly pause = byId<HTMLButtonElement>('pause');
  private readonly numbers: Intl.NumberFormat;

  constructor(private texts: Texts, language: string) {
    this.numbers = new Intl.NumberFormat(language);
  }

  update(g: Game, paused: boolean) {
    if (g.score !== this.shown.score) { this.shown.score = g.score; this.score.textContent = this.numbers.format(g.score); }
    if (g.lives !== this.shown.lives) {
      this.shown.lives = g.lives;
      this.lives.textContent = '♥'.repeat(Math.max(0, g.lives)) + ' ' + Math.max(0, g.lives);
    }
    if (paused !== this.shown.paused) { this.shown.paused = paused; this.pause.textContent = paused ? this.texts.resume : this.texts.pause; }
    const message = messageFor(g, paused);
    if (message !== this.shown.message) { this.shown.message = message; this.showMessage(message, g); }
  }

  private showMessage(message: Message, g: Game) {
    this.box.hidden = message === null;
    this.again.hidden = message !== 'won' && message !== 'over';
    const t = this.texts;
    if (message === 'serve') { this.title.textContent = t.serve; this.line.textContent = t.serveKeys; }
    if (message === 'paused') { this.title.textContent = t.paused; this.line.textContent = t.serveKeys; }
    if (message === 'won' || message === 'over') {
      this.title.textContent = message === 'won' ? t.won : t.over;
      this.line.textContent = `${t.finalScore}: ${this.numbers.format(g.score)}`;
    }
  }
}
