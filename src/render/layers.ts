// Camada estatica: fundo e grade desenhados uma unica vez em canvas offscreen.

export interface StaticLayer {
  canvas: HTMLCanvasElement;
  cell: number;
  pxW: number;
  pxH: number;
}

export const BG_COLOR = '#16130F';
const GRID_COLOR = 'rgba(226, 218, 200, 0.06)';

export function buildStaticLayer(gridW: number, gridH: number, cell: number): StaticLayer {
  const pxW = gridW * cell;
  const pxH = gridH * cell;
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sem contexto 2d');

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, pxW, pxH);

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < gridW; x++) {
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, pxH);
  }
  for (let y = 1; y < gridH; y++) {
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(pxW, y * cell + 0.5);
  }
  ctx.stroke();

  // Vinheta leve, tambem estatica.
  const g = ctx.createRadialGradient(pxW / 2, pxH / 2, Math.min(pxW, pxH) * 0.45, pxW / 2, pxH / 2, Math.max(pxW, pxH) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, pxW, pxH);

  return { canvas, cell, pxW, pxH };
}
