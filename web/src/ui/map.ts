// The level map: three tiers of eight levels, with stars for cleared ones and a lock on the ones not reached yet.
import { Session } from '../app/session';
import { isTierStart, LEVELS } from '../levels/catalog';
import { LEVELS_PER_TIER, TIERS } from '../levels/tiers';
import { starText } from './hud';
import { fill, Language, Texts } from './texts';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class LevelMap {
  private readonly root = byId('mapDialog');
  private readonly tiers = byId('mapTiers');

  /** `start(index)` begins a run from the chosen level. */
  constructor(private session: Session, private t: Texts, private lang: Language, private start: (index: number) => void) {
    byId('mapClose').addEventListener('click', () => this.close());
    this.root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); this.close(); } });
    byId('mapReview').hidden = !session.review;
  }

  open() {
    this.render();
    this.root.hidden = false;
    (this.tiers.querySelector('button:not(:disabled)') as HTMLButtonElement | null)?.focus();
  }

  close() { this.root.hidden = true; }

  private render() {
    const t = this.t, l = this.lang;
    this.tiers.replaceChildren(...TIERS.map((tier, ti) => {
      const section = document.createElement('section'), title = document.createElement('h3'), row = document.createElement('div');
      section.className = 'map-tier'; row.className = 'map-row';
      title.textContent = fill(t.tierTitle, { n: tier.tier, tier: tier.name[l], world: tier.worldName[l] });
      for (let k = 0; k < LEVELS_PER_TIER; k++) {
        const index = ti * LEVELS_PER_TIER + k, level = LEVELS[index], open = this.session.isOpen(index), stars = this.session.stars(index);
        const cell = document.createElement('button'), id = document.createElement('b'), name = document.createElement('span'), mark = document.createElement('span');
        cell.type = 'button'; cell.className = 'map-cell'; cell.disabled = !open;
        cell.classList.toggle('start', isTierStart(index));
        id.textContent = level.id; name.className = 'name'; name.textContent = level.name[l];
        mark.className = 'cell-stars'; mark.textContent = open ? starText(stars) : t.locked;
        cell.title = open ? `${level.id} · ${level.name[l]}` : `${level.id} · ${t.locked}`;
        cell.append(id, name, mark);
        cell.addEventListener('click', () => { this.close(); this.start(index); });
        row.append(cell);
      }
      section.append(title, row);
      return section;
    }));
  }
}
