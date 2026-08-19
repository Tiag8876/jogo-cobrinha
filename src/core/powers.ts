import type { GameState } from './state';
import {
  DX,
  DY,
  segmentCount,
  custoPoder,
  insideArena,
  bodyContains,
  ticksReais,
  comboJanela,
  EV_PODER,
  EV_ONDA,
  EV_DASH,
  EV_COMEU,
  EV_MADURA,
  EV_AMARGA,
  EV_ESPELHO,
} from './state';
import { POWERS, MIN_LENGTH, OURO_SEGMENTOS, OURO_MOEDAS_POR_SEGMENTO, COMBO_MAX } from './config';
import type { PowerId } from './config';
import { clearCorrupt, shockwave, isCorrupt } from './corruption';
import { spawnFruit } from './spawn';

// Ativacao de poder: sempre paga em segmentos. O corpo e a moeda de energia.

export function podeAtivar(s: GameState, slot: number): boolean {
  if (!s.alive) return false;
  const p = s.powers[slot];
  if (!p) return false;
  if (p.cd > 0) return false;
  if (p.id === 'rebobinar') return true; // custo checado pelo Sim, que tem o historico
  const custo = custoPoder(s, p.id);
  return segmentCount(s) - custo >= MIN_LENGTH;
}

// Corta n segmentos da cauda. Devolve quantos realmente cortou.
export function cortarCauda(s: GameState, n: number): number {
  const disponivel = segmentCount(s) - MIN_LENGTH;
  const corte = Math.max(0, Math.min(n, disponivel));
  s.body.length -= corte * 2;
  return corte;
}

// Aplica o poder do slot. O Rebobinar nao passa por aqui.
export function ativarPoder(s: GameState, slot: number): boolean {
  if (!podeAtivar(s, slot)) return false;
  const p = s.powers[slot];
  if (p.id === 'rebobinar') return false;
  const custo = custoPoder(s, p.id);
  cortarCauda(s, custo);
  p.cd = POWERS[p.id].cooldown;
  s.events |= EV_PODER;
  aplicar(s, p.id);
  return true;
}

function aplicar(s: GameState, id: PowerId): void {
  switch (id) {
    // As duracoes sao prometidas em segundos. Os valores de config valem
    // a 8 ticks por segundo, entao escalam com a velocidade atual: sem
    // isso, a 16 tps a Fase de 2,5 s viraria 1,25 s.
    case 'fase':
      s.faseTimer = ticksReais(s, POWERS.fase.duracao);
      break;
    case 'ima':
      s.imaTimer = ticksReais(s, POWERS.ima.duracao);
      break;
    case 'dilatacao':
      s.dilatacaoTimer = ticksReais(s, POWERS.dilatacao.duracao);
      break;
    case 'dash':
      dash(s);
      break;
    case 'onda': {
      const limpas = shockwave(s, s.body[0], s.body[1], 5);
      if (s.relics.indexOf('simbiose') >= 0) s.coins += limpas * 2;
      s.events |= EV_ONDA;
      break;
    }
    case 'semear':
      semear(s);
      break;
    case 'rebobinar':
      break;
  }
}

// Come a fruta da celula, se houver. Compartilhado entre o movimento
// normal e o Dash, para o Dash nunca atravessar fruta sem comer.
export function comerEm(s: GameState, nx: number, ny: number): boolean {
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
        cortarCauda(s, 2);
        for (let p = 0; p < s.powers.length; p++) s.powers[p].cd = 0;
        s.coins += 2 * mult;
        s.events |= EV_AMARGA;
        break;
      }
      case 'espelho':
        s.espelhoTimer = ticksReais(s, 40); // 5 s em qualquer velocidade
        s.coins += 2 * mult;
        s.events |= EV_ESPELHO;
        break;
    }

    if (s.combo < COMBO_MAX) s.combo++;
    s.comboTimer = comboJanela(s);
    return true;
  }
  return false;
}

// Avanca 6 celulas de uma vez, limpando corrupcao no rastro.
function dash(s: GameState): void {
  let hx = s.body[0];
  let hy = s.body[1];
  let limpas = 0;
  for (let i = 0; i < 6; i++) {
    const nx = hx + DX[s.dir];
    const ny = hy + DY[s.dir];
    if (!insideArena(s, nx, ny)) break;
    hx = nx;
    hy = ny;
    limpas += clearCorrupt(s, hx, hy);
    comerEm(s, hx, hy); // o Dash colhe o que atravessa
    s.body.unshift(hx, hy);
    if (s.growth > 0) s.growth--;
    else s.body.length -= 2;
  }
  if (limpas > 0 && s.relics.indexOf('simbiose') >= 0) s.coins += limpas * 2;
  s.events |= EV_DASH;
}

// Converte 3 segmentos da cauda em 3 frutas maduras.
function semear(s: GameState): void {
  const corte = cortarCauda(s, 3);
  for (let i = 0; i < corte; i++) spawnFruit(s, 'madura');
}

// Ouroboro voluntario: devora a propria cauda por moedas e recarga.
export function ouroboro(s: GameState): boolean {
  if (!s.alive) return false;
  if (segmentCount(s) - OURO_SEGMENTOS < MIN_LENGTH) return false;
  const corte = cortarCauda(s, OURO_SEGMENTOS);
  if (corte === 0) return false;
  s.coins += corte * OURO_MOEDAS_POR_SEGMENTO * s.combo;
  s.score += corte;
  // Recarrega o poder mais frio de todos, o que estiver mais longe de voltar.
  let alvo = -1;
  let pior = 0;
  for (let i = 0; i < s.powers.length; i++) {
    if (s.powers[i].cd > pior) {
      pior = s.powers[i].cd;
      alvo = i;
    }
  }
  if (alvo >= 0) s.powers[alvo].cd = 0;
  return true;
}

// Ima: puxa frutas em raio 6 uma celula por tick na direcao da cabeca.
export function aplicarIma(s: GameState): void {
  if (s.imaTimer <= 0) return;
  const hx = s.body[0];
  const hy = s.body[1];
  for (let i = 0; i < s.fruits.length; i++) {
    const f = s.fruits[i];
    const dx = hx - f.x;
    const dy = hy - f.y;
    if (dx * dx + dy * dy > 36) continue;
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    const nx = Math.abs(dx) >= Math.abs(dy) ? f.x + sx : f.x;
    const ny = Math.abs(dx) >= Math.abs(dy) ? f.y : f.y + sy;
    // Nunca arrasta a fruta para cima do corpo: quebraria o invariante
    // que o spawn garante e deixaria a fruta inalcancavel.
    if (!insideArena(s, nx, ny) || isCorrupt(s, nx, ny) || bodyContains(s, nx, ny)) continue;
    let ocupada = false;
    for (let j = 0; j < s.fruits.length; j++) {
      if (j !== i && s.fruits[j].x === nx && s.fruits[j].y === ny) ocupada = true;
    }
    if (!ocupada) {
      f.x = nx;
      f.y = ny;
    }
  }
}
