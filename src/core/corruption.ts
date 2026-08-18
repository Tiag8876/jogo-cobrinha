import type { GameState } from './state';
import { insideArena, bodyContains } from './state';
import { rngInt } from './rng';
import { CORRUPCAO_TETO, MODES } from './config';

// A corrupcao e uma grade paralela: 0 limpa, >0 idade em passos.
// Ela aperta o mapa sozinha, que e o que impede o passeio seguro do Snake.

export function corrIndex(s: GameState, x: number, y: number): number {
  return y * s.gridW + x;
}

export function isCorrupt(s: GameState, x: number, y: number): boolean {
  return s.corr[y * s.gridW + x] > 0;
}

export function setCorrupt(s: GameState, x: number, y: number): void {
  if (!insideArena(s, x, y)) return;
  const i = y * s.gridW + x;
  if (s.corr[i] > 0) return;
  if (s.corrCount >= CORRUPCAO_TETO) return;
  s.corr[i] = 1;
  s.corrCount++;
}

// Limpa uma celula e devolve 1 se havia corrupcao ali.
export function clearCorrupt(s: GameState, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= s.gridW || y >= s.gridH) return 0;
  const i = y * s.gridW + x;
  if (s.corr[i] === 0) return 0;
  s.corr[i] = 0;
  s.corrCount--;
  return 1;
}

const NX = [0, 1, 0, -1];
const NY = [-1, 0, 1, 0];

// Um passo de espalhamento. Nunca sai da arena e nunca cobre o corpo inteiro.
export function spreadCorruption(s: GameState): void {
  const ritmo = MODES[s.mode].corrupcaoRitmo;
  if (ritmo === 0 || s.tick % ritmo !== 0) return;
  if (s.corrCount === 0 || s.corrCount >= CORRUPCAO_TETO) return;

  // Coleta as celulas corrompidas maduras o bastante para se espalhar.
  const alvos: number[] = [];
  for (let y = s.minY; y <= s.maxY; y++) {
    for (let x = s.minX; x <= s.maxX; x++) {
      const i = y * s.gridW + x;
      if (s.corr[i] > 0) {
        s.corr[i]++;
        if (s.corr[i] >= 2) alvos.push(x, y);
      }
    }
  }
  if (alvos.length === 0) return;

  // Espalha a partir de poucas sementes por passo, para crescer organico.
  const sementes = Math.max(1, Math.min(3, alvos.length >> 3));
  for (let k = 0; k < sementes; k++) {
    const pick = rngInt(s.rng, alvos.length >> 1) * 2;
    const cx = alvos[pick];
    const cy = alvos[pick + 1];
    const d = rngInt(s.rng, 4);
    const nx = cx + NX[d];
    const ny = cy + NY[d];
    if (!insideArena(s, nx, ny)) continue;
    if (bodyContains(s, nx, ny)) continue;
    setCorrupt(s, nx, ny);
  }
}

// Onda de choque: limpa raio e empurra o que sobrou para fora.
export function shockwave(s: GameState, cx: number, cy: number, raio: number): number {
  let limpas = 0;
  for (let y = cy - raio; y <= cy + raio; y++) {
    for (let x = cx - raio; x <= cx + raio; x++) {
      if (x < 0 || y < 0 || x >= s.gridW || y >= s.gridH) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > raio * raio) continue;
      limpas += clearCorrupt(s, x, y);
    }
  }
  // Empurra o anel seguinte uma celula para fora do centro.
  const mover: number[] = [];
  const r2 = raio + 1;
  for (let y = cy - r2 - 1; y <= cy + r2 + 1; y++) {
    for (let x = cx - r2 - 1; x <= cx + r2 + 1; x++) {
      if (x < 0 || y < 0 || x >= s.gridW || y >= s.gridH) continue;
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > raio * raio && d2 <= r2 * r2 && s.corr[y * s.gridW + x] > 0) mover.push(x, y);
    }
  }
  for (let i = 0; i < mover.length; i += 2) {
    const x = mover[i];
    const y = mover[i + 1];
    const dx = Math.sign(x - cx);
    const dy = Math.sign(y - cy);
    const tx = x + dx;
    const ty = y + dy;
    if (!insideArena(s, tx, ty) || bodyContains(s, tx, ty)) continue;
    clearCorrupt(s, x, y);
    setCorrupt(s, tx, ty);
  }
  return limpas;
}
