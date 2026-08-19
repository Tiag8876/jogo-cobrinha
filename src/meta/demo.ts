import type { GameState, Command, Dir } from '../core/state';
import { DX, DY, isOpposite, insideArena, bodyContains } from '../core/state';
import { isCorrupt } from '../core/corruption';

// Piloto automatico da demonstracao que roda atras do menu. Heuristica
// gulosa e barata: anda para a fruta mais proxima sem entrar em celula
// perigosa. Nao e uma IA boa de proposito, e so precisa parecer viva.

function perigosa(s: GameState, x: number, y: number): boolean {
  if (!insideArena(s, x, y)) return true;
  if (isCorrupt(s, x, y)) return true;
  // A cauda sai no mesmo tick, entao o ultimo segmento nao conta.
  const b = s.body;
  for (let i = 0; i < b.length - 2; i += 2) {
    if (b[i] === x && b[i + 1] === y) return true;
  }
  return false;
}

// Conta o espaco livre alcancavel a partir de uma celula, com teto baixo:
// evita entrar em bolsao fechado sem custar uma busca completa.
function respiro(s: GameState, x: number, y: number, teto: number): number {
  let n = 0;
  for (let d = 0; d < 4; d++) {
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (perigosa(s, nx, ny)) continue;
    n++;
    for (let e = 0; e < 4 && n < teto; e++) {
      if (!perigosa(s, nx + DX[e], ny + DY[e])) n++;
    }
  }
  return n;
}

export function demoCommand(s: GameState): Command | null {
  if (!s.alive) return null;
  const hx = s.body[0];
  const hy = s.body[1];

  let alvoX = hx;
  let alvoY = hy;
  let melhorD = Infinity;
  for (let i = 0; i < s.fruits.length; i++) {
    const f = s.fruits[i];
    const d = Math.abs(f.x - hx) + Math.abs(f.y - hy);
    if (d < melhorD) {
      melhorD = d;
      alvoX = f.x;
      alvoY = f.y;
    }
  }

  let melhorDir: Dir | null = null;
  let melhorNota = -Infinity;
  for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
    if (isOpposite(d, s.dir)) continue;
    const nx = hx + DX[d];
    const ny = hy + DY[d];
    if (perigosa(s, nx, ny)) continue;
    const dist = Math.abs(alvoX - nx) + Math.abs(alvoY - ny);
    // Aproximar da fruta pesa, mas ter saida pesa mais: assim a demo
    // nao se enrola sozinha em dois movimentos.
    const nota = respiro(s, nx, ny, 12) * 3 - dist;
    if (nota > melhorNota) {
      melhorNota = nota;
      melhorDir = d;
    }
  }

  if (melhorDir === null) return null;
  if (melhorDir === s.dir) return null;
  return { kind: 'turn', dir: melhorDir };
}

// Evita alerta de import nao usado quando a demo cresce.
export function demoTemCorpo(s: GameState, x: number, y: number): boolean {
  return bodyContains(s, x, y);
}
