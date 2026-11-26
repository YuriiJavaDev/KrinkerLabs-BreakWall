// Every string the player sees, in one place. A new language is a new block with the same keys.

const en = {
  title: 'KrinkerLabs BreakWall',
  score: 'Score',
  lives: 'Lives',
  pause: 'Pause',
  resume: 'Resume',
  soundOn: 'Sound: on',
  soundOff: 'Sound: off',
  back: 'Back to krinkerlabs.com',
  bug: 'Found a bug? Tell us',
  beta: 'Beta version: the game is still being tested',
  serve: 'Click or tap to launch the ball',
  serveKeys: 'Move: mouse, finger or ← →  ·  launch: click, tap or Space  ·  pause: P',
  paused: 'Paused',
  won: 'Wall broken!',
  over: 'Game over',
  again: 'Play again',
  finalScore: 'Score',
  legal: '© 2026 Yurii Pavlenko. Free to play; copying, selling and republishing are not allowed. KrinkerLabs™ is a trademark of Yurii Pavlenko.',
};

export type TextKey = keyof typeof en;
export type Texts = Record<TextKey, string>;

const ru: Texts = {
  title: 'KrinkerLabs BreakWall',
  score: 'Очки',
  lives: 'Жизни',
  pause: 'Пауза',
  resume: 'Продолжить',
  soundOn: 'Звук: вкл',
  soundOff: 'Звук: выкл',
  back: 'На krinkerlabs.com',
  bug: 'Нашли ошибку? Напишите',
  beta: 'Бета-версия: игра ещё проверяется',
  serve: 'Щёлкните или коснитесь, чтобы запустить мяч',
  serveKeys: 'Ракетка: мышь, палец или ← →  ·  запуск: щелчок, касание или пробел  ·  пауза: P',
  paused: 'Пауза',
  won: 'Стена разбита!',
  over: 'Игра окончена',
  again: 'Ещё раз',
  finalScore: 'Очки',
  legal: '© 2026 Юрий Павленко. Играть бесплатно; копировать, продавать и выкладывать заново нельзя. KrinkerLabs™ — товарный знак Юрия Павленко.',
};

export const TEXTS = { en, ru } as const;
export type Language = keyof typeof TEXTS;

/** The first browser language we have, Russian or English; English when none of them fits. */
export function pickLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'ru' || base === 'en') return base;
  }
  return 'en';
}
