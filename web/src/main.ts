import levels from '../data/levels.json';
import { Sound } from './audio/sound';
import { Controls, screenToField } from './input/controls';
import { parseLevel } from './levels/level';
import { startLens } from './render/lens';
import { Renderer } from './render/renderer';
import { FixedStep, STEP_DT } from './rules/loop';
import { createGame, Game } from './rules/state';
import { step } from './rules/step';
import { Hud } from './ui/hud';
import { browserStore, readFlag, writeFlag } from './ui/storage';
import { pickLanguage, TEXTS, TextKey } from './ui/texts';

const language = pickLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
const texts = TEXTS[language];
document.documentElement.lang = language;
document.title = texts.title;
document.querySelectorAll<HTMLElement>('[data-text]').forEach((el) => { el.textContent = texts[el.dataset.text as TextKey]; });
document.querySelectorAll<HTMLElement>('[data-title]').forEach((el) => { el.title = texts[el.dataset.title as TextKey]; });

const level = parseLevel(levels[0]);
const store = browserStore();
const sound = new Sound(readFlag(store, 'sound', true));
const renderer = new Renderer(document.getElementById('field') as HTMLCanvasElement);
const hud = new Hud(texts, language);
const loop = new FixedStep();
let game: Game = createGame(level);
let paused = false;

const stage = document.getElementById('stage')!;
const controls = new Controls(stage, {
  toFieldX: (x) => { const b = renderer.fieldBox; return screenToField(x, b.left, b.scale); },
  onLaunchGesture: () => { sound.unlock(); if (paused) setPaused(false); },
  onPause: () => setPaused(!paused),
});

function setPaused(value: boolean) {
  if (game.phase === 'won' || game.phase === 'over') value = false;
  paused = value;
  loop.reset();
  controls.dropLaunch();
}

function restart() { game = createGame(level); paused = false; loop.reset(); controls.dropLaunch(); }

const soundButton = document.getElementById('sound') as HTMLButtonElement;
const showSound = () => { soundButton.textContent = sound.enabled ? texts.soundOn : texts.soundOff; soundButton.setAttribute('aria-pressed', String(sound.enabled)); };
soundButton.addEventListener('click', () => { sound.enabled = !sound.enabled; writeFlag(store, 'sound', sound.enabled); sound.unlock(); showSound(); });
document.getElementById('pause')!.addEventListener('click', () => setPaused(!paused));
document.getElementById('again')!.addEventListener('click', () => { sound.unlock(); restart(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.phase === 'play') setPaused(true); });
showSound();

let last = performance.now();
function frame(now: number) {
  const seconds = (now - last) / 1000;
  last = now;
  const blend = paused ? 1 : loop.advance(seconds, () => step(game, controls.next(game.paddle.x, STEP_DT), STEP_DT));
  for (const e of game.events) sound.play(e, game.combo);
  game.events.length = 0;
  renderer.draw(game, blend);
  hud.update(game, paused);
  requestAnimationFrame(frame);
}

startLens(document.getElementById('stars') as HTMLCanvasElement);
requestAnimationFrame(frame);
