// The screens over the table at the end of a level ("Well done!"), of a lost game and of the whole game.
import { Level } from '../levels/level';
import { LevelResult } from '../rules/state';
import { Tier } from '../levels/tiers';
import { fill, formatScore, Language, Texts } from './texts';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface ScreenActions { primary(): void; map(): void }

export class Screens {
  private readonly root = byId('screen');
  private readonly title = byId('screenTitle');
  private readonly line = byId('screenLine');
  private readonly stars = byId('screenStars');
  private readonly rows = byId('screenRows');
  private readonly note = byId('screenNote');
  private readonly go = byId<HTMLButtonElement>('screenGo');
  private action: () => void = () => {};

  constructor(private t: Texts, private lang: Language, actions: { map(): void }) {
    this.go.addEventListener('click', () => this.action());
    byId('screenMap').addEventListener('click', () => actions.map());
  }

  get visible() { return !this.root.hidden; }
  hide() { this.root.hidden = true; }

  /** "Well done!": the level, its stars, where the points came from, and the way on. */
  cleared(level: Level, r: LevelResult, score: number, newRecord: boolean, next: Level, nextTier: Tier | null, tier: Tier, then: () => void) {
    const t = this.t, l = this.lang;
    this.show(t.wellDone, fill(t.levelCleared, { id: level.id, name: level.name[l] }), r.stars);
    this.setRows([[t.rowBricks, r.bricks], [t.rowTime, r.timeBonus], [t.rowBalls, r.ballsBonus], [t.rowTotal, r.total, true], [t.rowScore, score]]);
    const notes: string[] = [];
    if (newRecord) notes.push(t.newRecord);
    if (nextTier) notes.push(fill(t.tierDone, { tier: tier.name[l], next: nextTier.name[l], world: nextTier.worldName[l] }));
    this.note.textContent = notes.join(' ');
    this.button(fill(t.next, { id: next.id, name: next.name[l] }), then);
  }

  /** The tray is empty: the result, and the tier again from its first level. */
  over(score: number, restartId: string, then: () => void) {
    const t = this.t;
    this.show(t.over, t.overLine, -1);
    this.setRows([[t.rowScore, score, true]]);
    this.note.textContent = '';
    this.button(fill(t.restartTier, { id: restartId }), then);
  }

  /** The last level is cleared. */
  complete(r: LevelResult, score: number, stars: number, then: () => void) {
    const t = this.t;
    this.show(t.gameDone, fill(t.gameDoneLine, { stars }), r.stars);
    this.setRows([[t.rowTotal, r.total], [t.rowScore, score, true]]);
    this.note.textContent = '';
    this.button(t.again, then);
  }

  private show(title: string, line: string, stars: number) {
    this.title.textContent = title;
    this.line.textContent = line;
    this.stars.replaceChildren(...(stars < 0 ? [] : [0, 1, 2].map((i) => {
      const star = document.createElement('i');
      star.textContent = '★';
      star.classList.toggle('off', i >= stars);
      return star;
    })));
    this.root.hidden = false;
  }

  private setRows(rows: [string, number, boolean?][]) {
    this.rows.replaceChildren(...rows.flatMap(([label, value, sum]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = formatScore(value);
      if (sum) { dt.classList.add('sum'); dd.classList.add('sum'); }
      return [dt, dd];
    }));
  }

  private button(text: string, then: () => void) {
    this.go.textContent = text;
    this.action = then;
    this.go.focus();
  }
}
