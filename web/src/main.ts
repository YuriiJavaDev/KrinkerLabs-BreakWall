import { Session } from './app/session';
import { Sound } from './audio/sound';
import { Controls, screenToField } from './input/controls';
import { MouseLock } from './input/mouseLock';
import { isTierEnd, levelAt, tierFor, tierStart } from './levels/catalog';
import { startLens } from './render/lens';
import { Renderer } from './render/renderer';
import { FixedStep, STEP_DT } from './rules/loop';
import { skipLevel } from './rules/finish';
import { step } from './rules/step';
import { browserStore, readFlag, writeFlag } from './storage/kv';
import { boardRows, renderBoard } from './ui/board';
import { anyDialogOpen, LeaveDialog, WhoDialog } from './ui/dialogs';
import { Hud } from './ui/hud';
import { COMPACT_QUERY, mover } from './ui/layout';
import { LevelMap } from './ui/map';
import { Screens } from './ui/screens';
import { formatScore, pickLanguage, TEXTS, TextKey } from './ui/texts';
import { Toast } from './ui/toast';

const SITE_URL = 'https://krinkerlabs.com';
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- language: every visible string comes from texts.ts
const language = pickLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
const t = TEXTS[language];
document.documentElement.lang = language;
document.title = t.title;
const text = (key: string | undefined) => t[key as TextKey] ?? '';
document.querySelectorAll<HTMLElement>('[data-text]').forEach((el) => { el.textContent = text(el.dataset.text); });
document.querySelectorAll<HTMLElement>('[data-title]').forEach((el) => { el.title = text(el.dataset.title); });
document.querySelectorAll<HTMLElement>('[data-label]').forEach((el) => { el.setAttribute('aria-label', text(el.dataset.label)); el.title = text(el.dataset.label); });
document.querySelectorAll<HTMLInputElement>('[data-placeholder]').forEach((el) => { el.placeholder = text(el.dataset.placeholder); });

// ---- the parts. "#review" in the address opens every level, for checking the game.
const store = browserStore();
const session = new Session(store, location.hash === '#review');
const sound = new Sound(readFlag(store, 'sound', true));
const renderer = new Renderer(byId<HTMLCanvasElement>('field'));
const hud = new Hud(t, language);
const loop = new FixedStep();
const toast = new Toast(byId('toast'));
let paused = false;

const leave = () => { window.location.href = SITE_URL; };
const levelMap = new LevelMap(session, t, language, (index) => start(index));
const screens = new Screens(t, language, { map: () => levelMap.open() });
const who = new WhoDialog(session, store, t, formatScore, {
  onStart: (kind) => { if (kind === 'continue' && session.continueSaved()) begun(); else start(0); },
  onPlayer: showPlayer,
  onMap: () => levelMap.open(),
});
const leaveDialog = new LeaveDialog(session, who, t, leave);

// ---- input: while a ball is served or in play, the mouse is held by the paddle; a pause, a window or a screen frees it
const stage = byId('stage');
const active = () => !session.ended && session.game.phase !== 'won' && !anyDialogOpen();
const mouseLock = new MouseLock(stage, () => { if (active() && !paused) setPaused(true); });
let usesTouch = false;
stage.addEventListener('pointerdown', (e) => { usesTouch = e.pointerType !== 'mouse'; }, { capture: true });
const holdMouse = () => { if (active() && !paused && !usesTouch) mouseLock.lock(); };
const controls = new Controls(stage, mouseLock, {
  toFieldX: (x) => { const b = renderer.fieldBox; return screenToField(x, b.left, b.scale); },
  scale: () => renderer.fieldBox.scale,
  paddleHalf: () => session.game.paddle.w / 2,
  onLaunchGesture: () => { sound.unlock(); holdMouse(); },
  onPause: () => setPaused(!paused),
  onSound: toggleSound,
  onLeave: openLeave,
  blocked: () => anyDialogOpen() || screens.visible,
  paused: () => paused,
});

function openLeave() { mouseLock.release(); leaveDialog.open(); }
function openWho(then: (() => void) | null = null) { mouseLock.release(); who.open('name', then); }

/** A new run from a level (the map, a new game, the tier again). */
function start(index: number) { session.startAt(index); begun(); }

/** Whatever game the session now has starts clean on the screen. */
function begun() {
  paused = false; loop.reset(); controls.dropLaunch(); controls.resetPointer();
  hud.reset(); screens.hide(); toast.hide();
  sound.setWorld(session.game.tier.world);
  showBoard();
}

/** A pause frees the mouse; going on takes it again (the key press that ends the pause lets the browser do that). */
function setPaused(value: boolean) {
  paused = value && active();
  loop.reset(); controls.dropLaunch(); controls.resetPointer();
  if (paused) mouseLock.release(); else holdMouse();
}

