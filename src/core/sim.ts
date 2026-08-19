import type { GameState, Command, RunOptions } from './state';
import { cloneState, createInitialState, segmentCount, custoPoder, ticksPerSecond, EV_REBOBINOU } from './state';
import { step } from './step';
import { POWERS, HISTORY_TICKS, REWIND_SEGUNDOS, MIN_LENGTH } from './config';

// O Sim envolve step() com o ring buffer de estados que o Rebobinar exige.
// Continua deterministico: mesma sequencia de comandos, mesmo resultado.

export class Sim {
  state: GameState;
  prev: GameState;
  private history: (GameState | null)[];
  private histHead = 0;

  constructor(opts: RunOptions) {
    this.state = createInitialState(opts);
    this.prev = this.state;
    this.history = new Array(HISTORY_TICKS).fill(null);
  }

  // Aplica um comando e avanca um tick. Devolve o novo estado.
  advance(command: Command | null): GameState {
    if (command && command.kind === 'power' && this.isRewind(command.slot)) {
      if (this.tryRewind(command.slot)) return this.state;
      command = null;
    }
    // So estados vivos entram no historico: rebobinar para um estado morto
    // devolveria o jogador direto para a morte.
    if (this.state.alive) {
      this.history[this.histHead] = cloneState(this.state);
      this.histHead = (this.histHead + 1) % HISTORY_TICKS;
    }
    this.prev = this.state;
    this.state = step(this.state, command);
    return this.state;
  }

  private isRewind(slot: number): boolean {
    const p = this.state.powers[slot];
    return !!p && p.id === 'rebobinar';
  }

  private tryRewind(slot: number): boolean {
    const s = this.state;
    const p = s.powers[slot];
    if (!p || p.cd > 0) return false;
    const custo = custoPoder(s, 'rebobinar');
    if (segmentCount(s) - custo < MIN_LENGTH) return false;

    const voltar = Math.round(ticksPerSecond(s) * REWIND_SEGUNDOS);
    const alvo = this.pickHistory(voltar);
    if (!alvo) return false;

    const restaurado = cloneState(alvo);
    // O custo e o cooldown sobrevivem ao rebobinar, senao seria de graca.
    restaurado.body.length = Math.max(MIN_LENGTH * 2, restaurado.body.length - custo * 2);
    for (let i = 0; i < restaurado.powers.length; i++) {
      if (restaurado.powers[i].id === 'rebobinar') restaurado.powers[i].cd = POWERS.rebobinar.cooldown;
    }
    restaurado.coins = s.coins;
    restaurado.alive = true;
    restaurado.causa = 'nenhuma';
    restaurado.events = EV_REBOBINOU;
    this.prev = restaurado;
    this.state = restaurado;
    this.history.fill(null);
    return true;
  }

  // Estado de n ticks atras, ou o mais antigo disponivel.
  private pickHistory(n: number): GameState | null {
    const max = Math.min(n, HISTORY_TICKS);
    for (let back = max; back >= 1; back--) {
      const idx = (this.histHead - back + HISTORY_TICKS * 2) % HISTORY_TICKS;
      const cand = this.history[idx];
      if (cand && cand.alive) return cand;
    }
    return null;
  }

  // Repoe um estado salvo (retomada de run). O historico zera: nao se
  // rebobina para antes do ponto de retomada.
  restaurar(state: GameState): void {
    this.state = cloneState(state);
    this.prev = this.state;
    this.history.fill(null);
    this.histHead = 0;
  }

  // Exposto para teste: quantos estados o buffer guarda de fato.
  historySize(): number {
    let n = 0;
    for (const h of this.history) if (h) n++;
    return n;
  }
}
