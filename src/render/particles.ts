// Pool pre alocado. Nada de alocar dentro do loop de jogo.

const MAX = 512;

const px = new Float32Array(MAX);
const py = new Float32Array(MAX);
const vx = new Float32Array(MAX);
const vy = new Float32Array(MAX);
const life = new Float32Array(MAX);
const maxLife = new Float32Array(MAX);
const size = new Float32Array(MAX);
const kind = new Uint8Array(MAX); // 0 ponto, 1 quadrado, 2 risco
const r = new Uint8Array(MAX);
const g = new Uint8Array(MAX);
const b = new Uint8Array(MAX);

let cursor = 0;
let vivos = 0;

export const KIND_PONTO = 0;
export const KIND_QUADRADO = 1;
export const KIND_RISCO = 2;

// Semente propria: o visual nao pode consumir o rng da simulacao.
let seed = 0x9e3779b9;
function rnd(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) % 10000) / 10000;
}

export function emit(
  x: number,
  y: number,
  n: number,
  speed: number,
  ttl: number,
  s: number,
  k: number,
  cr: number,
  cg: number,
  cb: number,
  dirBias: number,
): void {
  for (let i = 0; i < n; i++) {
    const idx = cursor;
    cursor = (cursor + 1) % MAX;
    if (life[idx] <= 0) vivos++;
    const ang = dirBias >= 0 ? dirBias + (rnd() - 0.5) * 1.6 : rnd() * Math.PI * 2;
    const sp = speed * (0.4 + rnd() * 0.8);
    px[idx] = x;
    py[idx] = y;
    vx[idx] = Math.cos(ang) * sp;
    vy[idx] = Math.sin(ang) * sp;
    life[idx] = ttl;
    maxLife[idx] = ttl;
    size[idx] = s * (0.6 + rnd() * 0.8);
    kind[idx] = k;
    r[idx] = cr;
    g[idx] = cg;
    b[idx] = cb;
  }
}

export function updateParticles(dtMs: number, gravity: number): void {
  if (vivos === 0) return;
  const dt = dtMs / 1000;
  vivos = 0;
  for (let i = 0; i < MAX; i++) {
    if (life[i] <= 0) continue;
    life[i] -= dtMs;
    if (life[i] <= 0) continue;
    vivos++;
    px[i] += vx[i] * dt;
    py[i] += vy[i] * dt;
    vy[i] += gravity * dt;
    vx[i] *= 0.98;
    vy[i] *= 0.98;
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D): void {
  if (vivos === 0) return;
  for (let i = 0; i < MAX; i++) {
    const l = life[i];
    if (l <= 0) continue;
    const a = l / maxLife[i];
    ctx.globalAlpha = a * a;
    ctx.fillStyle = `rgb(${r[i]},${g[i]},${b[i]})`;
    const s = size[i] * (0.3 + a * 0.7);
    if (kind[i] === KIND_QUADRADO) {
      ctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s);
    } else if (kind[i] === KIND_RISCO) {
      ctx.fillRect(px[i], py[i], s * 2.2, Math.max(1, s * 0.4));
    } else {
      ctx.beginPath();
      ctx.arc(px[i], py[i], s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function clearParticles(): void {
  life.fill(0);
  vivos = 0;
}

export function particleCount(): number {
  return vivos;
}
