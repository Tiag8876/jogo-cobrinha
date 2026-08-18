import type { GameState } from '../core/state';
import type { StaticLayer } from './layers';

// Desenha um GameState interpolado entre o tick anterior e o atual.
// Nenhuma logica de jogo aqui: so leitura de estado e pintura.

const SNAKE_COLOR = '#D9A441';
const SNAKE_TAIL_COLOR = '#7A5A22';
const HEAD_COLOR = '#F2C464';
const EYE_COLOR = '#16130F';
const FRUIT_COLOR = '#C94F3D';

// Buffers reutilizados entre frames para nao alocar no loop.
let ix: number[] = [];
let iy: number[] = [];

function lerpWrapped(a: number, b: number, alpha: number, size: number): number {
  let d = b - a;
  if (d > size / 2) d -= size;
  else if (d < -size / 2) d += size;
  return a + d * alpha;
}

export function render(
  ctx: CanvasRenderingContext2D,
  layer: StaticLayer,
  prev: GameState,
  cur: GameState,
  alpha: number,
  eatPulse: number,
): void {
  const cell = layer.cell;
  ctx.drawImage(layer.canvas, 0, 0);

  // Frutas: circulo que pulsa devagar.
  const pulse = 1 + 0.06 * Math.sin(cur.tick * 0.6 + alpha * 0.6);
  ctx.fillStyle = FRUIT_COLOR;
  for (let i = 0; i < cur.fruits.length; i++) {
    const f = cur.fruits[i];
    const cx = (f.x + 0.5) * cell;
    const cy = (f.y + 0.5) * cell;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.32 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Haste, para a fruta nao ser so cor.
    ctx.strokeStyle = 'rgba(226,218,200,0.5)';
    ctx.lineWidth = Math.max(1, cell * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx, cy - cell * 0.3);
    ctx.lineTo(cx + cell * 0.12, cy - cell * 0.44);
    ctx.stroke();
  }

  // Posicoes interpoladas de cada segmento.
  const n = cur.body.length / 2;
  if (ix.length < n) {
    ix = new Array(n);
    iy = new Array(n);
  }
  const pn = prev.body.length / 2;
  for (let i = 0; i < n; i++) {
    const cxg = cur.body[i * 2];
    const cyg = cur.body[i * 2 + 1];
    if (i < pn) {
      ix[i] = lerpWrapped(prev.body[i * 2], cxg, alpha, cur.gridW);
      iy[i] = lerpWrapped(prev.body[i * 2 + 1], cyg, alpha, cur.gridH);
    } else {
      // Segmento novo (crescimento): nasce parado na posicao atual.
      ix[i] = cxg;
      iy[i] = cyg;
    }
  }

  // Corpo desenhado da cauda para a cabeca, com raio e cor degradando.
  for (let i = n - 1; i >= 1; i--) {
    const t = i / Math.max(1, n - 1);
    const r = cell * (0.42 - 0.12 * t);
    ctx.fillStyle = mix(SNAKE_COLOR, SNAKE_TAIL_COLOR, t);
    drawSegment(ctx, ix[i], iy[i], cell, r, cur.gridW, cur.gridH);
  }

  // Cabeca, com pulso ao comer.
  const headR = cell * 0.46 * (1 + 0.25 * eatPulse);
  ctx.fillStyle = HEAD_COLOR;
  drawSegment(ctx, ix[0], iy[0], cell, headR, cur.gridW, cur.gridH);

  // Olho na direcao do movimento.
  const hx = (wrap(ix[0], cur.gridW) + 0.5) * cell;
  const hy = (wrap(iy[0], cur.gridH) + 0.5) * cell;
  const dxs = [0, 1, 0, -1];
  const dys = [-1, 0, 1, 0];
  ctx.fillStyle = EYE_COLOR;
  ctx.beginPath();
  ctx.arc(hx + dxs[cur.dir] * cell * 0.16, hy + dys[cur.dir] * cell * 0.16, cell * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function wrap(v: number, size: number): number {
  return ((v % size) + size) % size;
}

function drawSegment(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  cell: number,
  r: number,
  gridW: number,
  gridH: number,
): void {
  const x = (wrap(gx, gridW) + 0.5) * cell;
  const y = (wrap(gy, gridH) + 0.5) * cell;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Mistura simples entre duas cores hex. So roda por segmento, barato.
const mixCache = new Map<string, string>();
function mix(a: string, b: string, t: number): string {
  const key = a + b + ((t * 16) | 0);
  const hit = mixCache.get(key);
  if (hit) return hit;
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = (((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t) | 0;
  const g = (((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t) | 0;
  const bl = ((pa & 255) * (1 - t) + (pb & 255) * t) | 0;
  const out = `rgb(${r},${g},${bl})`;
  mixCache.set(key, out);
  return out;
}
