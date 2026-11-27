import { levelBonus, levelStars } from './score';
import { Game } from './state';

/** The last brick that counts is broken: the level is cleared, the stars and the end bonus are worked out once. */
export function finishLevel(g: Game) {
  if (g.phase === 'won' || g.phase === 'over') return;
  const stars = levelStars(g.lost, g.time, g.level.par);
  const { timeBonus, ballsBonus } = levelBonus(g.time, g.level.par, g.tray, g.tier.multiplier);
  g.score += timeBonus + ballsBonus;
  g.result = { stars, time: g.time, lost: g.lost, bricks: g.levelPoints, timeBonus, ballsBonus, total: g.levelPoints + timeBonus + ballsBonus };
  g.phase = 'won';
  g.capsules.length = 0;
  g.shots.length = 0;
  g.events.push('won');
}

/** For checking the game only (the review mode): every brick that counts breaks at once and the level is cleared. */
export function skipLevel(g: Game) {
  if (g.phase !== 'serve' && g.phase !== 'play') return;
  for (const b of g.bricks) if (b.kind !== 'steel') { b.hits = 0; b.regenAt = 0; }
  g.bricksLeft = 0;
  finishLevel(g);
}
