import { describe, it, expect } from 'vitest';
import { createInitialState, bodyContains, segmentCount, EV_COMEU, EV_MORTE } from '../src/core/state';
import type { GameState, Dir, RunOptions } from '../src/core/state';
import { step, InputQueue } from '../src/core/step';
import { CORRUPCAO_TETO } from '../src/core/config';
import { setCorrupt, spreadCorruption, isCorrupt, shockwave } from '../src/core/corruption';

function opts(over: Partial<RunOptions> = {}): RunOptions {
  return { seed: 12345, mode: 'ouroboro', powers: ['fase', 'dash'], relics: [], ...over };
}

function runTicks(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) s = step(s, null);
  return s;
}

// Fase ligada por muito tempo: a cobra atravessa parede e corpo, o que
// deixa o teste medir uma regra so, sem morrer por outro motivo antes.
function imortal(s: GameState): GameState {
  s.faseTimer = 100000;
  return s;
}

describe('determinismo', () => {
  it('mesma seed e mesmos inputs produzem o mesmo estado final, byte a byte', () => {
    const inputs: (Dir | null)[] = [null, 0, null, 1, null, null, 2, null, 3, null, null, null, 0];
    const play = (): GameState => {
      let s = imortal(createInitialState(opts()));
      for (const d of inputs) s = step(s, d === null ? null : { kind: 'turn', dir: d });
      return runTicks(s, 300);
    };
    const a = play();
    const b = play();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.tick).toBeGreaterThan(100);
    expect(a.alive).toBe(true);
  });

  it('seeds diferentes divergem', () => {
    const a = runTicks(createInitialState(opts({ seed: 1 })), 120);
    const b = runTicks(createInitialState(opts({ seed: 2 })), 120);
    expect(JSON.stringify(a.fruits)).not.toBe(JSON.stringify(b.fruits));
  });

  it('step nao muta o estado de entrada', () => {
    const s = createInitialState(opts());
    const antes = JSON.stringify(s);
    step(s, { kind: 'turn', dir: 0 });
    expect(JSON.stringify(s)).toBe(antes);
  });

  it('o estado inteiro sobrevive a um round trip de JSON', () => {
    const s = runTicks(createInitialState(opts()), 80);
    const copia = JSON.parse(JSON.stringify(s)) as GameState;
    expect(JSON.stringify(step(copia, null))).toBe(JSON.stringify(step(s, null)));
  });
});

describe('buffer de input', () => {
  it('impede reversao de 180 graus entre dois comandos no mesmo tick', () => {
    // Cobra indo para a direita. Cima e valido, baixo logo depois nao e:
    // sem a fila, os dois no mesmo tick virariam a cobra em si mesma.
    const s = createInitialState(opts());
    const q = new InputQueue(2);
    q.pushDir(0, s.dir);
    q.pushDir(2, s.dir);
    expect(q.consume()).toEqual({ kind: 'turn', dir: 0 });
    expect(q.consume()).toBeNull();
  });

  it('rejeita reversao direta contra a direcao atual', () => {
    const s = createInitialState(opts());
    const q = new InputQueue(2);
    q.pushDir(3, s.dir);
    expect(q.consume()).toBeNull();
  });

  it('aceita duas curvas encadeadas validas e limita a fila a 2', () => {
    const s = createInitialState(opts());
    const q = new InputQueue(2);
    q.pushDir(0, s.dir);
    q.pushDir(3, s.dir);
    q.pushDir(2, s.dir);
    expect(q.consume()).toEqual({ kind: 'turn', dir: 0 });
    expect(q.consume()).toEqual({ kind: 'turn', dir: 3 });
    expect(q.consume()).toBeNull();
  });

  it('a cobra sobrevive a sequencia rapida cima e depois direita', () => {
    let s = createInitialState(opts());
    const q = new InputQueue(2);
    q.pushDir(0, s.dir);
    q.pushDir(1, s.dir);
    s = step(s, q.consume());
    s = step(s, q.consume());
    expect(s.alive).toBe(true);
    expect(s.dir).toBe(1);
  });

  it('step ignora comando de reversao que chegue de outra fonte', () => {
    const s = createInitialState(opts());
    const depois = step(s, { kind: 'turn', dir: 3 });
    expect(depois.dir).toBe(1);
    expect(depois.alive).toBe(true);
  });
});

