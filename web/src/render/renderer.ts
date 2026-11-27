import { BONUS_CODES, BonusKind } from '../levels/level';
import { WorldId } from '../levels/tiers';
import { BARRIER_Y } from '../physics/contact';
import { CAPSULE_R, DANGER_Y, FIELD_W, PADDLE_H, RAIL, TIME_BOMB } from '../rules/config';
import { Brick, Game } from '../rules/state';
import { paintBrick } from './brickArt';
import { drawCapsule } from './icons';
import { Particles } from './particles';
import { drawRailGlow, drawRailMask, drawRailShade, drawSpectrum, OUTER_H, OUTER_W, spectrumAngle } from './rails';
import { World, WORLDS } from './worlds';

/** How large the whole table (field and rails) can be drawn in w × h screen pixels: whole, centred, never stretched. */
export function fitField(w: number, h: number) {
  const scale = Math.max(0.01, Math.min(w / OUTER_W, h / OUTER_H));
  return { scale, left: (w - OUTER_W * scale) / 2, top: (h - OUTER_H * scale) / 2 };
}

type Sprite = HTMLCanvasElement;
const PAD = 10;
const CAPSULE_W = CAPSULE_R * 3.2, CAPSULE_H = CAPSULE_R * 1.5;
const BONUS_KINDS = Object.values(BONUS_CODES);

interface BrickPicture { canvas: Sprite; version: number; stage: number; key: string }

