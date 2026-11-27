// Painting one brick: its shape in the world's style, and what it is (steel, explosive, shield, regrowing, core),
// its strength as a number, cracks, and the picture of the bonus inside.
import { Brick } from '../rules/state';
import { drawIcon, bonusColour, shade } from './icons';
import { World } from './worlds';

type G = CanvasRenderingContext2D;

function path(g: G, p: ArrayLike<number>) {
  g.beginPath();
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.closePath();
}

/** The colour a brick is painted in. */
export function brickColour(b: Brick, w: World): string {
  if (b.kind === 'steel') return w.steel[0];
  if (b.kind === 'explosive') return w.explosive;
  if (b.kind === 'core') return '#ff9f1a';
  return w.bricks[b.color % w.bricks.length];
}

/**
 * Paints the brick's current shape with its top-left corner moved to (0, 0) plus `pad`.
 * The renderer keeps the picture until the brick's look changes.
 */
export function paintBrick(g: G, b: Brick, w: World, pad: number) {
  const shape = b.shapes[b.stage];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < shape.length; i += 2) { x0 = Math.min(x0, shape[i]); x1 = Math.max(x1, shape[i]); y0 = Math.min(y0, shape[i + 1]); y1 = Math.max(y1, shape[i + 1]); }
  const p = shape.map((v, i) => v - (i % 2 === 0 ? x0 : y0) + pad);
  const width = x1 - x0, height = y1 - y0, cx = pad + width / 2, cy = pad + height / 2, size = Math.min(width, height);
  const colour = brickColour(b, w);

  if (b.kind === 'steel') paintSteel(g, p, w, cx, cy, width, height);
  else if (b.kind === 'core') paintCore(g, p, cx, cy, Math.max(width, height) / 2);
  else if (w.style === 'neon') paintNeon(g, p, colour, cx, cy);
  else if (w.style === 'crystal') paintCrystal(g, p, colour, cx, cy);
  else paintGlass(g, p, colour, height);

  if (b.kind === 'explosive') paintBurst(g, cx, cy, size * 0.34);
  if (b.kind === 'regen') paintRegrow(g, cx, cy, size * 0.26);
  if (b.kind === 'shield' && b.weak) paintArmour(g, p, b.weak);
  if (b.hits < b.maxHits && b.kind !== 'core') paintCracks(g, p, cx, cy, b.maxHits - b.hits, b.color);
  if (b.bonus) {
    const r = Math.min(size * 0.36, 15), c = bonusColour(b.bonus);
    g.save(); g.shadowColor = c; g.shadowBlur = 10;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = 'rgba(10,6,24,0.75)'; g.fill();
    g.restore();
    g.lineWidth = 1.6; g.strokeStyle = c; g.stroke();
    drawIcon(g, b.bonus, cx, cy, r * 1.5, c);
  }
  if (b.maxHits > 1 && b.kind !== 'steel') paintNumber(g, String(b.hits), b.bonus ? cx + Math.min(width / 2 - 12, 24) : cx, cy, b.kind === 'core' ? size * 0.42 : Math.min(26, size * 0.5));
}

function paintGlass(g: G, p: number[], colour: string, height: number) {
  path(g, p); g.fillStyle = colour; g.fill();
  const top = Math.min(...p.filter((_, i) => i % 2 === 1));
  const light = g.createLinearGradient(0, top, 0, top + height);
  light.addColorStop(0, 'rgba(255,255,255,0.5)'); light.addColorStop(0.42, 'rgba(255,255,255,0.06)'); light.addColorStop(1, 'rgba(0,0,0,0.38)');
  path(g, p); g.fillStyle = light; g.fill();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.45)'; path(g, p); g.stroke();
}

function paintNeon(g: G, p: number[], colour: string, cx: number, cy: number) {
  path(g, p); g.fillStyle = 'rgba(8,10,34,0.92)'; g.fill();
  const inner = g.createRadialGradient(cx, cy, 2, cx, cy, 60);
  inner.addColorStop(0, shade(colour, -0.35) + 'cc'); inner.addColorStop(1, shade(colour, -0.75) + '66');
  path(g, p); g.fillStyle = inner; g.fill();
  g.save(); g.shadowColor = colour; g.shadowBlur = 12;
  g.lineWidth = 3; g.strokeStyle = colour; path(g, p); g.stroke();
  g.restore();
  g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.75)'; path(g, p); g.stroke();
}

function paintCrystal(g: G, p: number[], colour: string, cx: number, cy: number) {
  // facets: a triangle from the centre to each edge, lighter towards the top-left, darker towards the bottom-right
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length, mx = (p[i] + p[j]) / 2 - cx, my = (p[i + 1] + p[j + 1]) / 2 - cy;
    const lit = -(mx + my) / (Math.hypot(mx, my) || 1);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(p[i], p[i + 1]); g.lineTo(p[j], p[j + 1]); g.closePath();
    g.fillStyle = shade(colour, lit * 0.35); g.fill();
  }
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < p.length; i += 2) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(p[i], p[i + 1]); g.stroke(); }
  g.lineWidth = 2; g.strokeStyle = shade(colour, 0.5); path(g, p); g.stroke();
}

