import type { GameState } from '../core/state';
import { DX, DY } from '../core/state';
import type { StaticLayer } from './layers';
import type { Paleta } from './palette';
import type { SkinDef } from './skins/types';
import { drawParticles } from './particles';

// So leitura de estado e pintura. Nenhuma regra de jogo mora aqui.

export interface ViewOpts {
  pal: Paleta;
  skin: SkinDef;
  grao: boolean;
  shake: number; // 0..1
  zoom: number; // 1..1.04
  tempo: number; // ms desde o boot, para animacoes visuais
  morte: number; // 0..1 progresso da dissolucao
  ghost: number[] | null;
}

// Buffers reutilizados entre frames.
let ix = new Float32Array(1024);
let iy = new Float32Array(1024);
const colorCache = new Map<number, string>();

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Interpola respeitando o wrap: nao deixa a cobra atravessar a tela em risco.
function lerpWrapped(a: number, b: number, alpha: number, size: number): number {
  let d = b - a;
  if (d > size / 2) d -= size;
  else if (d < -size / 2) d += size;
  return a + d * alpha;
}

function mixColor(a: string, b: string, t: number): string {
  const key = (hash(a) ^ (hash(b) * 31) ^ (((t * 24) | 0) << 16)) | 0;
  const hit = colorCache.get(key);
  if (hit !== undefined) return hit;
  const ca = parse(a);
  const cb = parse(b);
  const out = `rgba(${(lerp(ca[0], cb[0], t) | 0)},${(lerp(ca[1], cb[1], t) | 0)},${(lerp(ca[2], cb[2], t) | 0)},${lerp(ca[3], cb[3], t).toFixed(2)})`;
  colorCache.set(key, out);
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}

const parseCache = new Map<string, [number, number, number, number]>();
function parse(c: string): [number, number, number, number] {
  const hit = parseCache.get(c);
  if (hit) return hit;
  let out: [number, number, number, number] = [255, 255, 255, 1];
  if (c.charCodeAt(0) === 35) {
    const v = parseInt(c.slice(1), 16);
    out = [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1];
  } else {
    const nums = c.replace(/[^0-9.,]/g, '').split(',');
    out = [+nums[0] || 0, +nums[1] || 0, +nums[2] || 0, nums.length > 3 ? +nums[3] : 1];
  }
  parseCache.set(c, out);
  return out;
}

