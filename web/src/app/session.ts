// One sitting of the game: the player, the run through the levels, saving at the start of each ball,
// the progress (stars, open levels) and the top 10 at the end of a run. No DOM here: the page asks and shows, this decides.
import { isLast, isTierStart, LEVELS, levelAt, levelCount, tierFor, tierStart } from '../levels/catalog';
import { Level } from '../levels/level';
import { createGame, Game, GameEvent } from '../rules/state';
import { TRAY_START } from '../rules/config';
import { addToTop, Entry, loadTop } from '../scores/top10';
import { KeyValueStore } from '../storage/kv';
import { loadAutosave, loadPlayer, rememberPlayer, storeAutosave } from '../storage/players';
import { isOpen, loadProgress, Progress, recordLevel, storeProgress, totalStars } from '../storage/progress';
import { clearSave, readSave, restore, SaveData, snapshot, writeSave } from '../storage/save';

const IDS = LEVELS.map((l) => l.id);

export class Session {
  game: Game;
  player: string;
  autosave: boolean;
  index = 0;
  /** This run counts for the top 10: it started at the first level of a tier, and the review mode is off. */
  ranked = true;
  progress: Progress;
  /** The last cleared level improved its stars or best result. */
  newRecord = false;
  /** The game at the start of the current ball: this is what a save keeps. */
  private atServe: SaveData;
  private recorded = false;

  /** `review` opens every level, for checking the game; such runs never go into the top 10. */
  constructor(private store: KeyValueStore | null, readonly review = false, private now = () => Date.now()) {
    this.player = loadPlayer(store);
    this.autosave = loadAutosave(store);
    this.progress = loadProgress(store, this.player);
    this.game = createGame(levelAt(0), tierFor(0));
    this.atServe = snapshot(this.game, this.ranked, now());
  }

  get level(): Level { return this.game.level; }
  get ended() { return this.game.phase === 'over' || (this.game.phase === 'won' && isLast(this.index)); }
  get gameCompleted() { return this.game.phase === 'won' && isLast(this.index); }
  /** True once something would be lost by leaving: points scored or bricks broken. */
  get hasProgress() { return this.game.phase !== 'over' && (this.game.score > 0 || this.game.bricksLeft < this.game.bricks.filter((b) => b.kind !== 'steel').length); }

  setPlayer(raw: string): string { this.player = rememberPlayer(this.store, raw); this.progress = loadProgress(this.store, this.player); return this.player; }
  clearPlayer() { this.player = ''; this.progress = loadProgress(this.store, ''); }
  setAutosave(on: boolean) { this.autosave = on; storeAutosave(this.store, on); }

  /** The saved game of a player, if there is a good one. */
  savedGame(player = this.player): SaveData | null { return readSave(this.store, player); }

  isOpen(index: number) { return this.review || isOpen(this.progress, IDS, index); }
  stars(index: number) { return this.progress.stars[IDS[index]] ?? 0; }
  totalStars() { return totalStars(this.progress); }
  top(): Entry[] { return loadTop(this.store); }

  /** A new run from a level, with a full start tray and no points. A run from the first level of a tier counts for the top 10. */
  startAt(index: number) {
    const i = Math.min(levelCount() - 1, Math.max(0, index));
    this.ranked = !this.review && isTierStart(i);
    this.begin(i, createGame(levelAt(i), tierFor(i), { tray: TRAY_START, score: 0 }));
  }

  /** After a lost game: the same tier again from its first level. */
  restartTier() { this.startAt(tierStart(this.index)); }

  /** The next level of the run: the score and the balls in the tray go with the player. */
  nextLevel() {
    if (this.game.phase !== 'won' || isLast(this.index)) return;
    const i = this.index + 1, g = this.game;
    this.begin(i, createGame(levelAt(i), tierFor(i), { tray: g.tray, score: g.score }), this.ranked);
  }

  /** Goes on from the player's save; false when there is none (nothing changes then). */
  continueSaved(): boolean {
    const save = this.savedGame();
    if (!save) return false;
    this.begin(IDS.indexOf(save.level), restore(save), save.ranked && !this.review);
    return true;
  }

  /** Call with the events of the last steps, before they are cleared. */
  handle(events: readonly GameEvent[]) {
    for (const e of events) {
      if (e === 'serve') { this.atServe = snapshot(this.game, this.ranked, this.now()); if (this.autosave) this.saveNow(); }
      if (e === 'won') this.levelCleared();
      if (e === 'over') this.finishRun();
    }
  }

  /** Keeps the game as it was at the start of the current ball. Needs a nickname. */
  saveNow(): boolean {
    if (!this.player || this.ended) return false;
    return writeSave(this.store, this.player, this.game.phase === 'won' ? this.nextStart() : this.atServe);
  }

  /** After a cleared level, a save means the start of the next one, with the score and balls carried over. */
  private nextStart(): SaveData {
    const g = this.game, next = this.index + 1;
    return snapshot(createGame(levelAt(next), tierFor(next), { tray: g.tray, score: g.score }), this.ranked, this.now());
  }

  private begin(index: number, game: Game, ranked = this.ranked) {
    this.index = index;
    this.ranked = ranked;
    this.game = game;
    this.recorded = false;
    this.newRecord = false;
    this.atServe = snapshot(game, ranked, this.now());
  }

  private levelCleared() {
    const r = this.game.result;
    if (!r) return;
    this.newRecord = recordLevel(this.progress, this.level.id, r.stars, r.total);
    storeProgress(this.store, this.player, this.progress);
    if (isLast(this.index)) this.finishRun();
    // the next level begins with its own save at its first ball; until then a save would bring back a cleared level
    else if (this.autosave) this.saveNow();
  }

  /** The end of a run (game over or the last level cleared): the result goes into the top 10, the save is no longer needed. */
  private finishRun() {
    if (this.recorded) return;
    this.recorded = true;
    if (!this.player) return;
    if (this.ranked) addToTop(this.store, this.player, this.game.score);
    clearSave(this.store, this.player);
  }
}
