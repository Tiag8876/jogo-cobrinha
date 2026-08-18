import type { GameState, Command, Dir } from './state';
import {
  cloneState,
  isOpposite,
  DX,
  DY,
  segmentCount,
  insideArena,
  comboJanela,
  EV_COMEU,
  EV_MADURA,
  EV_AMARGA,
  EV_ESPELHO,
  EV_OURO,
  EV_CORRUPCAO_PAGA,
  EV_MORTE,
  EV_ESCUDO,
  EV_ENCOLHEU,
  EV_COMBO_QUEBROU,
} from './state';
import {
  MODES,
  COMBO_MAX,
  MIN_LENGTH,
  MADURA_APOS,
  CORRUPCAO_CUSTO,
  POWERS,
} from './config';
import { ensureFruits } from './spawn';
import { isCorrupt, clearCorrupt, setCorrupt, spreadCorruption } from './corruption';
import { ativarPoder, ouroboro, aplicarIma } from './powers';

// Funcao pura: (estado, comando) => proximo estado.
// Nunca muta a entrada. Sem DOM, sem Canvas, sem Date, sem Math.random.

export function step(state: GameState, command: Command | null): GameState {
  const s = cloneState(state);
  s.events = 0;
  if (!s.alive) return s;
  s.tick++;
  const def = MODES[s.mode];

  // Timers
  for (let i = 0; i < s.powers.length; i++) {
    if (s.powers[i].cd > 0) s.powers[i].cd--;
  }
  if (s.faseTimer > 0) s.faseTimer--;
  if (s.imaTimer > 0) s.imaTimer--;
  if (s.dilatacaoTimer > 0) s.dilatacaoTimer--;
  if (s.espelhoTimer > 0) s.espelhoTimer--;
  if (s.comboTimer > 0) {
    s.comboTimer--;
    if (s.comboTimer === 0 && s.combo > 1) {
      s.combo = s.relics.indexOf('fome') >= 0 ? 2 : 1;
      s.events |= EV_COMBO_QUEBROU;
    }
  }

  // Comando do jogador
  if (command) {
    if (command.kind === 'turn') {
      if (!isOpposite(command.dir, s.dir)) s.dir = command.dir;
    } else if (command.kind === 'power') {
      ativarPoder(s, command.slot);
    } else if (command.kind === 'ouroboro') {
      if (ouroboro(s)) s.events |= EV_OURO;
    }
  }

  if (!s.alive) return s;

  aplicarIma(s);
  envelheceFrutas(s);
  spreadCorruption(s);
  if (def.encolhe > 0 && s.tick % def.encolhe === 0) encolherArena(s);
  if (s.relics.indexOf('muda') >= 0 && s.tick % 240 === 0) muda(s);

  moverCabeca(s, def.paredesMatam, def.corrupcaoMata);
  if (!s.alive) return s;

  ensureFruits(s);
  return s;
}

function moverCabeca(s: GameState, paredesMatam: boolean, corrupcaoMata: boolean): void {
  let nx = s.body[0] + DX[s.dir];
  let ny = s.body[1] + DY[s.dir];
  const atravessa = s.faseTimer > 0;

  if (!insideArena(s, nx, ny)) {
    if (paredesMatam && !atravessa) {
      matar(s, 'parede');
      return;
    }
    // Com Fase ou sem parede letal, o mapa da a volta.
    const w = s.maxX - s.minX + 1;
    const h = s.maxY - s.minY + 1;
    nx = s.minX + (((nx - s.minX) % w) + w) % w;
    ny = s.minY + (((ny - s.minY) % h) + h) % h;
  }

  // Corrupcao: mata no Classico, cobra 2 segmentos nos demais modos.
  if (isCorrupt(s, nx, ny)) {
    if (corrupcaoMata && !atravessa) {
      matar(s, 'corrupcao');
      return;
    }
    clearCorrupt(s, nx, ny);
    if (s.relics.indexOf('simbiose') >= 0) s.coins += 3;
    if (!atravessa) {
      s.events |= EV_CORRUPCAO_PAGA;
      if (segmentCount(s) - CORRUPCAO_CUSTO < MIN_LENGTH) {
        matar(s, 'fome');
        return;
      }
      s.body.length -= CORRUPCAO_CUSTO * 2;
    }
  }

  // Colisao com o proprio corpo. A cauda que vai sair no mesmo tick nao conta.
  if (!atravessa) {
    const ultimo = s.growth > 0 ? s.body.length : s.body.length - 2;
    for (let i = 2; i < ultimo; i += 2) {
      if (s.body[i] === nx && s.body[i + 1] === ny) {
        matar(s, 'corpo');
        return;
      }
    }
  }

  comer(s, nx, ny);

  s.body.unshift(nx, ny);
  if (s.growth > 0) s.growth--;
  else s.body.length -= 2;

  if (segmentCount(s) < MIN_LENGTH) matar(s, 'fome');
}

