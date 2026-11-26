import { BALL_R, BRICK_GAP, CELL_H, CELL_W, FIELD_H, PADDLE_H, PADDLE_TOP, PADDLE_W, RAIL } from '../rules/config';
import { Game } from '../rules/state';
import { drawRailGlow, drawRailMask, drawRailShade, drawSpectrum, OUTER_H, OUTER_W, spectrumAngle } from './rails';

/** Brick colours: bright on the dark field, and different in lightness too, not only in hue. */
export const BRICK_COLOURS = ['#ff6b8a', '#ff9f5a', '#ffd166', '#7be0a1', '#4dd4e6', '#6aa8ff', '#a78bfa', '#e58cff'];

const BRICK_W = CELL_W - BRICK_GAP, BRICK_H = CELL_H - BRICK_GAP;
const BALL_SPRITE = BALL_R * 2 + 12;

/** How large the whole table (field and rails) can be drawn in w × h screen pixels: whole, centred, never stretched. */
export function fitField(w: number, h: number) {
  const scale = Math.max(0.01, Math.min(w / OUTER_W, h / OUTER_H));
  return { scale, left: (w - OUTER_W * scale) / 2, top: (h - OUTER_H * scale) / 2 };
}

type Sprite = HTMLCanvasElement;

/**
 * Draws the table on one canvas. Everything that does not move is painted once per size into sprites,
 * so a frame is a handful of drawImage calls and allocates nothing.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private ratio = 1;
  private width = 0;
  private height = 0;
  private box = { scale: 1, left: 0, top: 0 };
  private bricks: Sprite[] = [];
  private ball!: Sprite;
  private paddle!: Sprite;
  private floor!: Sprite;
  private glow!: Sprite;
  private railMask!: Sprite;
  private railShade!: Sprite;
  private spectrum!: Sprite;
  private rails!: Sprite;
  private railsCtx!: CanvasRenderingContext2D;
  private readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Screen position and scale of the inner field (between the rails), for turning pointer positions into field positions. */
  get fieldBox() {
    const r = this.canvas.getBoundingClientRect(), { scale, left, top } = this.box;
    return { left: r.left + left + RAIL * scale, top: r.top + top + RAIL * scale, scale };
  }

  /** Match the canvas to its size on screen; repaints the sprites only when the size changed. */
  fit() {
    const ratio = window.devicePixelRatio || 1, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w === this.width && h === this.height && ratio === this.ratio) return;
    this.width = w; this.height = h; this.ratio = ratio;
    this.canvas.width = Math.round(w * ratio); this.canvas.height = Math.round(h * ratio);
    this.box = fitField(w, h);
    const px = this.box.scale * ratio, side = Math.hypot(OUTER_W, OUTER_H);
    this.bricks = BRICK_COLOURS.map((c) => paint(BRICK_W, BRICK_H, px, (g) => drawBrick(g, c)));
    this.ball = paint(BALL_SPRITE, BALL_SPRITE, px, drawBall);
    this.paddle = paint(PADDLE_W + 24, PADDLE_H + 24, px, drawPaddle);
    this.floor = paint(OUTER_W, OUTER_H, px, drawFloor);
    this.glow = paint(OUTER_W, OUTER_H, px, drawRailGlow);
    this.railMask = paint(OUTER_W, OUTER_H, px, drawRailMask);
    this.railShade = paint(OUTER_W, OUTER_H, px, drawRailShade);
    this.spectrum = paint(side, side, px, (g) => drawSpectrum(g, side));
    this.rails = paint(OUTER_W, OUTER_H, px, () => {});
    this.railsCtx = this.rails.getContext('2d')!;
  }

  /** `blend` (0..1) places moving things between the last two simulation steps; `seconds` drives the flow of the rails. */
  draw(g: Game, blend: number, seconds: number) {
    this.fit();
    const ctx = this.ctx, { scale, left, top } = this.box, s = scale * this.ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, left * this.ratio, top * this.ratio);
    ctx.drawImage(this.glow, 0, 0, OUTER_W, OUTER_H);
    ctx.drawImage(this.floor, 0, 0, OUTER_W, OUTER_H);
    this.paintRails(seconds);
    ctx.drawImage(this.rails, 0, 0, OUTER_W, OUTER_H);

    ctx.translate(RAIL, RAIL);
    for (const b of g.bricks) if (b.hits > 0) ctx.drawImage(this.bricks[b.color % this.bricks.length], b.x0, b.y0, BRICK_W, BRICK_H);

    const p = g.paddle, px = p.prevX + (p.x - p.prevX) * blend;
    ctx.drawImage(this.paddle, px - p.w / 2 - 12, p.top - 12, p.w + 24, p.h + 24);

    for (const ball of g.balls) {
      const bx = ball.prevX + (ball.x - ball.prevX) * blend, by = ball.prevY + (ball.y - ball.prevY) * blend;
      ctx.drawImage(this.ball, bx - BALL_SPRITE / 2, by - BALL_SPRITE / 2, BALL_SPRITE, BALL_SPRITE);
    }
  }

  /** The turning colours cut to the shape of the rails, with their light and shade on top. */
  private paintRails(seconds: number) {
    const g = this.railsCtx, w = this.rails.width, h = this.rails.height, k = w / OUTER_W;
    const side = Math.hypot(OUTER_W, OUTER_H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.translate(OUTER_W / 2, OUTER_H / 2);
    g.rotate(spectrumAngle(seconds, this.reduceMotion));
    g.drawImage(this.spectrum, -side / 2, -side / 2, side, side);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(this.railMask, 0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(this.railShade, 0, 0, w, h);
  }
}

function paint(w: number, h: number, px: number, art: (g: CanvasRenderingContext2D) => void): Sprite {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * px)); c.height = Math.max(1, Math.ceil(h * px));
  const g = c.getContext('2d')!;
  g.scale(c.width / w, c.height / h);
  art(g);
  return c;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** A bevelled brick: light top edge, dark bottom edge, a soft shine. */