export function render(
  ctx: CanvasRenderingContext2D,
  layer: StaticLayer,
  prev: GameState,
  cur: GameState,
  alpha: number,
  v: ViewOpts,
): void {
  const cell = layer.cell;
  const w = layer.pxW;
  const h = layer.pxH;

  ctx.save();
  // Zoom que respira com o combo, mais o screen shake.
  if (v.zoom !== 1 || v.shake > 0) {
    const sx = v.shake > 0 ? (Math.sin(v.tempo * 0.09) * v.shake * cell * 0.5) : 0;
    const sy = v.shake > 0 ? (Math.cos(v.tempo * 0.13) * v.shake * cell * 0.5) : 0;
    ctx.translate(w / 2 + sx, h / 2 + sy);
    ctx.scale(v.zoom, v.zoom);
    ctx.translate(-w / 2, -h / 2);
  }

  ctx.drawImage(layer.grade, 0, 0);
  drawParedes(ctx, cur, cell, v.pal);
  drawCorrupcao(ctx, cur, cell, v);
  drawFrutas(ctx, cur, cell, alpha, v);
  if (v.ghost) drawGhost(ctx, v.ghost, cell, v.pal);
  drawCobra(ctx, prev, cur, alpha, cell, v);
  drawParticles(ctx);
  ctx.restore();

  if (v.grao) {
    ctx.globalAlpha = 0.5;
    const off = (v.tempo * 0.05) % 128;
    for (let y = -128; y < h; y += 128) {
      for (let x = -128; x < w; x += 128) {
        ctx.drawImage(layer.grao, x + off, y + ((off * 1.7) % 128));
      }
    }
    ctx.globalAlpha = 1;
  }

  if (v.morte > 0) {
    ctx.fillStyle = `rgba(10,8,6,${v.morte * 0.55})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawParedes(ctx: CanvasRenderingContext2D, s: GameState, cell: number, pal: Paleta): void {
  if (s.minX === 0 && s.minY === 0 && s.maxX === s.gridW - 1 && s.maxY === s.gridH - 1) return;
  ctx.fillStyle = 'rgba(10,8,6,0.85)';
  const x0 = s.minX * cell;
  const y0 = s.minY * cell;
  const x1 = (s.maxX + 1) * cell;
  const y1 = (s.maxY + 1) * cell;
  ctx.fillRect(0, 0, s.gridW * cell, y0);
  ctx.fillRect(0, y1, s.gridW * cell, s.gridH * cell - y1);
  ctx.fillRect(0, y0, x0, y1 - y0);
  ctx.fillRect(x1, y0, s.gridW * cell - x1, y1 - y0);
  ctx.strokeStyle = pal.parede;
  ctx.lineWidth = Math.max(2, cell * 0.14);
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
}

// Corrupcao: cor que destoa, textura ruidosa animada e forma irregular,
// para nunca depender so de cor.
function drawCorrupcao(ctx: CanvasRenderingContext2D, s: GameState, cell: number, v: ViewOpts): void {
  if (s.corrCount === 0) return;
  const t = v.tempo * 0.004;
  for (let y = s.minY; y <= s.maxY; y++) {
    for (let x = s.minX; x <= s.maxX; x++) {
      const c = s.corr[y * s.gridW + x];
      if (c === 0) continue;
      const px = x * cell;
      const py = y * cell;
      ctx.fillStyle = v.pal.corrupcaoEscura;
      ctx.fillRect(px, py, cell, cell);
      // Ruido animado deterministico por celula.
      const seed = (x * 73856093) ^ (y * 19349663);
      ctx.fillStyle = v.pal.corrupcao;
      for (let k = 0; k < 5; k++) {
        const a = ((seed >> (k * 3)) & 7) / 7;
        const b = ((seed >> (k * 5 + 2)) & 7) / 7;
        const wob = Math.sin(t + a * 6.283 + k) * 0.12;
        const sz = cell * (0.14 + a * 0.16);
        ctx.fillRect(px + (a + wob) * (cell - sz), py + (b - wob) * (cell - sz), sz, sz);
      }
    }
  }
}

function drawFrutas(ctx: CanvasRenderingContext2D, s: GameState, cell: number, alpha: number, v: ViewOpts): void {
  const t = (s.tick + alpha) * 0.5;
  for (let i = 0; i < s.fruits.length; i++) {
    const f = s.fruits[i];
    const cx = (f.x + 0.5) * cell;
    const cy = (f.y + 0.5) * cell;
    switch (f.kind) {
      case 'comum': {
        ctx.fillStyle = v.pal.fruta;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'madura': {
        // Pisca e ganha espinhos: forma diferente, nao so cor.
        const p = 0.5 + 0.5 * Math.sin(t * 3);
        ctx.fillStyle = v.pal.frutaMadura;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * (0.3 + p * 0.06), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = v.pal.frutaMadura;
        ctx.lineWidth = Math.max(1, cell * 0.07);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + t * 0.4;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * cell * 0.34, cy + Math.sin(a) * cell * 0.34);
          ctx.lineTo(cx + Math.cos(a) * cell * (0.46 + p * 0.08), cy + Math.sin(a) * cell * (0.46 + p * 0.08));
          ctx.stroke();
        }
        break;
      }
      case 'amarga': {
        ctx.fillStyle = v.pal.frutaAmarga;
        poly(ctx, cx, cy, cell * 0.34, 6, t * 0.2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = Math.max(1, cell * 0.06);
        ctx.beginPath();
        ctx.moveTo(cx - cell * 0.14, cy);
        ctx.lineTo(cx + cell * 0.14, cy);
        ctx.stroke();
        break;
      }
      case 'espelho': {
        ctx.fillStyle = v.pal.frutaEspelho;
        poly(ctx, cx, cy, cell * 0.34, 4, Math.PI / 4 + t * 0.3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = Math.max(1, cell * 0.05);
        poly(ctx, cx, cy, cell * 0.18, 4, Math.PI / 4 - t * 0.3);
        ctx.stroke();
        break;
      }
    }
  }
}

function poly(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawGhost(ctx: CanvasRenderingContext2D, body: number[], cell: number, pal: Paleta): void {
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = pal.osso;
  for (let i = 0; i < body.length; i += 2) {
    ctx.beginPath();
    ctx.arc((body[i] + 0.5) * cell, (body[i + 1] + 0.5) * cell, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCobra(
  ctx: CanvasRenderingContext2D,
  prev: GameState,
  cur: GameState,
  alpha: number,
  cell: number,
  v: ViewOpts,
): void {
  const n = cur.body.length >> 1;
  if (n === 0) return;
  if (ix.length < n) {
    ix = new Float32Array(n * 2);
    iy = new Float32Array(n * 2);
  }
  const pn = prev.body.length >> 1;
  for (let i = 0; i < n; i++) {
    const cx = cur.body[i * 2];
    const cy = cur.body[i * 2 + 1];
    if (i < pn) {
      ix[i] = lerpWrapped(prev.body[i * 2], cx, alpha, cur.gridW);
      iy[i] = lerpWrapped(prev.body[i * 2 + 1], cy, alpha, cur.gridH);
    } else {
      ix[i] = cx;
      iy[i] = cy;
    }
  }

  const skin = v.skin;
  // Morte: a cobra se desfaz de tras para frente.
  const visiveis = v.morte > 0 ? Math.max(0, Math.ceil(n * (1 - v.morte))) : n;
  const fase = cur.faseTimer > 0;
  if (fase) ctx.globalAlpha = 0.55;

  // Espinha: liga os segmentos em um corpo unico em vez de contas soltas.
  // Trechos que dao a volta pela borda sao quebrados, senao viraria um
  // risco atravessando a tela.
  if (skin.espinha > 0 && visiveis > 1) {
    ctx.strokeStyle = mixColor(skin.cabeca, skin.cauda, 0.45);
    ctx.lineWidth = cell * skin.espinha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    let aberto = false;
    for (let i = 0; i < visiveis; i++) {
      const x = (ix[i] + 0.5) * cell;
      const y = (iy[i] + 0.5) * cell;
      if (!aberto) {
        ctx.moveTo(x, y);
        aberto = true;
        continue;
      }
      const salto = Math.abs(ix[i] - ix[i - 1]) > 1.5 || Math.abs(iy[i] - iy[i - 1]) > 1.5;
      if (salto) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (let i = visiveis - 1; i >= 1; i--) {
    const t = i / Math.max(1, n - 1);
    drawSegmento(ctx, ix[i], iy[i], cell, t, i, skin, v);
  }
  if (visiveis >= 1) drawCabeca(ctx, ix[0], iy[0], cell, cur.dir, skin, v);
  ctx.globalAlpha = 1;
}

function drawSegmento(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  cell: number,
  t: number,
  idx: number,
  skin: SkinDef,
  v: ViewOpts,
): void {
  const x = (gx + 0.5) * cell;
  const y = (gy + 0.5) * cell;
  let cor = mixColor(skin.cabeca, skin.cauda, t);
  if (skin.pulso > 0) {
    // Pulso de luz correndo da cauda para a cabeca.
    const p = Math.sin(idx * 0.5 - v.tempo * 0.008);
    if (p > 0.72) cor = mixColor(cor, skin.acento, (p - 0.72) / 0.28 * skin.pulso);
  }
  ctx.fillStyle = cor;
  const r = cell * (0.42 - 0.1 * t);

  switch (skin.forma) {
    case 'vertebra': {
      ctx.fillRect(x - r * 0.55, y - r, r * 1.1, r * 2);
      ctx.fillRect(x - r, y - r * 0.34, r * 2, r * 0.68);
      break;
    }
    case 'bloco':
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      if (skin.contorno) {
        ctx.strokeStyle = skin.contorno;
        ctx.lineWidth = Math.max(1, cell * 0.05);
        ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      }
      break;
    case 'faceta':
      poly(ctx, x, y, r * 1.15, 5, idx * 0.7);
      ctx.fill();
      if (skin.contorno) {
        ctx.strokeStyle = skin.contorno;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      break;
    case 'particula': {
      const j = Math.sin(idx * 2.1 + v.tempo * 0.006) * cell * 0.14;
      const j2 = Math.cos(idx * 1.7 + v.tempo * 0.005) * cell * 0.14;
      ctx.beginPath();
      ctx.arc(x + j, y + j2, r * 0.5, 0, Math.PI * 2);
      ctx.arc(x - j2, y + j, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'fita':
      ctx.fillRect(x - r, y - r * 0.42, r * 2, r * 0.84);
      ctx.fillStyle = skin.acento;
      ctx.fillRect(x - r, y - r * 0.1, r * 2, r * 0.2);
      break;
    case 'vidro':
      ctx.globalAlpha *= 0.72;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha /= 0.72;
      if (skin.contorno) {
        ctx.strokeStyle = skin.contorno;
        ctx.lineWidth = Math.max(1, cell * 0.04);
        ctx.stroke();
      }
      break;
    case 'pilula':
      roundRect(ctx, x - r, y - r * 0.8, r * 2, r * 1.6, r * 0.8);
      ctx.fill();
      break;
    default:
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
  }
}

function drawCabeca(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  cell: number,
  dir: number,
  skin: SkinDef,
  v: ViewOpts,
): void {
  const x = (gx + 0.5) * cell;
  const y = (gy + 0.5) * cell;
  const r = cell * 0.48;
  ctx.fillStyle = skin.cabeca;
  if (skin.forma === 'bloco' || skin.forma === 'fita') {
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  } else if (skin.forma === 'faceta') {
    poly(ctx, x, y, r * 1.1, 5, 0);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (skin.contorno) {
    ctx.strokeStyle = skin.contorno;
    ctx.lineWidth = Math.max(1, cell * 0.06);
    ctx.stroke();
  }

  const ox = x + DX[dir] * cell * 0.17;
  const oy = y + DY[dir] * cell * 0.17;
  const perpX = DY[dir] * cell * 0.15;
  const perpY = DX[dir] * cell * 0.15;
  ctx.fillStyle = skin.olho === 'led' || skin.olho === 'vazio' ? skin.acento : v.pal.fundo;

  switch (skin.olho) {
    case 'fenda':
      ctx.fillRect(ox - Math.abs(perpY) - 1, oy - Math.abs(perpX) - 1, Math.abs(perpY) * 2 + 2, Math.abs(perpX) * 2 + 2);
      break;
    case 'cruz':
      ctx.fillRect(ox - cell * 0.12, oy - cell * 0.03, cell * 0.24, cell * 0.06);
      ctx.fillRect(ox - cell * 0.03, oy - cell * 0.12, cell * 0.06, cell * 0.24);
      break;
    case 'anel':
      ctx.strokeStyle = v.pal.fundo;
      ctx.lineWidth = Math.max(1, cell * 0.06);
      ctx.beginPath();
      ctx.arc(ox, oy, cell * 0.13, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'vazio':
      ctx.beginPath();
      ctx.arc(ox, oy, cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    default: {
      ctx.beginPath();
      ctx.arc(ox + perpX * 0.7, oy + perpY * 0.7, cell * 0.09, 0, Math.PI * 2);
      ctx.arc(ox - perpX * 0.7, oy - perpY * 0.7, cell * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
