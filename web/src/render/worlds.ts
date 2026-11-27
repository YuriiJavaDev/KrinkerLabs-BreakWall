// The three worlds: colours and the painting of the floor. Bricks, ball and paddle take their colours from here.
import { WorldId } from '../levels/tiers';
import { FIELD_H, PADDLE_H, PADDLE_TOP, RAIL } from '../rules/config';
import { OUTER_H, OUTER_W } from './rails';

type G = CanvasRenderingContext2D;

export type BrickStyle = 'glass' | 'neon' | 'crystal';

export interface World {
  id: WorldId;
  /** Colours that flow along the rails; the first is repeated at the end so the loop has no seam. */
  spectrum: string[];
  /** Brick colours by index 0 … 7: different in lightness too, not only in hue. */
  bricks: string[];
  style: BrickStyle;
  explosive: string;
  steel: [string, string];
  ball: { core: string; mid: string; edge: string; glow: string };
  paddle: { top: string; mid: string; bottom: string; glow: string; mark: string };
  bumper: [string, string];
  portal: [string, string];
  danger: string;
  floor(g: G): void;
}

/** Where the floor stops being solid: just below the paddle, where the stars of the page show through. */
const FADE_FROM = (RAIL + PADDLE_TOP + PADDLE_H + 30) / OUTER_H;

function solidFloor(g: G, top: string, middle: string, low: string) {
  const fill = g.createLinearGradient(0, 0, 0, OUTER_H);
  const rgb = hexToRgb(low);
  fill.addColorStop(0, top); fill.addColorStop(0.5, middle); fill.addColorStop(FADE_FROM, low); fill.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = fill; g.fillRect(RAIL / 2, RAIL / 2, OUTER_W - RAIL, OUTER_H - RAIL / 2);
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
}

const LAB: World = {
  id: 'lab',
  spectrum: ['#8b5cf6', '#6366f1', '#38bdf8', '#a78bfa', '#d946ef', '#f472b6', '#8b5cf6'],
  bricks: ['#ff6b8a', '#ff9f5a', '#ffd166', '#7be0a1', '#4dd4e6', '#6aa8ff', '#a78bfa', '#e58cff'],
  style: 'glass',
  explosive: '#ff7a45',
  steel: ['#c9cfe0', '#6b7390'],
  ball: { core: '#ffffff', mid: '#ece6ff', edge: '#9d7cf6', glow: 'rgba(196,181,253,0.55)' },
  paddle: { top: '#d8ccff', mid: '#8b5cf6', bottom: '#3b1a85', glow: 'rgba(139,92,246,0.8)', mark: '#ffd166' },
  bumper: ['#c4b5fd', '#7c3aed'],
  portal: ['#38bdf8', '#f472b6'],
  danger: '#ff4d6d',
  floor(g) {
    solidFloor(g, '#1d1045', '#160c36', '#120a2c');
    const light = g.createRadialGradient(OUTER_W / 2, RAIL, 20, OUTER_W / 2, RAIL, FIELD_H * 0.8);
    light.addColorStop(0, 'rgba(139,92,246,0.18)'); light.addColorStop(1, 'rgba(139,92,246,0)');
    g.fillStyle = light; g.fillRect(RAIL / 2, RAIL / 2, OUTER_W - RAIL, OUTER_H * FADE_FROM);
  },
};

