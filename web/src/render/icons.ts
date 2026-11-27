// Our own little pictures for the bonuses, drawn with lines and circles. No letters on capsules and nothing borrowed:
// each picture shows what the bonus does.
import { BonusKind, HARMFUL } from '../levels/level';

type G = CanvasRenderingContext2D;

/** Colour of a bonus: gold for the ball bonuses, blue for the paddle, red for the harmful ones, orange for the bombs. */
export function bonusColour(kind: BonusKind): string {
  if (HARMFUL.has(kind)) return '#ff4d6d';
  if (kind === 'bomb' || kind === 'timebomb' || kind === 'comet') return '#ff9f43';
  if (kind === 'second' || kind === 'multi' || kind === 'extra') return '#ffd166';
  if (kind === 'shield' || kind === 'slow') return '#4dd4e6';
  return '#8fb3ff';
}

/** Draws the picture of a bonus in a square of side `s` centred at (x, y). */
export function drawIcon(g: G, kind: BonusKind, x: number, y: number, s: number, colour = '#fff') {
  g.save();
  g.translate(x, y);
  g.scale(s / 24, s / 24);
  g.strokeStyle = colour; g.fillStyle = colour; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (...pts: number[]) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
  const dot = (cx: number, cy: number, r: number) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); };
  const ring = (cx: number, cy: number, r: number) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); };
  switch (kind) {
    case 'wide': line(-10, 0, 10, 0); line(-6, -4, -10, 0, -6, 4); line(6, -4, 10, 0, 6, 4); line(-4, 7, 4, 7); break;
    case 'narrow': line(-10, 0, -3, 0); line(3, 0, 10, 0); line(-7, -4, -3, 0, -7, 4); line(7, -4, 3, 0, 7, 4); break;
    case 'slow': ring(0, 0, 8); line(0, 0, 0, -5); line(0, 0, 4, 2); break;
    case 'fast': line(-9, -6, -3, 0, -9, 6); line(-1, -6, 5, 0, -1, 6); line(5, -6, 11, 0, 5, 6); break;
    case 'second': dot(-4, 1, 4.5); ring(5, -3, 4); break;
    case 'multi': dot(-6, 3, 3.6); dot(0, -4, 3.6); dot(6, 3, 3.6); break;
    case 'extra': dot(-3, 0, 5); line(6, -5, 6, 5); line(1, 0, 11, 0); break;
    case 'laser': line(-5, 8, -5, -9); line(5, 8, 5, -9); line(-8, 8, 8, 8); break;
    case 'sticky': g.beginPath(); g.moveTo(0, -9); g.bezierCurveTo(8, 0, 6, 8, 0, 8); g.bezierCurveTo(-6, 8, -8, 0, 0, -9); g.fill(); break;
    case 'comet': dot(5, -4, 5); line(1, 0, -9, 9); line(3, 2, -5, 10); line(-1, -2, -10, 4); break;
    case 'shield': line(-10, 6, 10, 6); g.beginPath(); g.arc(0, 6, 8, Math.PI, 0); g.stroke(); break;
    case 'bomb': dot(-1, 3, 7); line(3, -3, 7, -8); dot(8, -9, 1.8); break;
    case 'timebomb': ring(0, 1, 8); line(0, 1, 0, -4); line(0, 1, 4, 3); line(-3, -10, 3, -10); break;
  }
  g.restore();
}

/** A capsule: a rounded pill in the bonus colour with its picture, for the falling bonus. */
export function drawCapsule(g: G, kind: BonusKind, w: number, h: number) {
  const colour = bonusColour(kind), r = h / 2;
  g.save();
  g.shadowColor = colour; g.shadowBlur = 12;
  g.beginPath(); g.moveTo(r, 0); g.lineTo(w - r, 0); g.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(r, h); g.arc(r, r, r, Math.PI / 2, -Math.PI / 2); g.closePath();
  const body = g.createLinearGradient(0, 0, 0, h);
  body.addColorStop(0, '#ffffff'); body.addColorStop(0.35, colour); body.addColorStop(1, shade(colour, -0.45));
  g.fillStyle = body; g.fill();
  g.restore();
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.stroke();
  drawIcon(g, kind, w / 2, h / 2, h * 0.78, '#1a0f33');
}

/** A colour made lighter (amount > 0) or darker (amount < 0), from #rrggbb. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16), parts = [n >> 16, (n >> 8) & 255, n & 255];
  const out = parts.map((c) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)));
  return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
}
