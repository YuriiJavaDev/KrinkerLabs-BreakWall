// One sitting of the game: the player, the game in progress, saving at the start of each ball, the top 10 at the end.
// No DOM here: the page asks and shows, this decides.
import { Level } from '../levels/level';
import { createGame, Game, GameEvent } from '../rules/state';
import { addToTop, Entry, loadTop } from '../scores/top10';
import { KeyValueStore } from '../storage/kv';
import { loadAutosave, loadPlayer, rememberPlayer, storeAutosave } from '../storage/players';
import { clearSave, readSave, restore, SaveData, snapshot, writeSave } from '../storage/save';

export class Session {
  game: Game;
  player: string;
  autosave: boolean;
  /** The game at the start of the current ball: this is what a save keeps. */
  private atServe: SaveData;
  private recorded = false;

  constructor(private store: KeyValueStore | null, private level: Level, private levelIndex: number, private now = () => Date.now()) {
    this.player = loadPlayer(store);
    this.autosave = loadAutosave(store);
    this.game = createGame(level);
    this.atServe = snapshot(this.game, levelIndex, now());
  }

  /** The saved game of a player, if there is a good one. */
  savedGame(player = this.player): SaveData | null { return readSave(this.store, player, this.level, this.levelIndex); }

  setPlayer(raw: string): string { this.player = rememberPlayer(this.store, raw); return this.player; }
  clearPlayer() { this.player = ''; }

  setAutosave(on: boolean) { this.autosave = on; storeAutosave(this.store, on); }

  startNew() { this.begin(createGame(this.level)); }

  /** Goes on from the player's save; false (and a new game) when there is none. */
  continueSaved(): boolean {
    const save = this.savedGame();
    this.begin(save ? restore(this.level, save) : createGame(this.level));
    return !!save;
  }

  /** Call with the events of the last steps, before they are cleared. */
  handle(events: readonly GameEvent[]) {
    for (const e of events) {
      if (e === 'serve') { this.atServe = snapshot(this.game, this.levelIndex, this.now()); if (this.autosave) this.saveNow(); }
      if (e === 'won' || e === 'over') this.finish();
    }
  }

  /** Keeps the game as it was at the start of the current ball. Needs a nickname. */
  saveNow(): boolean {
    if (!this.player || this.ended) return false;
    return writeSave(this.store, this.player, this.atServe);
  }

  get ended() { return this.game.phase === 'won' || this.game.phase === 'over'; }

  /** True once something would be lost by leaving: points scored or bricks broken. */
  get hasProgress() { return !this.ended && (this.game.score > 0 || this.game.bricksLeft < this.game.bricks.length); }

  top(): Entry[] { return loadTop(this.store); }

  private begin(game: Game) {
    this.game = game;
    this.recorded = false;
    this.atServe = snapshot(game, this.levelIndex, this.now());
  }

  /** The end of a game: the result goes into the top 10 under the player's name, and the save is no longer needed. */
  private finish() {
    if (this.recorded) return;
    this.recorded = true;
    if (!this.player) return;
    addToTop(this.store, this.player, this.game.score);
    clearSave(this.store, this.player);
  }
}
