import levels from '../data/levels.json';
import { Session } from './app/session';
import { Sound } from './audio/sound';
import { Controls, screenToField } from './input/controls';
import { parseLevel } from './levels/level';
import { startLens } from './render/lens';
import { Renderer } from './render/renderer';
import { FixedStep, STEP_DT } from './rules/loop';
import { step } from './rules/step';
import { browserStore, readFlag, writeFlag } from './storage/kv';
import { boardRows, renderBoard } from './ui/board';
import { anyDialogOpen, LeaveDialog, WhoDialog } from './ui/dialogs';
import { Hud } from './ui/hud';
import { COMPACT_QUERY, mover } from './ui/layout';
import { pickLanguage, TEXTS, TextKey } from './ui/texts';

const SITE_URL = 'https://krinkerlabs.com';
const LEVEL_INDEX = 0;
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

// ---- the parts
const level = parseLevel(levels[LEVEL_INDEX]);
const store = browserStore();
const session = new Session(store, level, LEVEL_INDEX);
const sound = new Sound(readFlag(store, 'sound', true));
const renderer = new Renderer(byId<HTMLCanvasElement>('field'));
const hud = new Hud(t, language);
const loop = new FixedStep();
let paused = false;

const leave = () => { window.location.href = SITE_URL; };
const who = new WhoDialog(session, store, t, (n) => hud.format(n), { onStart: start, onPlayer: showPlayer });
const leaveDialog = new LeaveDialog(session, who, t, leave);

const stage = byId('stage');
const controls = new Controls(stage, {
  toFieldX: (x) => { const b = renderer.fieldBox; return screenToField(x, b.left, b.scale); },
  onLaunchGesture: () => { sound.unlock(); if (paused) setPaused(false); },
  onPause: () => setPaused(!paused),
  onSound: toggleSound,
  onLeave: () => leaveDialog.open(),
  blocked: anyDialogOpen,
});

function start(kind: 'new' | 'continue') {
  if (kind === 'continue') session.continueSaved(); else session.startNew();
  paused = false; loop.reset(); controls.dropLaunch(); hud.reset(); showBoard();
}

function setPaused(value: boolean) {
  paused = value && !session.ended;
  loop.reset(); controls.dropLaunch();
}

// ---- left panel: the player, autosave, save, the top 10
const savedNote = byId('savedNote');
let noteTimer = 0;
function note(message: string) {
  savedNote.textContent = message;
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => { savedNote.textContent = ''; }, 2500);
}
function showPlayer() { byId('who').textContent = session.player || t.noName; showBoard(); }
function showBoard() { renderBoard(byId('board'), boardRows(session.top(), session.player, (n) => hud.format(n))); }

const autosaveBox = byId<HTMLInputElement>('autosave');
autosaveBox.checked = session.autosave;
autosaveBox.addEventListener('change', () => session.setAutosave(autosaveBox.checked));
byId('who').addEventListener('click', () => who.open('name'));
byId('save').addEventListener('click', () => {
  if (!session.player) { who.open('name', () => note(session.saveNow() ? t.saved : t.saveFailed)); return; }
  note(session.saveNow() ? t.saved : t.saveFailed);
});

// ---- right panel: pause, sound, leave
const soundButton = byId('sound');
function showSound() { byId('soundLabel').textContent = sound.enabled ? t.soundOn : t.soundOff; soundButton.setAttribute('aria-pressed', String(sound.enabled)); }
function toggleSound() { sound.enabled = !sound.enabled; writeFlag(store, 'sound', sound.enabled); sound.unlock(); showSound(); }
soundButton.addEventListener('click', toggleSound);
byId('pause').addEventListener('click', () => setPaused(!paused));
byId('leave').addEventListener('click', () => leaveDialog.open());
byId('leaveCompact').addEventListener('click', () => leaveDialog.open());
byId('again').addEventListener('click', () => { sound.unlock(); start('new'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && session.game.phase === 'play') setPaused(true); });

// ---- the phone layout: the top 10, the player, the help and the legal lines go into the menu
const menu = byId('menuDialog');
const toMenu = mover([[byId('playerPanel'), byId('slotPlayer')], [byId('boardPanel'), byId('slotBoard')], [byId('helpPanel'), byId('slotHelp')], [byId('legal'), byId('slotLegal')]]);
const compactQuery = matchMedia(COMPACT_QUERY);
function applyLayout() { document.body.classList.toggle('compact', compactQuery.matches); toMenu(compactQuery.matches); if (!compactQuery.matches) menu.hidden = true; }
compactQuery.addEventListener('change', applyLayout);
byId('menuOpen').addEventListener('click', () => { menu.hidden = false; });
byId('menuClose').addEventListener('click', () => { menu.hidden = true; });
menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.hidden = true; });

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
    if (game.events.includes('won') || game.events.includes('over')) showBoard();
    game.events.length = 0;
  }
  renderer.draw(session.game, blend, now / 1000);
  hud.update(session.game, paused);
  requestAnimationFrame(frame);
}

applyLayout();
showPlayer();
showSound();
startLens(byId<HTMLCanvasElement>('stars'));
who.open('start');
requestAnimationFrame(frame);
