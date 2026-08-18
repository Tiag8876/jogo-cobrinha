import type { Paleta } from './palette';

// Camadas estaticas desenhadas uma vez em canvas offscreen:
// grade da arena e o grao de filme, que so e sorteado no boot.

export interface StaticLayer {
  grade: HTMLCanvasElement;
  grao: HTMLCanvasElement;
  cell: number;
  pxW: number;
  pxH: number;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export function buildStaticLayer(gridW: number, gridH: number, cell: number, pal: Paleta): StaticLayer {
  const pxW = gridW * cell;
  const pxH = gridH * cell;
  const grade = makeCanvas(pxW, pxH);
  const ctx = grade.getContext('2d');
  if (!ctx) throw new Error('sem contexto 2d');

  ctx.fillStyle = pal.fundo;
  ctx.fillRect(0, 0, pxW, pxH);
  ctx.strokeStyle = pal.grade;
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

  const g = ctx.createRadialGradient(pxW / 2, pxH / 2, Math.min(pxW, pxH) * 0.42, pxW / 2, pxH / 2, Math.max(pxW, pxH) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, pxW, pxH);

  // Grao: tile pequeno repetido, gerado uma unica vez.
  const grao = makeCanvas(128, 128);
  const gc = grao.getContext('2d');
  if (gc) {
    const img = gc.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + ((Math.random() * 70) | 0);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 16;
    }
    gc.putImageData(img, 0, 0);
  }

  return { grade, grao, cell, pxW, pxH };
}