/** The end of a level, of a lost game or of the whole game: the screen over the table. */
function showEnd() {
  mouseLock.release();
  const g = session.game, i = session.index;
  if (g.phase === 'over') { screens.over(g.score, levelAt(tierStart(i)).id, () => { session.restartTier(); begun(); }); return; }
  if (!g.result) return;
  if (session.gameCompleted) { screens.complete(g.result, g.score, session.totalStars(), () => start(0)); return; }
  const nextTier = isTierEnd(i) ? tierFor(i + 1) : null;
  screens.cleared(g.level, g.result, g.score, session.newRecord, levelAt(i + 1), nextTier, g.tier, () => { session.nextLevel(); begun(); });
}

/** Names of caught bonuses, and hints the first time something new happens. */
function explain(events: readonly string[]) {
  const g = session.game;
  if (g.lastBonus) {
    if (g.lastBonus === 'timebomb') toast.show(t.bombHint); else toast.show(t[`bonus_${g.lastBonus}` as TextKey]);
    g.lastBonus = null;
  }
  if (events.includes('steel')) toast.once('steel', t.steelHint);
  if (events.includes('clank')) toast.once('shield', t.shieldHint);
  if (events.includes('stun')) toast.show(t.stunHint);
  if (events.includes('crush')) toast.show(t.crushHint);
}

// ---- left panel: the player, autosave, save, the map, the top 10
const savedNote = byId('savedNote');
let noteTimer = 0;
function note(message: string) {
  savedNote.textContent = message;
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => { savedNote.textContent = ''; }, 2500);
}
function showPlayer() { byId('who').textContent = session.player || t.noName; showBoard(); hud.reset(); }
function showBoard() { renderBoard(byId('board'), boardRows(session.top(), session.player, formatScore)); }

const autosaveBox = byId<HTMLInputElement>('autosave');
autosaveBox.checked = session.autosave;
autosaveBox.addEventListener('change', () => session.setAutosave(autosaveBox.checked));
byId('who').addEventListener('click', () => openWho());
byId('save').addEventListener('click', () => {
  if (!session.player) { openWho(() => note(session.saveNow() ? t.saved : t.saveFailed)); return; }
  note(session.saveNow() ? t.saved : t.saveFailed);
});

// ---- right panel: pause, sound, leave
const soundButton = byId('sound');
function showSound() { byId('soundLabel').textContent = sound.enabled ? t.soundOn : t.soundOff; soundButton.setAttribute('aria-pressed', String(sound.enabled)); }
function toggleSound() { sound.enabled = !sound.enabled; writeFlag(store, 'sound', sound.enabled); sound.unlock(); showSound(); }
soundButton.addEventListener('click', toggleSound);
byId('pause').addEventListener('click', () => setPaused(!paused));
byId('leave').addEventListener('click', openLeave);
byId('leaveCompact').addEventListener('click', openLeave);
// the review mode only: N clears the level at once, to look through all levels and their screens quickly
if (session.review) window.addEventListener('keydown', (e) => { if (e.code === 'KeyN' && !anyDialogOpen() && !screens.visible) skipLevel(session.game); });
document.addEventListener('visibilitychange', () => { if (document.hidden && session.game.phase === 'play') setPaused(true); });

// ---- the phone layout: the top 10, the player, the help and the legal lines go into the menu
const menu = byId('menuDialog');
const toMenu = mover([[byId('playerPanel'), byId('slotPlayer')], [byId('boardPanel'), byId('slotBoard')], [byId('helpPanel'), byId('slotHelp')], [byId('legal'), byId('slotLegal')]]);
const compactQuery = matchMedia(COMPACT_QUERY);
function applyLayout() { document.body.classList.toggle('compact', compactQuery.matches); toMenu(compactQuery.matches); if (!compactQuery.matches) menu.hidden = true; }
compactQuery.addEventListener('change', applyLayout);
byId('menuOpen').addEventListener('click', () => { mouseLock.release(); menu.hidden = false; });
byId('menuClose').addEventListener('click', () => { menu.hidden = true; });
menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.hidden = true; });
byId('mapOpen').addEventListener('click', () => { mouseLock.release(); menu.hidden = true; levelMap.open(); });

// ---- the frame loop
let last = performance.now();
function frame(now: number) {
  const seconds = Math.min(0.25, (now - last) / 1000);
  last = now;
  const game = session.game, frozen = paused || anyDialogOpen();
  if (frozen) loop.reset();
  const blend = frozen ? 1 : loop.advance(seconds, () => step(session.game, controls.next(session.game.paddle.x, STEP_DT), STEP_DT));
  if (game.events.length) {
    session.handle(game.events);
    for (const e of game.events) sound.play(e, game.combo);
    explain(game.events);
    if (game.events.includes('won') || game.events.includes('over')) { showEnd(); showBoard(); }
    game.events.length = 0;
  }
  renderer.draw(session.game, blend, now / 1000, frozen ? 0 : seconds);
  hud.update(session.game, paused, session.stars(session.index), session.totalStars());
  requestAnimationFrame(frame);
}

applyLayout();
showPlayer();
showSound();
startLens(byId<HTMLCanvasElement>('stars'));
who.open('start');
requestAnimationFrame(frame);
