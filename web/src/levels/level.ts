// The level format. A level is one or more blocks of bricks, each on its own grid, plus things on the field.
// Every cell of a row is a short token, separated by spaces:
//
//   .        empty               a … h    ordinary brick of colour 1 … 8; a digit after it is its strength: c3
//   #        steel (never breaks, not needed to finish)                 x        explosive
//   m3       changes shape on each hit (3 stages)                       s s< s>  shield: weak side up, left or right
//   r        grows back a while after it breaks                         i i2     invisible, flashes when hit
//   @20      the core: strength 20
//
// and "+L" after any breakable brick puts a bonus in it (letters in BONUS_CODES).
import { FIELD_H, FIELD_W, PADDLE_TOP } from '../rules/config';
import { cellPolygon, GRID_KINDS, GridKind, rowStep } from './grids';
import { clockwise, Poly } from './shapes';

export type BrickKind = 'normal' | 'steel' | 'explosive' | 'morph' | 'shield' | 'regen' | 'invisible' | 'core';
export type BonusKind = 'wide' | 'narrow' | 'slow' | 'fast' | 'second' | 'multi' | 'extra' | 'laser' | 'sticky' | 'comet' | 'shield' | 'bomb' | 'timebomb';

export const BONUS_CODES: Record<string, BonusKind> = {
  W: 'wide', N: 'narrow', S: 'slow', F: 'fast', B: 'second', M: 'multi', E: 'extra',
  L: 'laser', G: 'sticky', C: 'comet', D: 'shield', O: 'bomb', T: 'timebomb',
};
/** Bonuses that make the game harder for the player. */
export const HARMFUL: ReadonlySet<BonusKind> = new Set<BonusKind>(['narrow', 'fast']);

export interface Text2 { en: string; ru: string }
/** A moving row: x offset = amp · sin(time · speed + phase), speed in radians per second. */
export interface MoveSpec { amp: number; speed: number; phase: number }

export interface BrickSpec {
  poly: Poly;
  kind: BrickKind;
  hits: number;
  /** Colour index 0 … 7 in the world's palette. */
  color: number;
  bonus: BonusKind | null;
  /** For a shield brick: the direction its weak side faces (unit vector, y down). */
  weak: [number, number] | null;
  move: MoveSpec | null;
}

export interface Bumper { x: number; y: number; r: number }
export interface Portal { ax: number; ay: number; bx: number; by: number; r: number }
export interface Spinner { x: number; y: number; length: number; width: number; speed: number; angle: number }

export interface Level {
  id: string;
  tier: number;
  name: Text2;
  /** What this level brings that is new, shown when it starts. */
  intro: Text2;
  /** Seconds to beat for the third star and for the time bonus. */
  par: number;
  /** Seconds between steps of the creeping wall; 0 when the wall stays. */
  descend: number;
  /** How far the wall creeps in one step. */
  step: number;
  /** A start speed of the ball for this level instead of the tier's, or null. */
  startSpeed: number | null;
  bricks: BrickSpec[];
  bumpers: Bumper[];
  portals: Portal[];
  spinners: Spinner[];
}

export class LevelError extends Error {}