/**
 * Draws the table on one canvas. Everything that does not change every frame is painted once into pictures
 * (the floor, rails, each brick until its look changes), so a frame is mostly drawImage calls.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private ratio = 1;
  private box = { scale: 1, left: 0, top: 0 };
  private world: World = WORLDS.lab;
  private ballSize = 18;
  private paddleW = 248;
  private key = '';
  private floor!: Sprite;
  private glow!: Sprite;
  private railMask!: Sprite;
  private railShade!: Sprite;
  private spectrum!: Sprite;
  private rails!: Sprite;
  private railsCtx!: CanvasRenderingContext2D;
  private ball!: Sprite;
  private bomb!: Sprite;
  private paddle!: Sprite;
  private capsules = new Map<BonusKind, Sprite>();
  private bricks = new WeakMap<Brick, BrickPicture>();
  private readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  readonly particles = new Particles(this.reduceMotion);

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Screen position and scale of the inner field (between the rails), for turning pointer positions into field positions. */
  get fieldBox() {
    const r = this.canvas.getBoundingClientRect(), { scale, left, top } = this.box;
    return { left: r.left + left + RAIL * scale, top: r.top + top + RAIL * scale, scale };
  }

  /** Matches the canvas to its size on screen and to the world and sizes of the game; repaints pictures only when something changed. */
  private fit(g: Game) {
    const ratio = window.devicePixelRatio || 1, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const key = `${w}x${h}@${ratio}/${g.tier.world}/${g.tier.ball}/${g.tier.paddle}`;
    if (key === this.key) return;
    this.key = key; this.ratio = ratio;
    this.canvas.width = Math.round(w * ratio); this.canvas.height = Math.round(h * ratio);
    this.box = fitField(w, h);
    this.world = WORLDS[g.tier.world as WorldId];
    this.ballSize = g.tier.ball; this.paddleW = g.tier.paddle;
    const px = this.box.scale * ratio, side = Math.hypot(OUTER_W, OUTER_H), world = this.world, paddleW = this.paddleW;
    this.floor = paint(OUTER_W, OUTER_H, px, (c) => world.floor(c));
    this.glow = paint(OUTER_W, OUTER_H, px, drawRailGlow);
    this.railMask = paint(OUTER_W, OUTER_H, px, drawRailMask);
    this.railShade = paint(OUTER_W, OUTER_H, px, drawRailShade);
    this.spectrum = paint(side, side, px, (c) => drawSpectrum(c, side, world.spectrum));
    this.rails = paint(OUTER_W, OUTER_H, px, () => {});
    this.railsCtx = this.rails.getContext('2d')!;
    const r = this.ballSize, s = r * 2 + 16;
    this.ball = paint(s, s, px, (c) => drawBall(c, r, s, world.ball.core, world.ball.mid, world.ball.edge, world.ball.glow));
    this.bomb = paint(s, s, px, (c) => drawBall(c, r, s, '#ffd0c0', '#5a1020', '#1a0508', 'rgba(255,60,60,0.6)'));
    this.paddle = paint(paddleW + 24, PADDLE_H + 24, px, (c) => drawPaddle(c, paddleW, world));
    this.capsules.clear();
    for (const kind of BONUS_KINDS) this.capsules.set(kind, paint(CAPSULE_W + 12, CAPSULE_H + 12, px, (c) => { c.translate(6, 6); drawCapsule(c, kind, CAPSULE_W, CAPSULE_H); }));
    this.bricks = new WeakMap();
  }

  /** `blend` (0..1) places moving things between the last two simulation steps; `seconds` drives the animations; `dt` is the frame time. */
  draw(g: Game, blend: number, seconds: number, dt: number) {
    this.fit(g);
    const ctx = this.ctx, { scale, left, top } = this.box, s = scale * this.ratio, w = this.world;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, left * this.ratio, top * this.ratio);
    ctx.drawImage(this.glow, 0, 0, OUTER_W, OUTER_H);
    ctx.drawImage(this.floor, 0, 0, OUTER_W, OUTER_H);
    this.paintRails(seconds);
    ctx.drawImage(this.rails, 0, 0, OUTER_W, OUTER_H);
    this.plaque(ctx, g.level.id);

    ctx.translate(RAIL, RAIL);
    if (g.level.descend > 0) this.dangerLine(ctx, seconds);
    if (g.effects.barrier) this.barrier(ctx, seconds);
    for (const p of g.level.portals) { this.portal(ctx, p.ax, p.ay, p.r, w.portal[0], seconds); this.portal(ctx, p.bx, p.by, p.r, w.portal[1], -seconds); }
    for (const b of g.level.bumpers) this.bumper(ctx, b.x, b.y, b.r);
    for (const b of g.bricks) this.brick(ctx, b, seconds);
    for (const sp of g.spinners) this.spinner(ctx, sp.poly);
    for (const c of g.capsules) {
      const y = c.prevY + (c.y - c.prevY) * blend, pic = this.capsules.get(c.kind)!;
      ctx.drawImage(pic, c.x - CAPSULE_W / 2 - 6, y - CAPSULE_H / 2 - 6, CAPSULE_W + 12, CAPSULE_H + 12);
    }
    this.shots(ctx, g, blend);
    this.drawPaddle(ctx, g, blend, seconds);
    for (const ball of g.balls) this.drawBall(ctx, g, ball, blend, seconds);

    for (const fx of g.fx) this.particles.add(fx, (i) => w.bricks[i % w.bricks.length], w.paddle.mark);
    g.fx.length = 0;
    this.particles.draw(ctx, dt);
  }

  /** The turning colours cut to the shape of the rails, with their light and shade on top. */
  private paintRails(seconds: number) {
    const g = this.railsCtx, cw = this.rails.width, ch = this.rails.height, k = cw / OUTER_W, side = Math.hypot(OUTER_W, OUTER_H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cw, ch);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.translate(OUTER_W / 2, OUTER_H / 2);
    g.rotate(spectrumAngle(seconds, this.reduceMotion));
    g.drawImage(this.spectrum, -side / 2, -side / 2, side, side);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(this.railMask, 0, 0, cw, ch);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(this.railShade, 0, 0, cw, ch);
  }

  /** A small plate on the top rail with the number of the level. */
  private plaque(g: CanvasRenderingContext2D, id: string) {
    const w = 84, h = 30, x = OUTER_W / 2 - w / 2, y = RAIL / 2 - h / 2;
    g.save();
    roundRect(g, x, y, w, h, 9); g.fillStyle = 'rgba(10,6,24,0.88)'; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = this.world.paddle.mark; g.stroke();
    g.font = '800 18px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.fillText(id, OUTER_W / 2, RAIL / 2 + 1);
    g.restore();
  }

  private dangerLine(g: CanvasRenderingContext2D, seconds: number) {
    g.save();
    g.setLineDash([16, 12]); g.lineDashOffset = -seconds * 30;
    g.lineWidth = 3; g.strokeStyle = this.world.danger; g.globalAlpha = 0.75;
    g.beginPath(); g.moveTo(0, DANGER_Y); g.lineTo(FIELD_W, DANGER_Y); g.stroke();
    g.restore();
  }

  private barrier(g: CanvasRenderingContext2D, seconds: number) {
    g.save();
    g.shadowColor = '#4dd4e6'; g.shadowBlur = 16; g.lineWidth = 5;
    g.strokeStyle = `rgba(77,212,230,${0.65 + 0.25 * Math.sin(seconds * 6)})`;
    g.beginPath(); g.moveTo(6, BARRIER_Y); g.lineTo(FIELD_W - 6, BARRIER_Y); g.stroke();
    g.restore();
  }

  private portal(g: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, turn: number) {
    g.save();
    g.translate(x, y); g.rotate(turn * 2);
    const hole = g.createRadialGradient(0, 0, 2, 0, 0, r);
    hole.addColorStop(0, '#000000'); hole.addColorStop(0.6, 'rgba(0,0,0,0.85)'); hole.addColorStop(1, colour);
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = hole; g.fill();
    g.shadowColor = colour; g.shadowBlur = 14; g.lineWidth = 3; g.strokeStyle = colour;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, r * (0.55 + i * 0.2), i * 2, i * 2 + 2.4); g.stroke(); }
    g.restore();
  }

  private bumper(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
    const [light, dark] = this.world.bumper;
    g.save();
    g.shadowColor = dark; g.shadowBlur = 18;
    const body = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    body.addColorStop(0, '#ffffff'); body.addColorStop(0.35, light); body.addColorStop(1, dark);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = body; g.fill();
    g.restore();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x, y, r * 0.72, 0, Math.PI * 2); g.stroke();
  }

  private spinner(g: CanvasRenderingContext2D, p: number[]) {
    g.save();
    g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < 8; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath();
    g.shadowColor = this.world.paddle.glow; g.shadowBlur = 12;
    g.fillStyle = this.world.steel[1]; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = this.world.steel[0]; g.stroke();
    g.restore();
  }

  /** A brick from its picture; an invisible one only shows for a moment after a hit, a regrowing one leaves a faint trace. */
  private brick(g: CanvasRenderingContext2D, b: Brick, seconds: number) {
    let alpha = 1;
    if (b.hits <= 0) { if (b.regenAt <= 0) return; alpha = 0.12; }
    else if (b.kind === 'invisible') alpha = b.flash > 0 ? Math.min(1, b.flash / 0.25) : 0.05 + 0.04 * Math.max(0, Math.sin(seconds * 1.3 + b.cx));
    const pic = this.brickPicture(b), x = b.x0 - PAD, y = b.y0 - PAD, w = b.x1 - b.x0 + PAD * 2, h = b.y1 - b.y0 + PAD * 2;
    g.globalAlpha = alpha;
    g.drawImage(pic.canvas, x, y, w, h);
    if (b.flash > 0 && b.hits > 0 && b.kind !== 'invisible') {
      g.globalAlpha = Math.min(0.5, b.flash);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(pic.canvas, x, y, w, h);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }

  private brickPicture(b: Brick): BrickPicture {
    const have = this.bricks.get(b);
    if (have && have.version === b.version && have.stage === b.stage && have.key === this.key) return have;
    const px = this.box.scale * this.ratio, w = b.x1 - b.x0 + PAD * 2, h = b.y1 - b.y0 + PAD * 2, world = this.world;
    const pic = { canvas: paint(w, h, px, (c) => paintBrick(c, b, world, PAD)), version: b.version, stage: b.stage, key: this.key };
    this.bricks.set(b, pic);
    return pic;
  }

  private shots(g: CanvasRenderingContext2D, game: Game, blend: number) {
    if (!game.shots.length) return;
    g.save();
    g.shadowColor = '#ff4d6d'; g.shadowBlur = 10; g.lineWidth = 4; g.strokeStyle = '#ffd5dc'; g.lineCap = 'round';
    for (const s of game.shots) { const y = s.prevY + (s.y - s.prevY) * blend; g.beginPath(); g.moveTo(s.x, y); g.lineTo(s.x, y + 22); g.stroke(); }
    g.restore();
  }

  /** The paddle; a stunned one wobbles in slices and shows cracks. Small bars under it show how long bonuses still work. */
  private drawPaddle(g: CanvasRenderingContext2D, game: Game, blend: number, seconds: number) {
    const p = game.paddle, x = p.prevX + (p.x - p.prevX) * blend, e = game.effects;
    const sw = this.paddle.width, sh = this.paddle.height, left = x - p.w / 2 - 12, w = p.w + 24, h = PADDLE_H + 24;
    if (e.stun > 0) {
      const slices = 10;
      for (let i = 0; i < slices; i++) {
        const dy = Math.sin(seconds * 14 + i * 1.3) * 5;
        g.drawImage(this.paddle, (sw * i) / slices, 0, sw / slices, sh, left + (w * i) / slices, p.top - 12 + dy, w / slices + 0.5, h);
      }
      g.save(); g.strokeStyle = 'rgba(20,0,0,0.7)'; g.lineWidth = 2;
      for (let i = 1; i < 4; i++) { const cx = x - p.w / 2 + (p.w * i) / 4; g.beginPath(); g.moveTo(cx - 6, p.top + 4); g.lineTo(cx + 3, p.top + 14); g.lineTo(cx - 2, p.top + 26); g.stroke(); }
      g.restore();
    } else g.drawImage(this.paddle, left, p.top - 12, w, h);
    if (e.laser > 0) {
      g.fillStyle = '#ff4d6d';
      g.fillRect(x - p.w / 2 + 8, p.top - 10, 6, 12); g.fillRect(x + p.w / 2 - 14, p.top - 10, 6, 12);
    }
    if (e.sticky > 0) {
      g.fillStyle = 'rgba(123,224,161,0.85)';
      for (let i = 0; i < e.sticky; i++) { g.beginPath(); g.arc(x - (e.sticky - 1) * 7 + i * 14, p.top - 6, 3.5, 0, Math.PI * 2); g.fill(); }
    }
    let row = 0;
    const bar = (k: number, colour: string) => {
      const y = p.top + PADDLE_H + 8 + row * 7;
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x - p.w / 2, y, p.w, 4);
      g.fillStyle = colour; g.fillRect(x - p.w / 2, y, p.w * Math.max(0, Math.min(1, k)), 4);
      row++;
    };
    if (e.size) bar(e.size.left / (e.size.kind === 'wide' ? 20 : 15), e.size.kind === 'wide' ? '#8fb3ff' : '#ff4d6d');
    if (e.pace) bar(e.pace.left / (e.pace.kind === 'slow' ? 15 : 10), e.pace.kind === 'slow' ? '#4dd4e6' : '#ff4d6d');
    if (e.laser > 0) bar(e.laser / 20, '#ff8fa3');
    if (e.comet > 0) bar(e.comet / 6, '#ff9f43');
    if (e.stun > 0) bar(e.stun / TIME_BOMB.stunSeconds, '#ff3b1f');
    if (e.bomb) bar(1, '#ff9f43');
  }

  private drawBall(g: CanvasRenderingContext2D, game: Game, ball: Game['balls'][number], blend: number, seconds: number) {
    const bx = ball.prevX + (ball.x - ball.prevX) * blend, by = ball.prevY + (ball.y - ball.prevY) * blend;
    const size = this.ballSize * 2 + 16, half = size / 2;
    if (ball.kind === 'bomb') {
      const warn = ball.fuse <= TIME_BOMB.warn, blink = warn && Math.sin(seconds * 20) > 0;
      if (warn) {
        g.save(); g.setLineDash([10, 8]); g.lineWidth = 3; g.strokeStyle = 'rgba(255,60,60,0.65)';
        g.beginPath(); g.arc(bx, by, TIME_BOMB.radius, 0, Math.PI * 2); g.stroke(); g.restore();
      }
      g.drawImage(this.bomb, bx - half, by - half, size, size);
      if (blink) { g.globalCompositeOperation = 'lighter'; g.drawImage(this.bomb, bx - half, by - half, size, size); g.globalCompositeOperation = 'source-over'; }
      g.save(); g.font = `800 ${Math.round(this.ballSize * 1.15)}px Inter, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = warn ? '#ffeb3b' : '#ffffff'; g.fillText(String(Math.max(0, Math.ceil(ball.fuse))), bx, by + 1); g.restore();
      return;
    }
    if (game.effects.comet > 0 && ball.stuck === null) {
      const speed = Math.hypot(ball.vx, ball.vy) || 1;
      for (let i = 5; i >= 1; i--) {
        g.globalAlpha = 0.12 * (6 - i);
        g.fillStyle = i % 2 ? '#ff9f43' : '#ffd27a';
        g.beginPath(); g.arc(bx - (ball.vx / speed) * i * 10, by - (ball.vy / speed) * i * 10, this.ballSize * (1 - i * 0.1), 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
    g.drawImage(this.ball, bx - half, by - half, size, size);
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

function drawBall(g: CanvasRenderingContext2D, r: number, size: number, core: string, mid: string, edge: string, glowColour: string) {
  const c = size / 2;
  const glow = g.createRadialGradient(c, c, r * 0.7, c, c, c);
  glow.addColorStop(0, glowColour); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, size, size);
  const body = g.createRadialGradient(c - r * 0.35, c - r * 0.35, 2, c, c, r);
  body.addColorStop(0, core); body.addColorStop(0.45, mid); body.addColorStop(1, edge);
  g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fillStyle = body; g.fill();
}

function drawPaddle(g: CanvasRenderingContext2D, w: number, world: World) {
  const h = PADDLE_H, x = 12, y = 12, c = world.paddle;
  g.save(); g.shadowColor = c.glow; g.shadowBlur = 14;
  const body = g.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, c.top); body.addColorStop(0.45, c.mid); body.addColorStop(1, c.bottom);
  roundRect(g, x, y, w, h, h / 2); g.fillStyle = body; g.fill(); g.restore();
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.65)';
  g.beginPath(); g.moveTo(x + h / 2, y + 3.5); g.lineTo(x + w - h / 2, y + 3.5); g.stroke();
  g.fillStyle = c.mark; roundRect(g, x + w / 2 - 3, y + 8, 6, h - 16, 3); g.fill();
}