describe('frutas', () => {
  it('nunca nascem sobre o corpo nem sobre corrupcao', () => {
    let s = createInitialState(opts({ seed: 42 }));
    for (let i = 0; i < 600; i++) {
      s = step(s, null);
      for (const f of s.fruits) {
        expect(bodyContains(s, f.x, f.y)).toBe(false);
        expect(isCorrupt(s, f.x, f.y)).toBe(false);
      }
      if (!s.alive) break;
    }
  });

  it('sempre existe de 1 a 3 frutas no mapa', () => {
    let s = createInitialState(opts({ seed: 9 }));
    for (let i = 0; i < 200; i++) {
      s = step(s, null);
      if (!s.alive) break;
      expect(s.fruits.length).toBeGreaterThanOrEqual(1);
      expect(s.fruits.length).toBeLessThanOrEqual(3);
    }
  });

  it('comer fruta comum cresce a cobra e marca o evento', () => {
    let s = createInitialState(opts({ seed: 5 }));
    s.fruits = [{ x: s.body[0] + 1, y: s.body[1], kind: 'comum', age: 0 }];
    const antes = segmentCount(s);
    s = step(s, null);
    expect(s.events & EV_COMEU).toBeTruthy();
    s = step(s, null);
    expect(segmentCount(s)).toBe(antes + 1);
  });

  it('fruta amarga custa segmentos e recarrega todos os poderes', () => {
    let s = createInitialState(opts({ seed: 5 }));
    s.growth = 10;
    s = runTicks(s, 11);
    s.powers[0].cd = 50;
    s.powers[1].cd = 30;
    s.fruits = [{ x: s.body[0] + 1, y: s.body[1], kind: 'amarga', age: 0 }];
    const antes = segmentCount(s);
    s = step(s, null);
    expect(s.powers[0].cd).toBe(0);
    expect(s.powers[1].cd).toBe(0);
    expect(segmentCount(s)).toBeLessThan(antes);
  });

  it('fruta parada amadurece e depois apodrece virando corrupcao', () => {
    let s = imortal(createInitialState(opts({ seed: 77 })));
    s.fruits = [{ x: 2, y: 2, kind: 'comum', age: 0 }];
    let virou = false;
    for (let i = 0; i < 120 && s.alive; i++) {
      s = step(s, null);
      if (isCorrupt(s, 2, 2)) {
        virou = true;
        break;
      }
    }
    expect(virou).toBe(true);
  });
});

describe('combo', () => {
  it('sobe ao comer e volta a x1 quando o timer zera', () => {
    let s = imortal(createInitialState(opts({ seed: 5 })));
    s.fruits = [{ x: s.body[0] + 1, y: s.body[1], kind: 'comum', age: 0 }];
    s = step(s, null);
    expect(s.combo).toBe(2);
    // Anda em linha longe de frutas ate a janela do combo fechar.
    for (let i = 0; i < 40 && s.combo > 1; i++) {
      s.fruits = [];
      s = step(s, null);
    }
    expect(s.combo).toBe(1);
  });
});