const ID = /^[1-3]-[1-8]$/;
const TOKEN = /^(\.|#|x|r|[a-h][2-9]?|m[2-4]?|s[<>]?|i[2-9]?|@\d{1,2})(\+[A-Z])?$/;
const fail = (where: string, what: string): never => { throw new LevelError(`${where}: ${what}`); };
const isNum = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

function text2(raw: unknown, where: string): Text2 {
  const t = raw as Partial<Text2> | null;
  if (!t || typeof t.en !== 'string' || !t.en.trim() || typeof t.ru !== 'string' || !t.ru.trim()) fail(where, 'needs an English and a Russian text');
  return { en: t!.en!, ru: t!.ru! };
}

/** Reads one cell token into a brick, or null for an empty cell. */
export function parseToken(token: string, poly: Poly, colourHint: number, where: string): BrickSpec | null {
  if (!TOKEN.test(token)) fail(where, `unknown cell "${token}"`);
  const [base, code] = token.split('+');
  const bonus = code ? BONUS_CODES[code] ?? fail(where, `unknown bonus "${code}"`) : null;
  if (base === '.') { if (bonus) fail(where, 'an empty cell cannot hold a bonus'); return null; }
  const digits = Number(base.slice(1)) || 0;
  const brick = (kind: BrickKind, hits: number, color = colourHint, weak: [number, number] | null = null): BrickSpec =>
    ({ poly: clockwise(poly), kind, hits, color, bonus, weak, move: null });
  switch (base[0]) {
    case '#': if (bonus) fail(where, 'a steel brick cannot hold a bonus'); return brick('steel', 1);
    case 'x': return brick('explosive', 1);
    case 'r': return brick('regen', 1);
    case 'm': return brick('morph', digits || 3);
    case 's': return brick('shield', 1, colourHint, base[1] === '<' ? [-1, 0] : base[1] === '>' ? [1, 0] : [0, -1]);
    case 'i': return brick('invisible', digits || 1);
    case '@': if (digits < 2) fail(where, 'the core needs a strength of 2 or more'); return brick('core', digits);
    default: return brick('normal', digits || 1, base.charCodeAt(0) - 97);
  }
}

interface BlockJson { grid: GridKind; cell: number[]; top: number; rows: string[] }
interface MovingJson { block: number; row: number; amp: number; speed: number; phase?: number }

export function parseLevel(json: unknown): Level {
  const d = json as Record<string, unknown> | null;
  if (!d || typeof d.id !== 'string' || !ID.test(d.id)) throw new LevelError('a level needs an id like "1-3"');
  const id = d.id;
  const tier = Number(id[0]);
  if (d.tier !== tier) fail(id, 'the tier must match the id');
  const name = text2(d.name, id + ' name'), intro = text2(d.intro, id + ' intro');
  if (!isNum(d.par, 10, 3600)) fail(id, 'par must be seconds');
  const descend = d.descend === undefined ? 0 : d.descend;
  if (!isNum(descend, 0, 600)) fail(id, 'descend must be seconds or 0');
  if (!Array.isArray(d.blocks) || d.blocks.length === 0) fail(id, 'a level needs blocks of bricks');
  if (d.startSpeed !== undefined && !isNum(d.startSpeed, 300, 2000)) fail(id, 'startSpeed must be a speed');

  const blocks = d.blocks as BlockJson[];
  const moving = (Array.isArray(d.moving) ? d.moving : []) as MovingJson[];
  const bricks: BrickSpec[] = [];
  blocks.forEach((block, bi) => {
    const where = `${id} block ${bi + 1}`;
    if (!GRID_KINDS.includes(block.grid)) fail(where, `unknown grid "${block.grid}"`);
    if (!Array.isArray(block.cell) || !block.cell.every((v) => isNum(v, 0, 400))) fail(where, 'cell sizes must be numbers');
    if (!isNum(block.top, 0, FIELD_H)) fail(where, 'top must be inside the field');
    if (!Array.isArray(block.rows) || block.rows.length === 0) fail(where, 'a block needs rows');
    const grid = block.rows.map((line) => (typeof line === 'string' ? line.trim().split(/\s+/) : fail(where, 'rows are strings')));
    const cols = grid[0].length;
    if (!grid.every((r) => r.length === cols)) fail(where, 'all rows of a block need the same number of cells');
    const spec = { grid: block.grid, cell: block.cell, top: block.top, cols, rows: grid.length };
    grid.forEach((row, ri) => row.forEach((token, ci) => {
      const b = parseToken(token, cellPolygon(spec, ci, ri), (bi * 3 + ri) % 8, `${where} row ${ri + 1} cell ${ci + 1}`);
      if (!b) return;
      const m = moving.find((mv) => mv.block === bi && mv.row === ri);
      if (m) b.move = { amp: m.amp, speed: m.speed, phase: m.phase ?? 0 };
      bricks.push(b);
    }));
  });
  moving.forEach((m) => {
    if (!blocks[m.block] || !blocks[m.block].rows[m.row]) fail(id, 'a moving row must point at an existing row');
    if (!isNum(m.amp, 1, 400) || !isNum(m.speed, 0.05, 6)) fail(id, 'a moving row needs an amplitude and a speed');
  });
  if (!bricks.some((b) => b.kind !== 'steel')) fail(id, 'a level needs at least one brick that breaks');

  const objects = (Array.isArray(d.objects) ? d.objects : []) as Record<string, number | string>[];
  const inField = (x: unknown, y: unknown) => isNum(x, 0, FIELD_W) && isNum(y, 0, PADDLE_TOP - 60);
  const bumpers: Bumper[] = [], portals: Portal[] = [], spinners: Spinner[] = [];
  for (const o of objects) {
    if (o.type === 'bumper' && inField(o.x, o.y) && isNum(o.r, 10, 120)) bumpers.push({ x: +o.x, y: +o.y, r: +o.r });
    else if (o.type === 'portal' && inField(o.ax, o.ay) && inField(o.bx, o.by) && isNum(o.r, 16, 80)) portals.push({ ax: +o.ax, ay: +o.ay, bx: +o.bx, by: +o.by, r: +o.r });
    else if (o.type === 'spinner' && inField(o.x, o.y) && isNum(o.length, 40, 500) && isNum(o.width, 8, 60) && isNum(o.speed, -6, 6)) {
      spinners.push({ x: +o.x, y: +o.y, length: +o.length, width: +o.width, speed: +o.speed, angle: Number(o.angle) || 0 });
    } else fail(id, `a field object is not right: ${JSON.stringify(o)}`);
  }
  return { id, tier, name, intro, par: d.par as number, descend: descend as number, step: rowStep(blocks[0]), startSpeed: (d.startSpeed as number | undefined) ?? null, bricks, bumpers, portals, spinners };
}
