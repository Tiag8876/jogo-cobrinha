// mulberry32: RNG deterministico com estado serializavel (um u32).

export interface RngState {
  s: number;
}

export function rngFromSeed(seed: number): RngState {
  return { s: seed >>> 0 };
}

// Avanca o estado e retorna um float em [0, 1).
// Muta o objeto passado de proposito: o chamador controla a copia do estado.
export function rngNext(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rngInt(r: RngState, maxExclusive: number): number {
  return Math.floor(rngNext(r) * maxExclusive);
}
