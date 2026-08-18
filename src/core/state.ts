import type { RngState } from './rng';
import { rngFromSeed } from './rng';
import type { ModeId, PowerId, RelicId } from './config';
import {
  MODES,
  GRID_DEFAULT,
  START_LENGTH,
  TPS_BASE,
  TPS_MAX,
  COMBO_JANELA,
  POWERS,
} from './config';

// Tudo aqui e JSON puro: serializavel e barato de copiar.
// E a base do Rebobinar, do Fantasma e do Desafio Diario.

export type Dir = 0 | 1 | 2 | 3; // 0=cima 1=direita 2=baixo 3=esquerda

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export type Command =
  | { kind: 'turn'; dir: Dir }
  | { kind: 'power'; slot: number }
  | { kind: 'ouroboro' };

export type FruitKind = 'comum' | 'madura' | 'amarga' | 'espelho';

export interface Fruit {
  x: number;
  y: number;
  kind: FruitKind;
  age: number; // ticks desde que nasceu ou desde que amadureceu
}

export interface PowerSlot {
  id: PowerId;
  cd: number; // ticks restantes de recarga
}

export type DeathCause = 'nenhuma' | 'parede' | 'corpo' | 'corrupcao' | 'fome';

// Eventos do tick, lidos por render e audio e zerados no tick seguinte.
export const EV_COMEU = 1;
export const EV_MADURA = 2;
export const EV_AMARGA = 4;
export const EV_ESPELHO = 8;
export const EV_OURO = 16;
export const EV_PODER = 32;
export const EV_CORRUPCAO_PAGA = 64;
export const EV_MORTE = 128;
export const EV_ESCUDO = 256;
export const EV_ONDA = 512;
export const EV_DASH = 1024;
export const EV_REBOBINOU = 2048;
export const EV_ENCOLHEU = 4096;
export const EV_COMBO_QUEBROU = 8192;

export interface GameState {
  tick: number;
  mode: ModeId;
  gridW: number;
  gridH: number;
  // Limites vivos da arena, usados pelo modo Aperto.
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;

  // Corpo, cabeca primeiro, achatado em [x0,y0,x1,y1,...] para copia barata.
  body: number[];
  dir: Dir;
  growth: number;

  fruits: Fruit[];
  // Grade de corrupcao, gridW*gridH. 0 limpa, >0 idade da celula.
  corr: number[];
  corrCount: number;

  rng: RngState;

  score: number;
  coins: number;
  combo: number;
  comboTimer: number;
  espelhoTimer: number;

  powers: PowerSlot[];
  relics: RelicId[];
  faseTimer: number;
  imaTimer: number;
  dilatacaoTimer: number;
  escudoUsado: boolean;

  alive: boolean;
  causa: DeathCause;
  events: number;
  lastEatX: number;
  lastEatY: number;
}

export interface RunOptions {
  seed: number;
  mode: ModeId;
  powers: PowerId[];
  relics: RelicId[];
  gridW?: number;
  gridH?: number;
}

export function createInitialState(opts: RunOptions): GameState {
  const gridW = opts.gridW ?? GRID_DEFAULT;
  const gridH = opts.gridH ?? GRID_DEFAULT;
  const def = MODES[opts.mode];
  const cx = Math.floor(gridW / 2);
  const cy = Math.floor(gridH / 2);
  const body: number[] = [];
  for (let i = 0; i < START_LENGTH; i++) body.push(cx - i, cy);

  const powers: PowerSlot[] = def.poderesLigados
    ? opts.powers.slice(0, 3).map((id) => ({ id, cd: 0 }))
    : [];

  const relics = opts.relics.slice(0, 2);
  const temFome = relics.indexOf('fome') >= 0;

  return {
    tick: 0,
    mode: opts.mode,
    gridW,
    gridH,
    minX: 0,
    minY: 0,
    maxX: gridW - 1,
    maxY: gridH - 1,
    body,
    dir: 1,
    growth: 0,
    fruits: [],
    corr: new Array(gridW * gridH).fill(0),
    corrCount: 0,
    rng: rngFromSeed(opts.seed),
    score: 0,
    coins: 0,
    combo: temFome ? 2 : 1,
    comboTimer: 0,
    espelhoTimer: 0,
    powers,
    relics,
    faseTimer: 0,
    imaTimer: 0,
    dilatacaoTimer: 0,
    escudoUsado: false,
    alive: true,
    causa: 'nenhuma',
    events: 0,
    lastEatX: -1,
    lastEatY: -1,
  };
}

// Copia profunda barata, sem JSON. Usada pelo ring buffer do Rebobinar.
export function cloneState(s: GameState): GameState {
  const fruits: Fruit[] = new Array(s.fruits.length);
  for (let i = 0; i < s.fruits.length; i++) {
    const f = s.fruits[i];
    fruits[i] = { x: f.x, y: f.y, kind: f.kind, age: f.age };
  }
  const powers: PowerSlot[] = new Array(s.powers.length);
  for (let i = 0; i < s.powers.length; i++) {
    powers[i] = { id: s.powers[i].id, cd: s.powers[i].cd };
  }
  return {
    tick: s.tick,
    mode: s.mode,
    gridW: s.gridW,
    gridH: s.gridH,
    minX: s.minX,
    minY: s.minY,
    maxX: s.maxX,
    maxY: s.maxY,
    body: s.body.slice(),
    dir: s.dir,
    growth: s.growth,
    fruits,
    corr: s.corr.slice(),
    corrCount: s.corrCount,
    rng: { s: s.rng.s },
    score: s.score,
    coins: s.coins,
    combo: s.combo,
    comboTimer: s.comboTimer,
    espelhoTimer: s.espelhoTimer,
    powers,
    relics: s.relics.slice(),
    faseTimer: s.faseTimer,
    imaTimer: s.imaTimer,
    dilatacaoTimer: s.dilatacaoTimer,
    escudoUsado: s.escudoUsado,
    alive: s.alive,
    causa: s.causa,
    events: s.events,
    lastEatX: s.lastEatX,
    lastEatY: s.lastEatY,
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

export function segmentCount(s: GameState): number {
  return s.body.length >> 1;
}

export function insideArena(s: GameState, x: number, y: number): boolean {
  return x >= s.minX && x <= s.maxX && y >= s.minY && y <= s.maxY;
}

// Velocidade em ticks por segundo. Sobe com o score nos modos com intensidade.
export function ticksPerSecond(s: GameState): number {
  if (!MODES[s.mode].intensidade) return TPS_BASE;
  const t = Math.min(1, s.score / 90);
  return TPS_BASE + (TPS_MAX - TPS_BASE) * t;
}

export function comboJanela(s: GameState): number {
  return s.relics.indexOf('fome') >= 0 ? Math.round(COMBO_JANELA * 0.7) : COMBO_JANELA;
}

export function custoPoder(s: GameState, id: PowerId): number {
  const base = POWERS[id].custo;
  return s.relics.indexOf('metabolismo') >= 0 ? Math.max(1, base - 1) : base;
}
