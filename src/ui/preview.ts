import type { SkinDef } from '../render/skins/types';
import type { RelicId, ModeId } from '../core/config';

// Previas da loja, desenhadas em canvas pequenos: a mini cobra de cada
// skin e os icones das reliquias. Nada de PNG e nada de emoji.

function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  const r = (pa[0] + (pb[0] - pa[0]) * t) | 0;
  const g = (pa[1] + (pb[1] - pa[1]) * t) | 0;
  const bl = (pa[2] + (pb[2] - pa[2]) * t) | 0;
  const al = pa[3] + (pb[3] - pa[3]) * t;
  return `rgba(${r},${g},${bl},${al.toFixed(2)})`;
}

function parse(c: string): [number, number, number, number] {
  if (c.charCodeAt(0) === 35) {
    const v = parseInt(c.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1];
  }
  const n = c.replace(/[^0-9.,]/g, '').split(',');
  return [+n[0] || 0, +n[1] || 0, +n[2] || 0, n.length > 3 ? +n[3] : 1];
}

function poly(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

// Mini cobra de 5 segmentos ondulando, cabeca a direita, na cara da skin.
export function drawSkinPreview(canvas: HTMLCanvasElement, skin: SkinDef): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const n = 5;
  const passo = w / (n + 1);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    xs[i] = w - passo * (i + 0.9);
    ys[i] = h / 2 + Math.sin(i * 1.1) * h * 0.14;
  }

  if (skin.espinha > 0) {
    ctx.strokeStyle = mix(skin.cabeca, skin.cauda, 0.45);
    ctx.lineWidth = passo * skin.espinha * 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.stroke();
  }

  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1);
    const r = passo * (0.5 - 0.12 * t);
    const cor = i === 0 ? skin.cabeca : mix(skin.cabeca, skin.cauda, t);
    ctx.fillStyle = cor;
    const x = xs[i];
    const y = ys[i];
    switch (skin.forma) {
      case 'bloco':
      case 'fita':
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        break;
      case 'vertebra':
        ctx.fillRect(x - r * 0.55, y - r, r * 1.1, r * 2);
        ctx.fillRect(x - r, y - r * 0.34, r * 2, r * 0.68);
        break;
      case 'faceta':
        poly(ctx, x, y, r * 1.15, 5, i * 0.7);
        ctx.fill();
        break;
      case 'particula':
        ctx.beginPath();
        ctx.arc(x + r * 0.3, y - r * 0.25, r * 0.5, 0, Math.PI * 2);
        ctx.arc(x - r * 0.35, y + r * 0.3, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'vidro':
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      default:
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    if (skin.contorno) {
      ctx.strokeStyle = skin.contorno;
      ctx.lineWidth = Math.max(1, r * 0.14);
      if (skin.forma === 'bloco' || skin.forma === 'fita') ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Olho e um toque do acento, que e a assinatura da skin.
  ctx.fillStyle = skin.olho === 'led' || skin.olho === 'vazio' ? skin.acento : '#16130F';
  ctx.beginPath();
  ctx.arc(xs[0] + passo * 0.16, ys[0] - passo * 0.06, passo * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.acento;
  ctx.fillRect(w * 0.06, h * 0.82, w * 0.2, Math.max(2, h * 0.05));
}

// Icones das reliquias: formas simples que lembram o efeito.
export function drawRelicIcon(canvas: HTMLCanvasElement, id: RelicId, cor: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.32;
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (id) {
    case 'casca': {
      // Escudo
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 1.1);
      ctx.lineTo(cx + r, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.8, cy + r * 0.6);
      ctx.lineTo(cx, cy + r * 1.1);
      ctx.lineTo(cx - r * 0.8, cy + r * 0.6);
      ctx.lineTo(cx - r, cy - r * 0.5);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.35);
      ctx.lineTo(cx + r * 0.45, cy - r * 0.35);
      ctx.stroke();
      break;
    }
    case 'metabolismo': {
      // Seta para baixo sobre um segmento: custo menor
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.55, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 1.1);
      ctx.lineTo(cx, cy - r * 0.1);
      ctx.moveTo(cx - r * 0.45, cy - r * 0.55);
      ctx.lineTo(cx, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.45, cy - r * 0.55);
      ctx.stroke();
      break;
    }
    case 'simbiose': {
      // Moeda saindo de um bloco de corrupcao
      ctx.strokeRect(cx - r, cy - r * 0.2, r * 0.9, r * 0.9);
      ctx.beginPath();
      ctx.arc(cx + r * 0.5, cy - r * 0.35, r * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.5, cy - r * 0.35, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'fome': {
      // x2 tracado
      const f = Math.floor(r * 1.5);
      ctx.font = `800 ${f}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x2', cx, cy + r * 0.05);
      break;
    }
    case 'muda': {
      // Segmentos caindo da cauda
      ctx.beginPath();
      ctx.arc(cx - r * 0.6, cy - r * 0.6, r * 0.42, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.1, cy - r * 0.5, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(cx + r * 0.55, cy + r * 0.2, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(cx + r * 0.8, cy + r * 0.8, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
  }
}

// Icones dos modos no menu: cada um conta a regra que o define.
export function drawModeIcon(canvas: HTMLCanvasElement, id: ModeId, cor: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.3;
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = Math.max(2, r * 0.2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (id) {
    case 'ouroboro': {
      // A cobra que morde a propria cauda
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0.55, Math.PI * 2 - 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + Math.cos(0.55) * r, cy + Math.sin(0.55) * r, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'classico': {
      // Grade fechada por paredes
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.33, cy - r);
      ctx.lineTo(cx - r * 0.33, cy + r);
      ctx.moveTo(cx + r * 0.33, cy - r);
      ctx.lineTo(cx + r * 0.33, cy + r);
      ctx.moveTo(cx - r, cy - r * 0.33);
      ctx.lineTo(cx + r, cy - r * 0.33);
      ctx.moveTo(cx - r, cy + r * 0.33);
      ctx.lineTo(cx + r, cy + r * 0.33);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'diario': {
      // Folha de calendario
      ctx.strokeRect(cx - r, cy - r * 0.8, r * 2, r * 1.7);
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r * 0.25);
      ctx.lineTo(cx + r, cy - r * 0.25);
      ctx.moveTo(cx - r * 0.5, cy - r * 1.15);
      ctx.lineTo(cx - r * 0.5, cy - r * 0.55);
      ctx.moveTo(cx + r * 0.5, cy - r * 1.15);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.35, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'fantasma': {
      // Duas cobras, uma translucida
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(cx - r * 0.75, cy - r * 0.3, r * 0.42, 0, Math.PI * 2);
      ctx.arc(cx, cy - r * 0.3, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy + r * 0.55, r * 0.42, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.5, cy + r * 0.55, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'aperto': {
      // Quatro setas apontando para dentro
      ctx.strokeRect(cx - r * 0.45, cy - r * 0.45, r * 0.9, r * 0.9);
      const seta = (dx: number, dy: number): void => {
        ctx.beginPath();
        ctx.moveTo(cx + dx * r * 1.25, cy + dy * r * 1.25);
        ctx.lineTo(cx + dx * r * 0.7, cy + dy * r * 0.7);
        ctx.stroke();
      };
      seta(-1, 0);
      seta(1, 0);
      seta(0, -1);
      seta(0, 1);
      break;
    }
  }
}
