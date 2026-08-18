import type { RngState } from './rng';
import { rngFromSeed } from './rng';

// Tudo aqui precisa ser JSON puro: serializavel e barato de copiar.
// Isso e a base do Rebobinar, do Fantasma e do Desafio Diario.

export type Dir = 0 | 1 | 2 | 3; // 0=cima 1=direita 2=baixo 3=esquerda

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export type Command =
  | { kind: 'turn'; dir: Dir }
  | { kind: 'power'; slot: 0 | 1 | 2 }
  | { kind: 'ouroboro' };

export type FruitKind = 'comum' | 'madura' | 'amarga' | 'espelho';

export interface Fruit {
  x: number;
  y: number;
  kind: FruitKind;
  age: number; // ticks desde que nasceu
}

export interface GameState {
  tick: number;
  gridW: number;
  gridH: number;
  // Corpo da cobra, cabeca primeiro. Pares [x, y] achatados em um array
  // de numeros para copia barata: [x0, y0, x1, y1, ...].
  body: number[];
  dir: Dir;
  growth: number; // segmentos pendentes de crescimento
  fruits: Fruit[];
  rng: RngState;
  score: number;
  coins: number;
  alive: boolean;
  ateThisTick: boolean; // flag de evento para render e audio, dura 1 tick
}

export const GRID_DEFAULT = 28;
export const TICKS_PER_SECOND_BASE = 8;
export const INPUT_BUFFER_SIZE = 2;
export const START_LENGTH = 4;

export function createInitialState(seed: number, gridW = GRID_DEFAULT, gridH = GRID_DEFAULT): GameState {
  const cx = Math.floor(gridW / 2);
  const cy = Math.floor(gridH / 2);
  const body: number[] = [];
  for (let i = 0; i < START_LENGTH; i++) {
    body.push(cx - i, cy);
  }
  return {
    tick: 0,
    gridW,
    gridH,
    body,
    dir: 1,
    growth: 0,
    fruits: [],
    rng: rngFromSeed(seed),
    score: 0,
    coins: 0,
    alive: true,
    ateThisTick: false,
  };
}

// Copia profunda barata, sem JSON.parse. Usada pelo ring buffer do Rebobinar.
export function cloneState(s: GameState): GameState {
  const fruits: Fruit[] = new Array(s.fruits.length);
  for (let i = 0; i < s.fruits.length; i++) {
    const f = s.fruits[i];
    fruits[i] = { x: f.x, y: f.y, kind: f.kind, age: f.age };
  }
  return {
    tick: s.tick,
    gridW: s.gridW,
    gridH: s.gridH,
    body: s.body.slice(),
    dir: s.dir,
    growth: s.growth,
    fruits,
    rng: { s: s.rng.s },
    score: s.score,
    coins: s.coins,
    alive: s.alive,
    ateThisTick: s.ateThisTick,
  };
}

export function isOpposite(a: Dir, b: Dir): boolean {
  return (a + 2) % 4 === b;
}

export function bodyContains(s: GameState, x: number, y: number): boolean {
  const b = s.body;
  for (let i = 0; i < b.length; i += 2) {
    if (b[i] === x && b[i + 1] === y) return true;
  }
  return false;
}