function paintSteel(g: G, p: number[], w: World, cx: number, cy: number, width: number, height: number) {
  const metal = g.createLinearGradient(cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2);
  metal.addColorStop(0, w.steel[0]); metal.addColorStop(0.5, shade(w.steel[0], -0.25)); metal.addColorStop(1, w.steel[1]);
  path(g, p); g.fillStyle = metal; g.fill();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.55)'; path(g, p); g.stroke();
  // rivets near the corners, pulled towards the centre so they sit inside any shape
  for (let i = 0; i < p.length; i += 2) {
    const rx = cx + (p[i] - cx) * 0.72, ry = cy + (p[i + 1] - cy) * 0.72;
    g.beginPath(); g.arc(rx, ry, 3, 0, Math.PI * 2); g.fillStyle = w.steel[1]; g.fill();
    g.beginPath(); g.arc(rx - 0.8, ry - 0.8, 1.2, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
  }
}

function paintCore(g: G, p: number[], cx: number, cy: number, r: number) {
  const hot = g.createRadialGradient(cx, cy, 4, cx, cy, r);
  hot.addColorStop(0, '#fffbe6'); hot.addColorStop(0.35, '#ffd27a'); hot.addColorStop(0.7, '#ff6a1a'); hot.addColorStop(1, '#7a1406');
  path(g, p); g.fillStyle = hot; g.fill();
  g.save(); g.shadowColor = '#ff8a1a'; g.shadowBlur = 24; g.lineWidth = 4; g.strokeStyle = '#ffb347'; path(g, p); g.stroke(); g.restore();
}

/** The explosive mark: a ring of short rays. */
function paintBurst(g: G, cx: number, cy: number, r: number) {
  g.save(); g.strokeStyle = '#2a0a00'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
  g.beginPath(); g.arc(cx, cy, r * 0.32, 0, Math.PI * 2); g.fillStyle = '#2a0a00'; g.fill();
  g.restore();
}

/** The regrowing mark: an arrow going round. */
function paintRegrow(g: G, cx: number, cy: number, r: number) {
  g.save(); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy, r, -Math.PI * 0.2, Math.PI * 1.4); g.stroke();
  const a = Math.PI * 1.4, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
  g.beginPath(); g.moveTo(x - 5, y - 2); g.lineTo(x, y); g.lineTo(x + 1, y - 6); g.stroke();
  g.restore();
}

/** Armour: thick dark metal on every edge except the weak side, which glows gold. */
function paintArmour(g: G, p: number[], weak: [number, number]) {
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length, ex = p[j] - p[i], ey = p[j + 1] - p[i + 1], len = Math.hypot(ex, ey) || 1;
    const isWeak = (ey / len) * weak[0] + (-ex / len) * weak[1] > 0.5;
    g.beginPath(); g.moveTo(p[i], p[i + 1]); g.lineTo(p[j], p[j + 1]);
    if (isWeak) { g.shadowColor = '#ffd166'; g.shadowBlur = 14; g.lineWidth = 6; g.strokeStyle = '#ffe08a'; }
    else { g.shadowBlur = 0; g.lineWidth = 10; g.strokeStyle = '#4a5163'; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#d7dde8'; }
    g.stroke();
  }
  g.restore();
}

/** Cracks grow with each hit; their pattern depends on the brick, so it does not jump between frames. */
function paintCracks(g: G, p: number[], cx: number, cy: number, count: number, salt: number) {
  g.save(); g.strokeStyle = 'rgba(20,8,30,0.65)'; g.lineWidth = 1.6;
  let s = 31 + salt * 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < count * 2; k++) {
    const i = Math.floor(rnd() * (p.length / 2)) * 2;
    let x = cx + (rnd() - 0.5) * 8, y = cy + (rnd() - 0.5) * 8;
    g.beginPath(); g.moveTo(x, y);
    for (let step = 0; step < 3; step++) { x += (p[i] - x) * 0.35 + (rnd() - 0.5) * 6; y += (p[i + 1] - y) * 0.35 + (rnd() - 0.5) * 6; g.lineTo(x, y); }
    g.stroke();
  }
  g.restore();
}

/** The strength as a large number with a dark outline, readable on any colour. */
function paintNumber(g: G, text: string, x: number, y: number, size: number) {
  g.save();
  g.font = `800 ${Math.round(size)}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 4; g.strokeStyle = 'rgba(15,6,30,0.85)'; g.strokeText(text, x, y + 1);
  g.fillStyle = '#ffffff'; g.fillText(text, x, y + 1);
  g.restore();
}
