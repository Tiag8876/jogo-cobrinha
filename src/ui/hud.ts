import type { GameState } from '../core/state';
import { segmentCount, custoPoder } from '../core/state';
import { POWERS, MIN_LENGTH, COMBO_MAX, OURO_SEGMENTOS } from '../core/config';
import type { PowerId } from '../core/config';
import type { Paleta } from '../render/palette';

// HUD minimo: energia como barra vertical, combo como numero grande que
// treme, poderes como tres icones no rodape. Tudo desenhado, sem DOM.

export interface Layout {
  cell: number;
  arenaX: number;
  arenaY: number;
  arenaPx: number;
  w: number;
  h: number;
  esquerda: number;
  rodape: number;
}

const FONTE = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function drawHud(
  ctx: CanvasRenderingContext2D,
  lay: Layout,
  s: GameState,
  pal: Paleta,
  tempo: number,
  moedasSessao: number,
): void {
  const segs = segmentCount(s);

  // Barra de energia vertical a esquerda. O comprimento e a energia.
  const bw = Math.max(8, lay.esquerda * 0.34);
  const bx = lay.esquerda * 0.3;
  const by = lay.arenaY + lay.arenaPx * 0.06;
  const bh = lay.arenaPx * 0.88;
  ctx.fillStyle = 'rgba(226,218,200,0.09)';
  ctx.fillRect(bx, by, bw, bh);

  const frac = Math.max(0, Math.min(1, segs / 40));
  const fill = bh * frac;
  const grad = ctx.createLinearGradient(0, by + bh - fill, 0, by + bh);
  grad.addColorStop(0, pal.osso);
  grad.addColorStop(1, '#D9A441');
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by + bh - fill, bw, fill);

  // Marcas dos custos: mostra quanto cada poder come da barra.
  ctx.fillStyle = 'rgba(22,19,15,0.85)';
  for (let i = 0; i < s.powers.length; i++) {
    const custo = custoPoder(s, s.powers[i].id);
    const y = by + bh - (bh * (custo + MIN_LENGTH)) / 40;
    if (y > by) ctx.fillRect(bx, y, bw, 2);
  }
  // Piso de morte por fome, sempre visivel.
  ctx.fillStyle = pal.perigo;
  ctx.fillRect(bx, by + bh - (bh * MIN_LENGTH) / 40 - 1, bw, 2);

  ctx.fillStyle = pal.osso;
  ctx.textAlign = 'center';
  ctx.font = `700 ${Math.floor(bw * 0.9)}px ${FONTE}`;
  ctx.fillText(String(segs), bx + bw / 2, by + bh + bw * 1.2);
  ctx.font = `400 ${Math.floor(bw * 0.5)}px ${FONTE}`;
  ctx.globalAlpha = 0.6;
  ctx.fillText('ENERGIA', bx + bw / 2, by - bw * 0.4);
  ctx.globalAlpha = 1;

  // Combo: numero grande que treme quanto maior estiver.
  if (s.combo > 1) {
    const tremor = (s.combo / COMBO_MAX) * 2.2;
    const tx = lay.arenaX + lay.arenaPx * 0.5 + Math.sin(tempo * 0.05) * tremor;
    const ty = lay.arenaY + lay.arenaPx * 0.16 + Math.cos(tempo * 0.07) * tremor;
    const tam = lay.arenaPx * (0.09 + 0.012 * s.combo);
    ctx.globalAlpha = 0.14 + 0.05 * s.combo;
    ctx.fillStyle = s.espelhoTimer > 0 ? pal.frutaEspelho : pal.osso;
    ctx.font = `800 ${Math.floor(tam)}px ${FONTE}`;
    ctx.fillText(`x${s.espelhoTimer > 0 ? s.combo * 2 : s.combo}`, tx, ty);
    ctx.globalAlpha = 1;

    // Timer do combo como um arco fino embaixo do numero.
    const w = lay.arenaPx * 0.2;
    const fracT = Math.max(0, Math.min(1, s.comboTimer / 30));
    ctx.fillStyle = 'rgba(226,218,200,0.16)';
    ctx.fillRect(tx - w / 2, ty + tam * 0.12, w, 3);
    ctx.fillStyle = fracT < 0.3 ? pal.perigo : pal.osso;
    ctx.fillRect(tx - w / 2, ty + tam * 0.12, w * fracT, 3);
  }

  // Placar e moedas no topo.
  // O topo e estreito: o texto se ajusta a ele, nunca ao tamanho da arena.
  const topoFonte = Math.floor(Math.min(lay.arenaPx * 0.045, lay.arenaY * 0.62));
  const baseline = lay.arenaY - Math.max(4, lay.arenaY * 0.12);
  ctx.textAlign = 'left';
  ctx.font = `700 ${topoFonte}px ${FONTE}`;
  ctx.fillStyle = pal.osso;
  ctx.fillText(String(s.score), lay.arenaX, baseline);
  ctx.textAlign = 'right';
  ctx.font = `400 ${Math.floor(topoFonte * 0.7)}px ${FONTE}`;
  ctx.globalAlpha = 0.75;
  ctx.fillText(`${moedasSessao + s.coins} moedas`, lay.arenaX + lay.arenaPx, baseline);
  ctx.globalAlpha = 1;

  drawPoderes(ctx, lay, s, pal);
}

