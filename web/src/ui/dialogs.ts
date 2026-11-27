// The windows over the game: "who is playing" at the start (and to give a name later), and "leave the game".
import { Session } from '../app/session';
import { cleanName, isRude } from '../scores/names';
import { recentPlayers } from '../storage/players';
import { KeyValueStore } from '../storage/kv';
import { leaveFirst } from './leave';
import { fill, Texts } from './texts';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** True while any window is open over the game: the game then stands still. */
export const anyDialogOpen = () => !!document.querySelector('.modal:not([hidden])');

export interface WhoHooks {
  /** The player chose a new game or to go on with the saved one. */
  onStart(kind: 'new' | 'continue'): void;
  /** The player list or name changed. */
  onPlayer(): void;
  /** The player wants to pick a level on the map. */
  onMap(): void;
}

/**
 * Who is playing. "start": the first window of the game, with a new game, the saved game of that nickname, or no name.
 * "name": a nickname for the game in progress, which goes on as it is.
 */
export class WhoDialog {
  private mode: 'start' | 'name' = 'start';
  private then: (() => void) | null = null;
  private readonly root = byId('whoDialog');
  private readonly input = byId<HTMLInputElement>('nameIn');
  private readonly err = byId('whoErr');
  private readonly cont = byId<HTMLButtonElement>('continueBtn');
  private readonly play = byId<HTMLButtonElement>('playBtn');
  private readonly skip = byId<HTMLButtonElement>('skipName');
  private readonly recent = byId('recentNames');

  constructor(private session: Session, private store: KeyValueStore | null, private t: Texts, private format: (n: number) => string, private hooks: WhoHooks) {
    byId('whoForm').addEventListener('submit', (e) => { e.preventDefault(); this.confirm(); });
    this.input.addEventListener('input', () => { this.err.hidden = true; this.offerSave(); });
    this.cont.addEventListener('click', () => this.goOn());
    this.skip.addEventListener('click', () => this.withoutName());
    byId('whoMap').addEventListener('click', () => this.toMap());
    this.root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.mode === 'name') { e.preventDefault(); this.close(); } });
  }

  /** `then` runs after a nickname was given in "name" mode (for "give a nickname and leave"). */
  open(mode: 'start' | 'name', then: (() => void) | null = null) {
    this.mode = mode; this.then = then;
    this.input.value = this.session.player;
    this.err.hidden = true;
    this.play.textContent = mode === 'start' ? this.t.play : this.t.keepPlaying;
    byId('whoMap').hidden = mode !== 'start';
    this.skip.textContent = mode === 'start' ? this.t.playNoName : this.t.cancel;
    this.recent.replaceChildren(...recentPlayers(this.store).map((name) => Object.assign(document.createElement('option'), { value: name })));
    this.offerSave();
    this.root.hidden = false;
    this.input.focus();
  }

  close() { this.root.hidden = true; }

  /** In "start" mode, offer to go on when the typed nickname has a saved game. */
  private offerSave() {
    const save = this.mode === 'start' ? this.session.savedGame(cleanName(this.input.value)) : null;
    this.cont.hidden = !save;
    if (save) this.cont.textContent = fill(this.t.continueSaved, { id: save.level, score: this.format(save.score), balls: save.tray });
  }

  /** The typed nickname, or null (with the reason shown) when it cannot be used. */
  private takeName(): string | null {
    const raw = this.input.value;
    if (isRude(raw)) { this.err.textContent = this.t.rude; this.err.hidden = false; this.input.focus(); return null; }
    return cleanName(raw);
  }

  private confirm() {
    const name = this.takeName();
    if (name === null) return;
    if (this.mode === 'name') {
      if (!name) { this.close(); return; }
      this.session.setPlayer(name); this.hooks.onPlayer(); this.close();
      this.then?.();
      return;
    }
    if (name) this.session.setPlayer(name); else this.session.clearPlayer();
    this.hooks.onPlayer(); this.close(); this.hooks.onStart('new');
  }

  private goOn() {
    const name = this.takeName();
    if (!name) return;
    this.session.setPlayer(name); this.hooks.onPlayer(); this.close(); this.hooks.onStart('continue');
  }

  /** The map from the first window: the typed nickname (or none) is taken first. */
  private toMap() {
    const name = this.takeName();
    if (name === null) return;
    if (name) this.session.setPlayer(name); else this.session.clearPlayer();
    this.hooks.onPlayer(); this.close(); this.hooks.onMap();
  }

  private withoutName() {
    if (this.mode === 'name') { this.close(); return; }
    this.session.clearPlayer(); this.hooks.onPlayer(); this.close(); this.hooks.onStart('new');
  }
}

/** Leave the game: save first when there is something to keep, or ask for a nickname to keep it. */
export class LeaveDialog {
  private readonly root = byId('leaveDialog');
  private readonly text = byId('leaveText');
  private readonly first = byId<HTMLButtonElement>('leaveFirst');
  private readonly now = byId<HTMLButtonElement>('leaveNow');
  private plan: ReturnType<typeof leaveFirst> = null;

  constructor(private session: Session, private who: WhoDialog, private t: Texts, private go: () => void) {
    this.first.addEventListener('click', () => this.doFirst());
    this.now.addEventListener('click', () => this.go());
    byId('leaveStay').addEventListener('click', () => this.close());
    this.root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); this.close(); } });
  }

  open() {
    this.plan = leaveFirst(this.session.player, this.session.hasProgress);
    const t = this.t;
    this.text.textContent = this.plan === 'save' ? t.leaveSave : this.plan === 'name' ? t.leaveName : t.leaveJust;
    this.first.textContent = this.plan === 'save' ? t.saveAndLeave : this.plan === 'name' ? t.nameAndLeave : t.leaveGo;
    this.now.hidden = this.plan === null;
    this.root.hidden = false;
    this.first.focus();
  }

  close() { this.root.hidden = true; }

  private doFirst() {
    if (this.plan === 'save') { this.session.saveNow(); this.go(); return; }
    if (this.plan === 'name') { this.close(); this.who.open('name', () => { this.session.saveNow(); this.go(); }); return; }
    this.go();
  }
}
