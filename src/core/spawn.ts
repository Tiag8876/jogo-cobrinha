import type { GameState, Fruit } from './state';
import { bodyContains } from './state';
import { rngInt } from './rng';

export const MIN_FRUITS = 1;
export const MAX_FRUITS = 3;

function cellFree(s: GameState, x: number, y: number): boolean {
  if (bodyContains(s, x, y)) return false;
  for (let i = 0; i < s.fruits.length; i++) {
    if (s.fruits[i].x === x && s.fruits[i].y === y) return false;
  }
  return true;
}

// Sorteia uma celula livre. Tenta aleatorio algumas vezes e cai para
// varredura linear com offset sorteado, garantindo que sempre acha se existir.
function findFreeCell(s: GameState): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = rngInt(s.rng, s.gridW);
    const y = rngInt(s.rng, s.gridH);
    if (cellFree(s, x, y)) return { x, y };
  }
  const total = s.gridW * s.gridH;
  const start = rngInt(s.rng, total);
  for (let i = 0; i < total; i++) {
    const idx = (start + i) % total;
    const x = idx % s.gridW;
    const y = Math.floor(idx / s.gridW);
    if (cellFree(s, x, y)) return { x, y };
  }
  return null;
}

// Mantem entre MIN_FRUITS e MAX_FRUITS no mapa. Muta o estado que recebeu,
// que ja e a copia do proximo tick dentro de step().
export function ensureFruits(s: GameState): void {
  while (s.fruits.length < MIN_FRUITS) {
    const cell = findFreeCell(s);
    if (!cell) return;
    const fruit: Fruit = { x: cell.x, y: cell.y, kind: 'comum', age: 0 };
    s.fruits.push(fruit);
  }
  // Chance pequena de nascer fruta extra ate o teto, para o mapa respirar.
  if (s.fruits.length < MAX_FRUITS && s.tick % 40 === 0 && rngInt(s.rng, 4) === 0) {
    const cell = findFreeCell(s);
    if (cell) s.fruits.push({ x: cell.x, y: cell.y, kind: 'comum', age: 0 });
  }
}