function drawPoderes(ctx: CanvasRenderingContext2D, lay: Layout, s: GameState, pal: Paleta): void {
  const n = 3;
  const tam = Math.min(lay.rodape * 0.72, lay.arenaPx / 6);
  const gap = tam * 0.28;
  const total = n * tam + (n - 1) * gap + tam * 1.4;
  let x = lay.arenaX + (lay.arenaPx - total) / 2;
  const y = lay.arenaY + lay.arenaPx + lay.rodape * 0.14;
  const segs = segmentCount(s);

  for (let i = 0; i < n; i++) {
    const p = s.powers[i];
    ctx.fillStyle = 'rgba(226,218,200,0.07)';
    ctx.fillRect(x, y, tam, tam);
    if (p) {
      const def = POWERS[p.id];
      const custo = custoPoder(s, p.id);
      const pronto = p.cd === 0 && segs - custo >= MIN_LENGTH;
      ctx.globalAlpha = pronto ? 1 : 0.35;
      drawIcone(ctx, p.id, x + tam / 2, y + tam * 0.42, tam * 0.3, pal.osso);
      ctx.globalAlpha = 1;

      // Recarga como preenchimento de baixo para cima.
      if (p.cd > 0) {
        const f = p.cd / def.cooldown;
        ctx.fillStyle = 'rgba(22,19,15,0.6)';
        ctx.fillRect(x, y, tam, tam * f);
      }
      ctx.fillStyle = pronto ? pal.osso : pal.perigo;
      ctx.font = `700 ${Math.floor(tam * 0.22)}px ${FONTE}`;
      ctx.textAlign = 'center';
      ctx.fillText(`-${custo}`, x + tam / 2, y + tam * 0.92);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 0.5;
      ctx.font = `400 ${Math.floor(tam * 0.2)}px ${FONTE}`;
      ctx.fillText(String(i + 1), x + tam * 0.08, y + tam * 0.22);
      ctx.globalAlpha = 1;
    }
    x += tam + gap;
  }

  // Botao do Ouroboro, o mais destacado do rodape.
  const ow = tam * 1.4;
  const podeOuro = segs - OURO_SEGMENTOS >= MIN_LENGTH;
  ctx.globalAlpha = podeOuro ? 1 : 0.3;
  ctx.strokeStyle = '#D9A441';
  ctx.lineWidth = Math.max(2, tam * 0.06);
  ctx.beginPath();
  ctx.arc(x + ow / 2, y + tam / 2, tam * 0.36, 0.5, Math.PI * 2 - 0.2);
  ctx.stroke();
  // A cobra que morde a propria cauda.
  ctx.beginPath();
  ctx.arc(x + ow / 2 + Math.cos(0.5) * tam * 0.36, y + tam / 2 + Math.sin(0.5) * tam * 0.36, tam * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = '#D9A441';
  ctx.fill();
  ctx.font = `700 ${Math.floor(tam * 0.2)}px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.fillText(`-${OURO_SEGMENTOS}`, x + ow / 2, y + tam * 0.98);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// Icones vetoriais, sem sprite e sem emoji.
function drawIcone(ctx: CanvasRenderingContext2D, id: PowerId, cx: number, cy: number, r: number, cor: string): void {
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = Math.max(1.5, r * 0.2);
  switch (id) {
    case 'fase':
      ctx.globalAlpha *= 0.5;
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      ctx.globalAlpha /= 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.2, cy);
      ctx.lineTo(cx + r * 1.2, cy);
      ctx.stroke();
      break;
    case 'dash':
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r * 0.6);
      ctx.lineTo(cx + r * 0.4, cy);
      ctx.lineTo(cx - r, cy + r * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.2, cy - r * 0.6);
      ctx.lineTo(cx + r * 1.1, cy);
      ctx.lineTo(cx + r * 0.2, cy + r * 0.6);
      ctx.stroke();
      break;
    case 'rebobinar':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0.6, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.5, cy - r * 1.1);
      ctx.lineTo(cx + r * 1.0, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.1, cy - r * 0.35);
      ctx.fill();
      break;
    case 'ima':
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.3, r, Math.PI, 0);
      ctx.stroke();
      ctx.fillRect(cx - r - ctx.lineWidth / 2, cy + r * 0.3, ctx.lineWidth, r * 0.7);
      ctx.fillRect(cx + r - ctx.lineWidth / 2, cy + r * 0.3, ctx.lineWidth, r * 0.7);
      break;
    case 'onda':
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha *= 0.75;
        ctx.beginPath();
        ctx.arc(cx, cy, (r * i) / 2.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    case 'dilatacao':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.6);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.2);
      ctx.stroke();
      break;
    case 'semear':
      ctx.beginPath();
      ctx.arc(cx - r * 0.5, cy + r * 0.4, r * 0.32, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.5, cy + r * 0.4, r * 0.32, 0, Math.PI * 2);
      ctx.arc(cx, cy - r * 0.5, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}
