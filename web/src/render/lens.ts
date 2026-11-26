// The star field behind the game: slow stars that bend away from the pointer like light around a mass,
// the same look as the krinkerlabs.com background. With "reduce motion" the stars are drawn once and stay still.
const COLORS = ['#C4B5FD', '#A78BFA', '#8B5CF6', '#DDD6FE', '#FFFFFF'];
const LENS_RADIUS = 200, LENS_MASS = 110;

interface Star { homeX: number; homeY: number; size: number; vx: number; vy: number; color: string; alpha: number }

export const starCount = (w: number, h: number) => Math.min(Math.floor((w * h) / 5000), w < 500 ? 70 : 220);

/** Where a star is drawn while the pointer is near: pushed away from it. Null outside the lens. */
export function bend(homeX: number, homeY: number, px: number, py: number): { x: number; y: number } | null {
  const dx = px - homeX, dy = py - homeY, d = Math.hypot(dx, dy);
  if (d >= LENS_RADIUS || d <= 1) return null;
  const push = (1 - d / LENS_RADIUS) * LENS_MASS;
  return { x: homeX - (dx / d) * push, y: homeY - (dy / d) * push };
}

const makeStars = (w: number, h: number): Star[] => Array.from({ length: starCount(w, h) }, () => ({
  homeX: Math.random() * w, homeY: Math.random() * h, size: Math.random() * 1.6 + 0.5,
  vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
  color: COLORS[Math.floor(Math.random() * COLORS.length)], alpha: Math.random() * 0.7 + 0.3,
}));

export function startLens(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, stars: Star[] = [];
  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  window.addEventListener('pointermove', (e) => { pointer.tx = e.clientX; pointer.ty = e.clientY; if (pointer.x < -999) { pointer.x = pointer.tx; pointer.y = pointer.ty; } });

  function fit() {
    const ratio = window.devicePixelRatio || 1;
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * ratio; canvas.height = h * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    stars = makeStars(w, h);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const b = bend(s.homeX, s.homeY, pointer.x, pointer.y);
      ctx.globalAlpha = s.alpha; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(b ? b.x : s.homeX, b ? b.y : s.homeY, s.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tick() {
    pointer.x += (pointer.tx - pointer.x) * 0.12; pointer.y += (pointer.ty - pointer.y) * 0.12;
    if (canvas.clientWidth !== w || canvas.clientHeight !== h) fit();
    for (const s of stars) { s.homeX = (s.homeX + s.vx + w) % w; s.homeY = (s.homeY + s.vy + h) % h; }
    draw();
    requestAnimationFrame(tick);
  }

  fit();
  if (still) draw(); else requestAnimationFrame(tick);
}
