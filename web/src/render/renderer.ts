import { BALL_R, BRICK_GAP, CELL_H, CELL_W, FIELD_H, FIELD_W, PADDLE_H, PADDLE_W } from '../rules/config';
import { Game } from '../rules/state';

/** Brick colours: bright enough on the violet field, and different in lightness too, not only in hue. */
export const BRICK_COLOURS = ['#ff6b8a', '#ff9f5a', '#ffd166', '#7be0a1', '#4dd4e6', '#6aa8ff', '#a78bfa', '#e58cff'];

const BRICK_W = CELL_W - BRICK_GAP, BRICK_H = CELL_H - BRICK_GAP;

/** How large the field can be drawn in a box of w × h screen pixels: whole, centred, never stretched. */
export function fitField(w: number, h: number) {
  const scale = Math.max(0.01, Math.min(w / FIELD_W, h / FIELD_H));
  return { scale, left: (w - FIELD_W * scale) / 2, top: (h - FIELD_H * scale) / 2 };
}

type Sprite = HTMLCanvasElement;

/**
 * Draws the game on one canvas. Bricks, ball, paddle and field are painted once per size into small sprites,
 * so a frame is only a few drawImage calls and allocates nothing.
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
  private field!: Sprite;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Screen rectangle of the field, for turning pointer positions into field positions. */
  get fieldBox() {
    const r = this.canvas.getBoundingClientRect();
    return { left: r.left + this.box.left, top: r.top + this.box.top, scale: this.box.scale };
  }

  /** Match the canvas to its size on screen; repaints the sprites only when the size changed. */
  fit() {
    const ratio = window.devicePixelRatio || 1, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w === this.width && h === this.height && ratio === this.ratio) return;
    this.width = w; this.height = h; this.ratio = ratio;
    this.canvas.width = Math.round(w * ratio); this.canvas.height = Math.round(h * ratio);
    this.box = fitField(w, h);
    const px = this.box.scale * ratio;
    this.bricks = BRICK_COLOURS.map((c) => paint(BRICK_W, BRICK_H, px, (g) => drawBrick(g, c)));
    this.ball = paint(BALL_R * 2 + 4, BALL_R * 2 + 4, px, drawBall);
    this.paddle = paint(PADDLE_W, PADDLE_H, px, drawPaddle);
    this.field = paint(FIELD_W, FIELD_H, px, drawField);
  }

  /** `blend` (0..1) places moving things between the last two simulation steps. */
  draw(g: Game, blend: number) {
    this.fit();
    const ctx = this.ctx, { scale, left, top } = this.box, s = scale * this.ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, left * this.ratio, top * this.ratio);
    ctx.drawImage(this.field, 0, 0, FIELD_W, FIELD_H);

    for (const b of g.bricks) if (b.hits > 0) ctx.drawImage(this.bricks[b.color % this.bricks.length], b.x0, b.y0, BRICK_W, BRICK_H);

    const p = g.paddle, px = p.prevX + (p.x - p.prevX) * blend;
    ctx.drawImage(this.paddle, px - p.w / 2, p.top, p.w, p.h);

    if (g.phase === 'over') return;
    const ball = g.ball, bx = ball.prevX + (ball.x - ball.prevX) * blend, by = ball.prevY + (ball.y - ball.prevY) * blend;
    const size = BALL_R * 2 + 4;
    ctx.drawImage(this.ball, bx - size / 2, by - size / 2, size, size);
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
  const w = BRICK_W, h = BRICK_H;
  roundRect(g, 0, 0, w, h, 5); g.fillStyle = colour; g.fill();
  const shade = g.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(255,255,255,0.45)'); shade.addColorStop(0.45, 'rgba(255,255,255,0.05)'); shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  roundRect(g, 0, 0, w, h, 5); g.fillStyle = shade; g.fill();
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.moveTo(5, 1.2); g.lineTo(w - 5, 1.2); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.moveTo(5, h - 1); g.lineTo(w - 5, h - 1); g.stroke();
}

function drawBall(g: CanvasRenderingContext2D) {
  const c = BALL_R + 2;
  const glow = g.createRadialGradient(c, c, BALL_R * 0.6, c, c, c);
  glow.addColorStop(0, 'rgba(196,181,253,0.5)'); glow.addColorStop(1, 'rgba(196,181,253,0)');
  g.fillStyle = glow; g.fillRect(0, 0, c * 2, c * 2);
  const body = g.createRadialGradient(c - 3, c - 3, 1, c, c, BALL_R);
  body.addColorStop(0, '#ffffff'); body.addColorStop(0.5, '#e9e3ff'); body.addColorStop(1, '#a78bfa');
  g.beginPath(); g.arc(c, c, BALL_R, 0, Math.PI * 2); g.fillStyle = body; g.fill();
}

function drawPaddle(g: CanvasRenderingContext2D) {
  const w = PADDLE_W, h = PADDLE_H;
  const body = g.createLinearGradient(0, 0, 0, h);
  body.addColorStop(0, '#c4b5fd'); body.addColorStop(0.5, '#8b5cf6'); body.addColorStop(1, '#4c1d95');
  roundRect(g, 0, 0, w, h, h / 2); g.fillStyle = body; g.fill();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.beginPath(); g.moveTo(h / 2, 2); g.lineTo(w - h / 2, 2); g.stroke();
  g.fillStyle = '#ffd166'; g.fillRect(w / 2 - 1.5, 4, 3, h - 8);
}

/** The playing field: a translucent violet panel with a bright frame on the three walls; the open bottom fades out. */
function drawField(g: CanvasRenderingContext2D) {
  const fill = g.createLinearGradient(0, 0, 0, FIELD_H);
  fill.addColorStop(0, 'rgba(30,16,64,0.78)'); fill.addColorStop(0.85, 'rgba(20,12,40,0.6)'); fill.addColorStop(1, 'rgba(20,12,40,0)');
  roundRect(g, 0, 0, FIELD_W, FIELD_H + 20, 18); g.fillStyle = fill; g.fill();
  const frame = g.createLinearGradient(0, 0, 0, FIELD_H);
  frame.addColorStop(0, 'rgba(167,139,250,0.9)'); frame.addColorStop(0.85, 'rgba(167,139,250,0.5)'); frame.addColorStop(1, 'rgba(167,139,250,0)');
  g.lineWidth = 3; g.strokeStyle = frame;
  g.beginPath(); g.moveTo(1.5, FIELD_H); g.lineTo(1.5, 18); g.arcTo(1.5, 1.5, 18, 1.5, 16.5);
  g.lineTo(FIELD_W - 18, 1.5); g.arcTo(FIELD_W - 1.5, 1.5, FIELD_W - 1.5, 18, 16.5); g.lineTo(FIELD_W - 1.5, FIELD_H); g.stroke();
}
