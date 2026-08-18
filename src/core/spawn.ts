import type { GameState, Fruit, FruitKind } from './state';
import { bodyContains, insideArena } from './state';
import { rngInt, rngNext } from './rng';
import { MIN_FRUITS, MAX_FRUITS } from './config';
import { isCorrupt } from './corruption';

function cellFree(s: GameState, x: number, y: number): boolean {
  if (!insideArena(s, x, y)) return false;
  if (bodyContains(s, x, y)) return false;
  if (isCorrupt(s, x, y)) return false;
  for (let i = 0; i < s.fruits.length; i++) {
    if (s.fruits[i].x === x && s.fruits[i].y === y) return false;
  }
  return true;
}

// Uma celula esta encurralada se tiver menos de 2 vizinhos livres.
function encurralada(s: GameState, x: number, y: number): boolean {
  let livres = 0;
  if (cellFree(s, x + 1, y)) livres++;
  if (cellFree(s, x - 1, y)) livres++;
  if (cellFree(s, x, y + 1)) livres++;
  if (cellFree(s, x, y - 1)) livres++;
  return livres < 2;
}

// Sorteia celula livre. Tenta aleatorio e cai para varredura com offset
// sorteado, garantindo que encontra se existir alguma.
export function findFreeCell(s: GameState, evitarEncurralada: boolean): { x: number; y: number } | null {
  const w = s.maxX - s.minX + 1;
  const h = s.maxY - s.minY + 1;
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = s.minX + rngInt(s.rng, w);
    const y = s.minY + rngInt(s.rng, h);
    if (cellFree(s, x, y) && (!evitarEncurralada || !encurralada(s, x, y))) return { x, y };
  }
  const total = w * h;
  const start = rngInt(s.rng, total);
  let fallback: { x: number; y: number } | null = null;
  for (let i = 0; i < total; i++) {
    const idx = (start + i) % total;
    const x = s.minX + (idx % w);
    const y = s.minY + Math.floor(idx / w);
    if (!cellFree(s, x, y)) continue;
    if (!encurralada(s, x, y)) return { x, y };
    if (!fallback) fallback = { x, y };
  }
  return fallback;
}

function sorteiaTipo(s: GameState): FruitKind {
  const r = rngNext(s.rng);
  if (r < 0.06) return 'amarga';
  if (r < 0.11) return 'espelho';
  return 'comum';
}

export function spawnFruit(s: GameState, kind: FruitKind | null): Fruit | null {
  const cell = findFreeCell(s, true);
  if (!cell) return null;
  const f: Fruit = { x: cell.x, y: cell.y, kind: kind ?? sorteiaTipo(s), age: 0 };
  s.fruits.push(f);
  return f;
}

// Mantem entre MIN_FRUITS e MAX_FRUITS no mapa.
export function ensureFruits(s: GameState): void {
  while (s.fruits.length < MIN_FRUITS) {
    if (!spawnFruit(s, null)) return;
  }
  if (s.fruits.length < MAX_FRUITS && s.tick % 24 === 0 && rngInt(s.rng, 3) === 0) {
    spawnFruit(s, null);
  }
}