const NEON: World = {
  id: 'neon',
  spectrum: ['#22d3ee', '#3b82f6', '#a855f7', '#ec4899', '#f472b6', '#22d3ee'],
  bricks: ['#ff4fd8', '#ff8a3d', '#ffe14d', '#3dffb0', '#2ee6ff', '#4d8dff', '#b36bff', '#ff5c8a'],
  style: 'neon',
  explosive: '#ff6a3d',
  steel: ['#d7dde8', '#5d6778'],
  ball: { core: '#ffffff', mid: '#d6f6ff', edge: '#38bdf8', glow: 'rgba(56,189,248,0.6)' },
  paddle: { top: '#f2f6fb', mid: '#9aa7b8', bottom: '#3a4454', glow: 'rgba(34,211,238,0.85)', mark: '#22d3ee' },
  bumper: ['#f0abfc', '#c026d3'],
  portal: ['#22d3ee', '#ff4fd8'],
  danger: '#ff2e63',
  floor(g) {
    solidFloor(g, '#0a0f2e', '#070b22', '#05081a');
    // the city at night: a faint grid on the ground and dark towers with lit windows near the bottom
    g.save();
    g.beginPath(); g.rect(RAIL, RAIL, OUTER_W - 2 * RAIL, OUTER_H * FADE_FROM - RAIL); g.clip();
    g.strokeStyle = 'rgba(34,211,238,0.07)'; g.lineWidth = 1;
    for (let x = RAIL; x < OUTER_W - RAIL; x += 52) { g.beginPath(); g.moveTo(x, RAIL); g.lineTo(x, OUTER_H); g.stroke(); }
    for (let y = RAIL; y < OUTER_H; y += 52) { g.beginPath(); g.moveTo(RAIL, y); g.lineTo(OUTER_W - RAIL, y); g.stroke(); }
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const ground = RAIL + PADDLE_TOP + 10;
    for (let x = RAIL; x < OUTER_W - RAIL;) {
      const w = 40 + rnd() * 50, h = 80 + rnd() * 190;
      g.fillStyle = 'rgba(14,20,52,0.95)'; g.fillRect(x, ground - h, w - 4, h);
      for (let wy = ground - h + 10; wy < ground - 8; wy += 14) for (let wx = x + 6; wx < x + w - 12; wx += 10) {
        if (rnd() < 0.35) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,225,77,0.35)' : 'rgba(46,230,255,0.3)'; g.fillRect(wx, wy, 4, 6); }
      }
      x += w;
    }
    g.restore();
  },
};

const REACTOR: World = {
  id: 'reactor',
  spectrum: ['#fde047', '#f59e0b', '#ef4444', '#b91c1c', '#f97316', '#fde047'],
  bricks: ['#ff5a3c', '#ffb02e', '#ffe066', '#3ee0c0', '#5ab4ff', '#c58bff', '#ff7aa8', '#9df06a'],
  style: 'crystal',
  explosive: '#ff3b1f',
  steel: ['#b8bcc6', '#4a4f5c'],
  ball: { core: '#fffbe6', mid: '#ffd27a', edge: '#ff6a1a', glow: 'rgba(255,140,40,0.65)' },
  paddle: { top: '#9aa0ab', mid: '#4b505c', bottom: '#1d2027', glow: 'rgba(255,120,30,0.85)', mark: '#ff8a1a' },
  bumper: ['#ffd27a', '#e85d04'],
  portal: ['#3ee0c0', '#ff7a1a'],
  danger: '#ff3b1f',
  floor(g) {
    solidFloor(g, '#120709', '#0c0507', '#140706');
    const heat = g.createRadialGradient(OUTER_W / 2, OUTER_H * FADE_FROM, 20, OUTER_W / 2, OUTER_H * FADE_FROM, FIELD_H * 0.7);
    heat.addColorStop(0, 'rgba(255,90,20,0.28)'); heat.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = heat; g.fillRect(RAIL / 2, RAIL / 2, OUTER_W - RAIL, OUTER_H * FADE_FROM);
    // faint hexagon plates of the reactor floor
    g.save();
    g.beginPath(); g.rect(RAIL, RAIL, OUTER_W - 2 * RAIL, OUTER_H * FADE_FROM - RAIL); g.clip();
    g.strokeStyle = 'rgba(255,140,60,0.06)'; g.lineWidth = 1.2;
    const r = 34, w = r * Math.sqrt(3);
    for (let row = 0, y = RAIL; y < OUTER_H; row++, y += r * 1.5) {
      for (let x = RAIL + (row % 2 ? w / 2 : 0); x < OUTER_W; x += w) {
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
        g.closePath(); g.stroke();
      }
    }
    g.restore();
  },
};

export const WORLDS: Record<WorldId, World> = { lab: LAB, neon: NEON, reactor: REACTOR };
