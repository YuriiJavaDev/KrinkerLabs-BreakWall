import { FIELD_H, FIELD_W, RAIL } from '../rules/config';

// The rails: a tube along the left wall, the ceiling and the right wall, open at the bottom.
// Its colour is a band of the site's spectrum that slowly flows along it; light and shade on top give it a rounded volume.

/** The site's colours, in the order they flow along the rails. The first is repeated at the end so the band loops seamlessly. */
export const SPECTRUM = ['#8b5cf6', '#6366f1', '#38bdf8', '#a78bfa', '#d946ef', '#f472b6', '#8b5cf6'];
/** One full turn of the colours around the field takes this long. */
export const SPECTRUM_SECONDS = 12;

/** Outer size of the drawn field: the inner field with a rail on the left, right and top. */
export const OUTER_W = FIELD_W + 2 * RAIL;
export const OUTER_H = FIELD_H + RAIL;

/** How far the colours have turned at a time, in radians (0 ≤ angle < 2π). Still when motion is reduced. */
export function spectrumAngle(seconds: number, reduceMotion: boolean): number {
  if (reduceMotion) return 0;
  const turns = seconds / SPECTRUM_SECONDS;
  return (turns - Math.floor(turns)) * 2 * Math.PI;
}

/** The centre line of the rails in outer coordinates. */
function railPath(g: CanvasRenderingContext2D) {
  const h = RAIL / 2, corner = 60;
  g.beginPath();
  g.moveTo(h, OUTER_H);
  g.lineTo(h, h + corner);
  g.arcTo(h, h, h + corner, h, corner);
  g.lineTo(OUTER_W - h - corner, h);
  g.arcTo(OUTER_W - h, h, OUTER_W - h, h + corner, corner);
  g.lineTo(OUTER_W - h, OUTER_H);
}

/** Fully opaque along the rails, fading out over the last part of the open bottom. */
function fadeDown(g: CanvasRenderingContext2D, colour: string) {
  const fade = g.createLinearGradient(0, 0, 0, OUTER_H);
  fade.addColorStop(0, colour); fade.addColorStop(0.86, colour); fade.addColorStop(1, 'rgba(255,255,255,0)');
  return fade;
}

/** The shape of the rails, white where they are: used to cut the flowing colour to the rails. */
export function drawRailMask(g: CanvasRenderingContext2D) {
  railPath(g);
  g.lineCap = 'butt'; g.lineJoin = 'round';
  g.lineWidth = RAIL; g.strokeStyle = fadeDown(g, '#fff'); g.stroke();
}

/** Light and shade across the tube: dark at both edges, a bright ridge a little towards the inner top. */
export function drawRailShade(g: CanvasRenderingContext2D) {
  g.lineCap = 'butt'; g.lineJoin = 'round';
  // a dark rim at both edges, the colour in between, one narrow soft ridge of light: a round tube, still clearly coloured
  const layers: [number, string][] = [
    [RAIL, 'rgba(12,4,34,0.6)'], [RAIL * 0.86, 'rgba(12,4,34,0.28)'],
    [RAIL * 0.34, 'rgba(255,255,255,0.12)'], [RAIL * 0.16, 'rgba(255,255,255,0.22)'], [RAIL * 0.05, 'rgba(255,255,255,0.45)'],
  ];
  for (const [width, colour] of layers) { railPath(g); g.lineWidth = width; g.strokeStyle = colour; g.stroke(); }
  // keep the shading only on the rails, fading like them
  g.globalCompositeOperation = 'destination-in';
  drawRailMask(g);
  g.globalCompositeOperation = 'source-over';
}

/** A soft glow under the rails onto the field and the page. */
export function drawRailGlow(g: CanvasRenderingContext2D) {
  g.save();
  g.shadowColor = 'rgba(139,92,246,0.75)'; g.shadowBlur = 28;
  railPath(g); g.lineWidth = RAIL * 0.7; g.lineCap = 'butt'; g.strokeStyle = fadeDown(g, 'rgba(60,30,140,0.9)'); g.stroke();
  g.restore();
}

/**
 * The colours around a centre, painted on a square of side `size`. Turning this square behind the rails makes the colours flow
 * along them. Browsers without conic gradients get the same colours across the square, without the flow.
 */
export function drawSpectrum(g: CanvasRenderingContext2D, size: number, colours: readonly string[] = SPECTRUM) {
  const c = size / 2;
  const paint = typeof g.createConicGradient === 'function' ? g.createConicGradient(0, c, c) : g.createLinearGradient(0, 0, size, size);
  colours.forEach((colour, i) => paint.addColorStop(i / (colours.length - 1), colour));
  g.fillStyle = paint; g.fillRect(0, 0, size, size);
}
