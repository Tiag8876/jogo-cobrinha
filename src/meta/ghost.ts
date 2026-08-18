import type { Command, GameState } from '../core/state';
import type { GhostData } from './save';
import { Sim } from '../core/sim';

// Gravacao e replay por sequencia de inputs. So funciona porque o nucleo
// e puro e deterministico: guardamos comandos, nao posicoes.

export function encodeCommand(c: Command | null): number {
  if (!c) return 0;
  if (c.kind === 'turn') return 1 + c.dir;
  if (c.kind === 'power') return 10 + c.slot;
  return 20;
}

export function decodeCommand(code: number): Command | null {
  if (code === 0) return null;
  if (code >= 1 && code <= 4) return { kind: 'turn', dir: (code - 1) as 0 | 1 | 2 | 3 };
  if (code >= 10 && code < 20) return { kind: 'power', slot: code - 10 };
  if (code === 20) return { kind: 'ouroboro' };
  return null;
}

// Grava so os ticks com comando: a run inteira cabe em poucos KB.
export class GhostRecorder {
  private pares: number[] = [];

  record(tick: number, cmd: Command | null): void {
    if (!cmd) return;
    this.pares.push(tick, encodeCommand(cmd));
  }

  build(base: Omit<GhostData, 'inputs'>): GhostData {
    return { ...base, inputs: this.pares.slice() };
  }

  reset(): void {
    this.pares.length = 0;
  }
}

// Reproduz a run gravada em paralelo, um tick por tick do jogo atual.
export class GhostPlayer {
  private sim: Sim;
  private pares: number[];
  private cursor = 0;
  readonly valido: boolean;

  constructor(data: GhostData | null) {
    this.valido = !!data;
    const d = data;
    this.pares = d ? d.inputs : [];
    this.sim = new Sim({
      seed: d ? d.seed : 1,
      mode: d ? d.mode : 'ouroboro',
      powers: d ? d.powers : [],
      relics: d ? d.relics : [],
    });
  }

  advance(): void {
    if (!this.valido || !this.sim.state.alive) return;
    const tick = this.sim.state.tick;
    let cmd: Command | null = null;
    while (this.cursor < this.pares.length && this.pares[this.cursor] <= tick) {
      cmd = decodeCommand(this.pares[this.cursor + 1]);
      this.cursor += 2;
    }
    this.sim.advance(cmd);
  }

  get state(): GameState {
    return this.sim.state;
  }

  get body(): number[] | null {
    return this.valido && this.sim.state.alive ? this.sim.state.body : null;
  }
}

// Semente do Desafio Diario: mesma data, mesmo mapa para todo mundo.
export function seedDoDia(d: Date): number {
  const chave = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  let h = 2166136261 ^ chave;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function dataISO(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${dia}`;
}