function drawBrick(g: CanvasRenderingContext2D, colour: string) {
  const w = BRICK_W, h = BRICK_H, r = 9;
  roundRect(g, 0, 0, w, h, r); g.fillStyle = colour; g.fill();
  const shade = g.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(255,255,255,0.5)'); shade.addColorStop(0.42, 'rgba(255,255,255,0.06)'); shade.addColorStop(1, 'rgba(0,0,0,0.38)');
  roundRect(g, 0, 0, w, h, r); g.fillStyle = shade; g.fill();
  g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.beginPath(); g.moveTo(r, 2); g.lineTo(w - r, 2); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.moveTo(r, h - 1.5); g.lineTo(w - r, h - 1.5); g.stroke();
  const shine = g.createRadialGradient(w * 0.3, h * 0.3, 1, w * 0.3, h * 0.3, h * 0.9);
  shine.addColorStop(0, 'rgba(255,255,255,0.35)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(g, 0, 0, w, h, r); g.fillStyle = shine; g.fill();
}

function drawBall(g: CanvasRenderingContext2D) {
  const c = BALL_SPRITE / 2;
  const glow = g.createRadialGradient(c, c, BALL_R * 0.7, c, c, c);
  glow.addColorStop(0, 'rgba(196,181,253,0.55)'); glow.addColorStop(1, 'rgba(196,181,253,0)');
  g.fillStyle = glow; g.fillRect(0, 0, BALL_SPRITE, BALL_SPRITE);
  const body = g.createRadialGradient(c - 6, c - 6, 2, c, c, BALL_R);
  body.addColorStop(0, '#ffffff'); body.addColorStop(0.45, '#ece6ff'); body.addColorStop(1, '#9d7cf6');
  g.beginPath(); g.arc(c, c, BALL_R, 0, Math.PI * 2); g.fillStyle = body; g.fill();
}

function drawPaddle(g: CanvasRenderingContext2D) {
  const w = PADDLE_W, h = PADDLE_H, x = 12, y = 12;
  g.save(); g.shadowColor = 'rgba(139,92,246,0.8)'; g.shadowBlur = 14;
  const body = g.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, '#d8ccff'); body.addColorStop(0.45, '#8b5cf6'); body.addColorStop(1, '#3b1a85');
  roundRect(g, x, y, w, h, h / 2); g.fillStyle = body; g.fill(); g.restore();
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.65)';
  g.beginPath(); g.moveTo(x + h / 2, y + 3.5); g.lineTo(x + w - h / 2, y + 3.5); g.stroke();
  g.fillStyle = '#ffd166'; roundRect(g, x + w / 2 - 3, y + 8, 6, h - 16, 3); g.fill();
}

/**
 * The floor of the table: solid dark violet, so no stars show through the play area,
 * fading out below the paddle, where the star field of the page shows.
 */
function drawFloor(g: CanvasRenderingContext2D) {
  const fadeFrom = (RAIL + PADDLE_TOP + PADDLE_H + 30) / OUTER_H;
  const fill = g.createLinearGradient(0, 0, 0, OUTER_H);
  fill.addColorStop(0, '#1d1045'); fill.addColorStop(0.5, '#160c36'); fill.addColorStop(fadeFrom, '#120a2c'); fill.addColorStop(1, 'rgba(18,10,44,0)');
  g.fillStyle = fill; g.fillRect(RAIL / 2, RAIL / 2, OUTER_W - RAIL, OUTER_H - RAIL / 2);
  // a faint vignette and a soft light from the top, for depth
  const light = g.createRadialGradient(OUTER_W / 2, RAIL, 20, OUTER_W / 2, RAIL, FIELD_H * 0.8);
  light.addColorStop(0, 'rgba(139,92,246,0.18)'); light.addColorStop(1, 'rgba(139,92,246,0)');
  g.fillStyle = light; g.fillRect(RAIL / 2, RAIL / 2, OUTER_W - RAIL, OUTER_H * fadeFrom);
}