describe('corrupcao', () => {
  it('nunca se espalha para fora da grade', () => {
    const s = createInitialState(opts({ seed: 3 }));
    setCorrupt(s, 0, 0);
    setCorrupt(s, s.gridW - 1, s.gridH - 1);
    for (let i = 0; i < 400; i++) {
      s.tick++;
      spreadCorruption(s);
    }
    expect(s.corr.length).toBe(s.gridW * s.gridH);
    let contados = 0;
    for (let y = 0; y < s.gridH; y++) {
      for (let x = 0; x < s.gridW; x++) {
        if (s.corr[y * s.gridW + x] > 0) contados++;
      }
    }
    expect(contados).toBe(s.corrCount);
    expect(s.corrCount).toBeLessThanOrEqual(CORRUPCAO_TETO);
  });

  it('nao corrompe celula fora da arena encolhida', () => {
    const s = createInitialState(opts());
    s.minX = 5;
    s.minY = 5;
    s.maxX = 10;
    s.maxY = 10;
    setCorrupt(s, 0, 0);
    expect(isCorrupt(s, 0, 0)).toBe(false);
  });

  it('atravessar corrupcao cobra 2 segmentos e limpa a celula', () => {
    let s = createInitialState(opts({ seed: 5 }));
    s.growth = 8;
    s = runTicks(s, 9);
    const alvo = { x: s.body[0] + 1, y: s.body[1] };
    setCorrupt(s, alvo.x, alvo.y);
    const antes = segmentCount(s);
    s = step(s, null);
    expect(isCorrupt(s, alvo.x, alvo.y)).toBe(false);
    expect(segmentCount(s)).toBe(antes - 2);
    expect(s.alive).toBe(true);
  });

  it('no modo classico a corrupcao mata no contato', () => {
    let s = createInitialState(opts({ mode: 'classico', seed: 5 }));
    setCorrupt(s, s.body[0] + 1, s.body[1]);
    s = step(s, null);
    expect(s.alive).toBe(false);
    expect(s.causa).toBe('corrupcao');
  });

  it('a onda de choque limpa o raio inteiro', () => {
    const s = createInitialState(opts());
    for (let y = 10; y < 18; y++) for (let x = 10; x < 18; x++) setCorrupt(s, x, y);
    const antes = s.corrCount;
    const limpas = shockwave(s, 14, 14, 5);
    expect(limpas).toBeGreaterThan(0);
    expect(s.corrCount).toBeLessThan(antes);
    expect(isCorrupt(s, 14, 14)).toBe(false);
  });
});

describe('colisao e morte', () => {
  it('morre ao bater na parede quando o modo tem parede letal', () => {
    let s = createInitialState(opts());
    for (let i = 0; i < 40 && s.alive; i++) s = step(s, null);
    expect(s.alive).toBe(false);
    expect(s.causa).toBe('parede');
    expect(s.events & EV_MORTE).toBeTruthy();
  });

  it('morre ao colidir com o proprio corpo', () => {
    let s = createInitialState(opts({ seed: 3 }));
    s.growth = 8;
    s = runTicks(s, 6);
    s = step(s, { kind: 'turn', dir: 0 });
    s = step(s, { kind: 'turn', dir: 3 });
    s = step(s, { kind: 'turn', dir: 2 });
    s = step(s, { kind: 'turn', dir: 1 });
    expect(s.alive).toBe(false);
    expect(s.causa).toBe('corpo');
  });

  it('estado morto nao avanca mais', () => {
    let s = createInitialState(opts());
    s.alive = false;
    const body = JSON.stringify(s.body);
    const tick = s.tick;
    s = step(s, null);
    expect(JSON.stringify(s.body)).toBe(body);
    expect(s.tick).toBe(tick);
  });

  it('a relíquia Casca Dura absorve a primeira colisao', () => {
    let s = createInitialState(opts({ relics: ['casca'] }));
    s.growth = 10;
    s = runTicks(s, 11);
    const antes = segmentCount(s);
    for (let i = 0; i < 40 && s.alive && !s.escudoUsado; i++) s = step(s, null);
    expect(s.escudoUsado).toBe(true);
    expect(s.alive).toBe(true);
    expect(segmentCount(s)).toBeLessThan(antes);
  });
});
