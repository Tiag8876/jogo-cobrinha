import { describe, it, expect } from 'vitest';
import { createInitialState, bodyContains } from '../src/core/state';
import type { GameState, Dir } from '../src/core/state';
import { step, InputQueue } from '../src/core/step';

function runTicks(s: GameState, n: number, queue?: InputQueue): GameState {
  for (let i = 0; i < n; i++) {
    s = step(s, queue ? queue.consume() : null);
  }
  return s;
}

describe('determinismo', () => {
  it('mesma seed e mesmos inputs produzem o mesmo estado final, byte a byte', () => {
    const inputs: (Dir | null)[] = [null, 0, null, 1, null, null, 2, null, 3, null, null, null, 0];
    const play = () => {
      let s = createInitialState(12345);
      for (const d of inputs.concat(new Array(200).fill(null))) {
        s = step(s, d === null ? null : { kind: 'turn', dir: d });
      }
      return s;
    };
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });

  it('step nao muta o estado de entrada', () => {
    const s = createInitialState(7);
    const before = JSON.stringify(s);
    step(s, { kind: 'turn', dir: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('buffer de input', () => {
  it('impede reversao de 180 graus com dois comandos rapidos no mesmo tick', () => {
    // Cobra indo para a direita. Jogador aperta cima e depois esquerda
    // muito rapido: virar cima e valido, e esquerda depois de cima tambem.
    // O caso fatal e apertar cima + baixo, ou so esquerda direto.
    let s = createInitialState(1); // dir = 1 (direita)
    const q = new InputQueue(2);
    q.push(0, s.dir); // cima: aceito
    q.push(2, s.dir); // baixo: reversao do cima na fila, rejeitado
    s = step(s, q.consume());
    expect(s.dir).toBe(0);
    const cmd = q.consume();
    expect(cmd).toBeNull();
  });

  it('rejeita reversao direta contra a direcao atual', () => {
    const s = createInitialState(1); // direita
    const q = new InputQueue(2);
    q.push(3, s.dir); // esquerda: 180 graus, rejeitado
    expect(q.consume()).toBeNull();
  });

  it('limita a fila a 2 comandos', () => {
    const s = createInitialState(1); // direita
    const q = new InputQueue(2);
    q.push(0, s.dir);
    q.push(1, s.dir);
    q.push(2, s.dir); // terceiro comando descartado
    expect(q.consume()).toEqual({ kind: 'turn', dir: 0 });
    expect(q.consume()).toEqual({ kind: 'turn', dir: 1 });
    expect(q.consume()).toBeNull();
  });
});

describe('frutas', () => {
  it('nunca nascem em celula ocupada pelo corpo', () => {
    let s = createInitialState(42);
    for (let i = 0; i < 500; i++) {
      s = step(s, null);
      for (const f of s.fruits) {
        expect(bodyContains(s, f.x, f.y)).toBe(false);
      }
      if (!s.alive) break;
    }
  });

  it('sempre existe pelo menos 1 fruta no mapa', () => {
    let s = createInitialState(9);
    s = runTicks(s, 50);
    expect(s.fruits.length).toBeGreaterThanOrEqual(1);
    expect(s.fruits.length).toBeLessThanOrEqual(3);
  });

  it('comer fruta cresce a cobra em 1 segmento', () => {
    let s = createInitialState(5);
    // Planta uma fruta na frente da cabeca.
    s.fruits = [{ x: s.body[0] + 1, y: s.body[1], kind: 'comum', age: 0 }];
    const lenBefore = s.body.length;
    s = step(s, null);
    expect(s.ateThisTick).toBe(true);
    s = step(s, null);
    expect(s.body.length).toBe(lenBefore + 2);
  });
});

describe('colisao', () => {
  it('morre ao colidir com o proprio corpo', () => {
    let s = createInitialState(3);
    // Cresce o suficiente para conseguir se morder.
    s.growth = 6;
    s = runTicks(s, 7);
    // Loop fechado: cima, esquerda, baixo colide com o corpo.
    s = step(s, { kind: 'turn', dir: 0 });
    s = step(s, { kind: 'turn', dir: 3 });
    s = step(s, { kind: 'turn', dir: 2 });
    expect(s.alive).toBe(false);
  });

  it('estado morto nao avanca a cobra', () => {
    let s = createInitialState(3);
    s.alive = false;
    const body = JSON.stringify(s.body);
    s = step(s, null);
    expect(JSON.stringify(s.body)).toBe(body);
  });
});
