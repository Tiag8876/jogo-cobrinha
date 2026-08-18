import type { GameState, Command, Dir } from './state';
import { cloneState, isOpposite, DX, DY } from './state';
import { ensureFruits } from './spawn';

// Funcao pura: (estado, comando) => proximo estado.
// Nunca muta o estado de entrada. Sem DOM, sem Canvas, sem Date.

export function step(state: GameState, command: Command | null): GameState {
  const s = cloneState(state);
  s.tick++;
  s.ateThisTick = false;
  if (!s.alive) return s;

  if (command && command.kind === 'turn' && !isOpposite(command.dir, s.dir)) {
    s.dir = command.dir;
  }

  const headX = s.body[0] + DX[s.dir];
  const headY = s.body[1] + DY[s.dir];

  // M1: paredes dao wrap. Modos com parede letal entram no M2.
  const nx = (headX + s.gridW) % s.gridW;
  const ny = (headY + s.gridH) % s.gridH;

  // Come fruta?
  let ate = false;
  for (let i = 0; i < s.fruits.length; i++) {
    const f = s.fruits[i];
    if (f.x === nx && f.y === ny) {
      s.fruits.splice(i, 1);
      s.growth += 1;
      s.score += 1;
      s.coins += 1;
      ate = true;
      break;
    }
  }
  s.ateThisTick = ate;

  // Avanca o corpo: empurra a nova cabeca e remove a cauda,
  // a nao ser que haja crescimento pendente.
  s.body.unshift(nx, ny);
  if (s.growth > 0) {
    s.growth--;
  } else {
    s.body.length -= 2;
  }

  // Colisao com o proprio corpo (a cabeca nova contra o resto).
  for (let i = 2; i < s.body.length; i += 2) {
    if (s.body[i] === nx && s.body[i + 1] === ny) {
      s.alive = false;
      break;
    }
  }

  for (let i = 0; i < s.fruits.length; i++) s.fruits[i].age++;

  ensureFruits(s);
  return s;
}

// Fila de input com buffer limitado. Vive fora do estado do jogo porque
// input e do dispositivo, nao da simulacao. Impede reversao de 180 graus
// mesmo com dois comandos no mesmo intervalo entre ticks.
export class InputQueue {
  private queue: Dir[] = [];
  private readonly capacity: number;

  constructor(capacity = 2) {
    this.capacity = capacity;
  }

  push(dir: Dir, currentDir: Dir): void {
    const last = this.queue.length > 0 ? this.queue[this.queue.length - 1] : currentDir;
    if (dir === last || isOpposite(dir, last)) return;
    if (this.queue.length >= this.capacity) return;
    this.queue.push(dir);
  }

  consume(): Command | null {
    const dir = this.queue.shift();
    return dir === undefined ? null : { kind: 'turn', dir };
  }

  clear(): void {
    this.queue.length = 0;
  }
}