function comer(s: GameState, nx: number, ny: number): void {
  for (let i = 0; i < s.fruits.length; i++) {
    const f = s.fruits[i];
    if (f.x !== nx || f.y !== ny) continue;
    s.fruits.splice(i, 1);
    s.lastEatX = nx;
    s.lastEatY = ny;
    s.events |= EV_COMEU;

    const mult = s.espelhoTimer > 0 ? s.combo * 2 : s.combo;
    switch (f.kind) {
      case 'comum':
        s.growth += 1;
        s.coins += 1 * mult;
        s.score += 1 * mult;
        break;
      case 'madura':
        s.growth += 2;
        s.coins += 3 * mult;
        s.score += 3 * mult;
        s.events |= EV_MADURA;
        break;
      case 'amarga': {
        // Recurso, nao punicao: custa 2 segmentos e recarrega tudo.
        const corte = Math.min(2, Math.max(0, segmentCount(s) - MIN_LENGTH));
        s.body.length -= corte * 2;
        for (let p = 0; p < s.powers.length; p++) s.powers[p].cd = 0;
        s.coins += 2 * mult;
        s.events |= EV_AMARGA;
        break;
      }
      case 'espelho':
        s.espelhoTimer = 40;
        s.coins += 2 * mult;
        s.events |= EV_ESPELHO;
        break;
    }

    if (s.combo < COMBO_MAX) s.combo++;
    s.comboTimer = comboJanela(s);
    return;
  }
}

// Frutas amadurecem paradas e depois apodrecem virando corrupcao.
function envelheceFrutas(s: GameState): void {
  const apodrece = MODES[s.mode].apodrece;
  for (let i = s.fruits.length - 1; i >= 0; i--) {
    const f = s.fruits[i];
    f.age++;
    if (f.kind === 'comum' && f.age >= MADURA_APOS) {
      f.kind = 'madura';
      f.age = 0;
      continue;
    }
    const limite = f.kind === 'madura' ? Math.round(apodrece * 0.6) : apodrece;
    if (f.age >= limite) {
      s.fruits.splice(i, 1);
      setCorrupt(s, f.x, f.y);
    }
  }
}

// Modo Aperto: fecha uma linha por vez, girando os lados.
function encolherArena(s: GameState): void {
  const lado = (s.tick / MODES[s.mode].encolhe) % 4 | 0;
  if (s.maxX - s.minX < 6 || s.maxY - s.minY < 6) return;
  if (lado === 0) s.minY++;
  else if (lado === 1) s.maxX--;
  else if (lado === 2) s.maxY--;
  else s.minX++;
  s.events |= EV_ENCOLHEU;

  // Limpa o que ficou fora e mata quem foi prensado.
  for (let i = s.fruits.length - 1; i >= 0; i--) {
    const f = s.fruits[i];
    if (!insideArena(s, f.x, f.y)) s.fruits.splice(i, 1);
  }
  for (let y = 0; y < s.gridH; y++) {
    for (let x = 0; x < s.gridW; x++) {
      if (!insideArena(s, x, y)) clearCorrupt(s, x, y);
    }
  }
  for (let i = 0; i < s.body.length; i += 2) {
    if (!insideArena(s, s.body[i], s.body[i + 1])) {
      matar(s, 'parede');
      return;
    }
  }
}

// Reliquia Muda: os 2 segmentos mais antigos caem e viram moeda.
function muda(s: GameState): void {
  const corte = Math.min(2, Math.max(0, segmentCount(s) - MIN_LENGTH));
  if (corte === 0) return;
  s.body.length -= corte * 2;
  s.coins += corte * 4;
}

function matar(s: GameState, causa: GameState['causa']): void {
  // Casca Dura absorve a primeira colisao ao custo de metade do corpo.
  if (!s.escudoUsado && s.relics.indexOf('casca') >= 0 && causa !== 'fome') {
    s.escudoUsado = true;
    const alvo = Math.max(MIN_LENGTH, segmentCount(s) >> 1);
    s.body.length = alvo * 2;
    s.events |= EV_ESCUDO;
    // Vira de costas para sair do aperto que causou a colisao.
    s.dir = ((s.dir + 2) % 4) as Dir;
    const nb: number[] = new Array(s.body.length);
    for (let i = 0; i < s.body.length; i += 2) {
      nb[i] = s.body[s.body.length - 2 - i];
      nb[i + 1] = s.body[s.body.length - 1 - i];
    }
    s.body = nb;
    return;
  }
  s.alive = false;
  s.causa = causa;
  s.events |= EV_MORTE;
}

// Fila de input com buffer limitado. Vive fora do estado porque input e do
// dispositivo, nao da simulacao. Impede a reversao de 180 graus mesmo com
// dois comandos no mesmo intervalo entre ticks.
export class InputQueue {
  private queue: Command[] = [];
  private lastDir: Dir | null = null;
  private readonly capacity: number;

  constructor(capacity = 2) {
    this.capacity = capacity;
  }

  pushDir(dir: Dir, currentDir: Dir): void {
    const ref = this.lastDir ?? currentDir;
    if (dir === ref || isOpposite(dir, ref)) return;
    if (this.queue.length >= this.capacity) return;
    this.queue.push({ kind: 'turn', dir });
    this.lastDir = dir;
  }

  pushCommand(cmd: Command): void {
    if (this.queue.length >= this.capacity + 1) return;
    this.queue.push(cmd);
  }

  consume(): Command | null {
    const cmd = this.queue.shift();
    if (!cmd) return null;
    if (this.queue.length === 0) this.lastDir = null;
    return cmd;
  }

  clear(): void {
    this.queue.length = 0;
    this.lastDir = null;
  }
}

export function cooldownFracao(s: GameState, slot: number): number {
  const p = s.powers[slot];
  if (!p) return 0;
  const total = POWERS[p.id].cooldown;
  return total === 0 ? 0 : p.cd / total;
}
