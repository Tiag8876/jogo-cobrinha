import { describe, it, expect } from 'vitest';
import { createInitialState, segmentCount, EV_OURO } from '../src/core/state';
import type { GameState, RunOptions } from '../src/core/state';
import { step } from '../src/core/step';
import { Sim } from '../src/core/sim';
import { podeAtivar, ativarPoder, ouroboro } from '../src/core/powers';
import { bodyContains } from '../src/core/state';
import { setCorrupt, isCorrupt } from '../src/core/corruption';
import { POWERS, MIN_LENGTH } from '../src/core/config';

function opts(over: Partial<RunOptions> = {}): RunOptions {
  return { seed: 999, mode: 'ouroboro', powers: ['fase', 'dash', 'rebobinar'], relics: [], ...over };
}

// Cresce sem esbarrar em parede: a Fase mantem a cobra viva enquanto o
// teste mede outra regra.
function crescer(s: GameState, n: number): GameState {
  const fase = s.faseTimer;
  s.faseTimer = 100000;
  s.growth = n;
  for (let i = 0; i <= n; i++) s = step(s, null);
  s.faseTimer = fase;
  return s;
}

// Reposiciona a cobra em linha reta, cabeca em (x, y) apontando para a direita.
function cobraEm(s: GameState, x: number, y: number, len: number): void {
  s.body.length = 0;
  for (let i = 0; i < len; i++) s.body.push(x - i, y);
  s.dir = 1;
}

describe('custo em segmentos', () => {
  it('poder nao ativa sem segmentos suficientes', () => {
    const s = createInitialState(opts({ powers: ['fase'] })); // 4 segmentos, Fase custa 4
    expect(segmentCount(s)).toBe(4);
    expect(podeAtivar(s, 0)).toBe(false);
    expect(ativarPoder(s, 0)).toBe(false);
    expect(segmentCount(s)).toBe(4);
  });

  it('poder ativa e encolhe a cobra pelo custo exato', () => {
    let s = createInitialState(opts({ powers: ['fase'] }));
    s = crescer(s, 8);
    const antes = segmentCount(s);
    expect(ativarPoder(s, 0)).toBe(true);
    expect(segmentCount(s)).toBe(antes - POWERS.fase.custo);
    expect(s.faseTimer).toBe(POWERS.fase.duracao);
  });

  it('a reliquia Metabolismo reduz o custo em 1, com piso de 1', () => {
    let s = createInitialState(opts({ powers: ['dash'], relics: ['metabolismo'] }));
    s = crescer(s, 8);
    const antes = segmentCount(s);
    ativarPoder(s, 0);
    expect(segmentCount(s)).toBe(antes - Math.max(1, POWERS.dash.custo - 1));
  });

  it('poder em recarga nao ativa', () => {
    let s = createInitialState(opts({ powers: ['dash'] }));
    s = crescer(s, 8);
    expect(ativarPoder(s, 0)).toBe(true);
    expect(s.powers[0].cd).toBe(POWERS.dash.cooldown);
    expect(ativarPoder(s, 0)).toBe(false);
  });

  it('nenhum poder pode derrubar a cobra abaixo do minimo', () => {
    let s = createInitialState(opts({ powers: ['dash'] }));
    s = crescer(s, 1); // 5 segmentos
    while (podeAtivar(s, 0)) {
      ativarPoder(s, 0);
      s.powers[0].cd = 0;
    }
    expect(segmentCount(s)).toBeGreaterThanOrEqual(MIN_LENGTH);
  });
});

describe('efeitos', () => {
  it('Dash avanca 6 celulas e limpa a corrupcao do caminho', () => {
    const s = createInitialState(opts({ powers: ['dash'] }));
    cobraEm(s, 8, 14, 12);
    const x0 = s.body[0];
    setCorrupt(s, x0 + 2, s.body[1]);
    setCorrupt(s, x0 + 4, s.body[1]);
    ativarPoder(s, 0);
    expect(s.body[0]).toBe(x0 + 6);
    expect(isCorrupt(s, x0 + 2, s.body[1])).toBe(false);
    expect(isCorrupt(s, x0 + 4, s.body[1])).toBe(false);
  });

  it('Fase deixa atravessar o proprio corpo sem morrer', () => {
    let s = createInitialState(opts({ powers: ['fase'] }));
    s = crescer(s, 12);
    ativarPoder(s, 0);
    s = step(s, { kind: 'turn', dir: 0 });
    s = step(s, { kind: 'turn', dir: 3 });
    s = step(s, { kind: 'turn', dir: 2 });
    s = step(s, { kind: 'turn', dir: 1 });
    expect(s.alive).toBe(true);
  });

  it('Semear troca 3 segmentos por 3 frutas maduras', () => {
    let s = createInitialState(opts({ powers: ['semear'] }));
    s = crescer(s, 12);
    s.fruits = [];
    const antes = segmentCount(s);
    ativarPoder(s, 0);
    expect(s.fruits.length).toBe(3);
    expect(s.fruits.every((f) => f.kind === 'madura')).toBe(true);
    expect(segmentCount(s)).toBe(antes - POWERS.semear.custo - 3);
  });

  it('Onda de Choque limpa a corrupcao ao redor da cabeca', () => {
    let s = createInitialState(opts({ powers: ['onda'] }));
    s = crescer(s, 12);
    for (let d = 1; d <= 4; d++) setCorrupt(s, s.body[0] + d, s.body[1]);
    ativarPoder(s, 0);
    expect(s.corrCount).toBe(0);
  });

  it('Ima puxa a fruta em direcao a cabeca', () => {
    let s = createInitialState(opts({ powers: ['ima'] }));
    s = crescer(s, 8);
    s.fruits = [{ x: s.body[0] + 5, y: s.body[1] + 2, kind: 'comum', age: 0 }];
    ativarPoder(s, 0);
    const antes = Math.abs(s.fruits[0].x - s.body[0]) + Math.abs(s.fruits[0].y - s.body[1]);
    s = step(s, null);
    if (s.fruits.length > 0) {
      const depois = Math.abs(s.fruits[0].x - s.body[0]) + Math.abs(s.fruits[0].y - s.body[1]);
      expect(depois).toBeLessThan(antes);
    }
  });
});

describe('regressoes', () => {
  it('o Dash come as frutas que atravessa', () => {
    const s = createInitialState(opts({ powers: ['dash'] }));
    cobraEm(s, 8, 14, 12);
    s.fruits = [
      { x: 10, y: 14, kind: 'comum', age: 0 },
      { x: 13, y: 14, kind: 'comum', age: 0 },
    ];
    const score = s.score;
    ativarPoder(s, 0);
    expect(s.fruits.length).toBe(0);
    expect(s.score).toBeGreaterThan(score);
  });

  it('o Ima nunca arrasta fruta para cima do corpo', () => {
    let s = createInitialState(opts({ powers: ['ima'] }));
    s = crescer(s, 12);
    ativarPoder(s, 0);
    for (let i = 0; i < 10 && s.alive; i++) {
      s = step(s, null);
      for (const f of s.fruits) {
        expect(bodyContains(s, f.x, f.y)).toBe(false);
      }
    }
  });

  it('duracoes em segundos escalam com a velocidade', () => {
    let s = createInitialState(opts({ powers: ['fase'] }));
    s = crescer(s, 8);
    s.score = 500; // intensidade no teto: 16 tps
    ativarPoder(s, 0);
    // 2,5 s a 16 tps sao 40 ticks, nao os 20 calibrados a 8 tps.
    expect(s.faseTimer).toBe(40);
  });
});

describe('ouroboro voluntario', () => {
  it('corta a cauda, paga moedas e recarrega o poder mais frio', () => {
    let s = createInitialState(opts({ powers: ['fase', 'dash'] }));
    s = crescer(s, 10);
    s.powers[0].cd = 70;
    s.powers[1].cd = 10;
    const antes = segmentCount(s);
    const moedas = s.coins;
    expect(ouroboro(s)).toBe(true);
    expect(segmentCount(s)).toBe(antes - 3);
    expect(s.coins).toBeGreaterThan(moedas);
    expect(s.powers[0].cd).toBe(0);
    expect(s.powers[1].cd).toBe(10);
  });

  it('nao deixa a cobra se apagar', () => {
    const s = createInitialState(opts());
    s.body.length = MIN_LENGTH * 2;
    expect(ouroboro(s)).toBe(false);
  });

  it('o evento sai marcado no estado', () => {
    let s = createInitialState(opts());
    s = crescer(s, 10);
    const depois = step(s, { kind: 'ouroboro' });
    expect(depois.events & EV_OURO).toBeTruthy();
  });
});

describe('rebobinar', () => {
  // Sim com a cobra longa e viva o bastante para encher o ring buffer.
  function simLongo(): Sim {
    const sim = new Sim(opts({ powers: ['rebobinar'] }));
    sim.state.faseTimer = 100000;
    sim.state.growth = 30;
    for (let i = 0; i < 31; i++) sim.advance(null);
    return sim;
  }

  it('volta o jogo 2 segundos', () => {
    const sim = simLongo();
    const antesTick = sim.state.tick;
    for (let i = 0; i < 24; i++) sim.advance(null);
    sim.advance({ kind: 'power', slot: 0 });
    // A 8 ticks por segundo, 2 s sao 16 ticks para tras.
    expect(sim.state.tick).toBe(antesTick + 24 - 16);
    expect(sim.state.alive).toBe(true);
  });

  it('restaura o estado exato de 2 segundos atras, tirando custo e cooldown', () => {
    const sim = simLongo();
    const snapshots: string[] = [];
    for (let i = 0; i < 20; i++) {
      snapshots.push(JSON.stringify(sim.state));
      sim.advance(null);
    }
    const alvo = JSON.parse(snapshots[snapshots.length - 16]) as { tick: number; body: number[]; fruits: unknown; corr: number[] };

    sim.advance({ kind: 'power', slot: 0 });
    expect(sim.state.tick).toBe(alvo.tick);
    expect(sim.state.fruits).toEqual(alvo.fruits);
    expect(sim.state.corr).toEqual(alvo.corr);
    // O corpo volta igual, menos o custo cobrado da cauda.
    const custo = POWERS.rebobinar.custo;
    expect(sim.state.body).toEqual(alvo.body.slice(0, alvo.body.length - custo * 2));
    expect(sim.state.powers[0].cd).toBe(POWERS.rebobinar.cooldown);
  });

  it('serve como anti morte', () => {
    const sim = simLongo();
    for (let i = 0; i < 20; i++) sim.advance(null);
    sim.state.faseTimer = 0;
    while (sim.state.alive) sim.advance(null);
    expect(sim.state.alive).toBe(false);
    sim.advance({ kind: 'power', slot: 0 });
    expect(sim.state.alive).toBe(true);
  });

  it('nao ativa sem segmentos suficientes', () => {
    const sim = new Sim(opts({ powers: ['rebobinar'] }));
    sim.state.faseTimer = 100000;
    for (let i = 0; i < 20; i++) sim.advance(null);
    const tick = sim.state.tick;
    // Com 4 segmentos e custo 8, o rebobinar nao pode acontecer.
    sim.advance({ kind: 'power', slot: 0 });
    expect(sim.state.tick).toBe(tick + 1);
  });

  it('o Sim continua deterministico com rebobinar no meio', () => {
    const rodar = (): string => {
      const sim = new Sim(opts({ powers: ['rebobinar'], seed: 4242 }));
      sim.state.growth = 30;
      for (let i = 0; i < 60; i++) {
        sim.advance(i === 45 ? { kind: 'power', slot: 0 } : i % 7 === 0 ? { kind: 'turn', dir: ((i / 7) % 4) as 0 | 1 | 2 | 3 } : null);
      }
      return JSON.stringify(sim.state);
    };
    expect(rodar()).toBe(rodar());
  });
});

describe('modo aperto', () => {
  it('a arena encolhe com o tempo e a corrupcao fora dela some', () => {
    let s = createInitialState(opts({ mode: 'aperto' }));
    s.growth = 100;
    const largura0 = s.maxX - s.minX;
    for (let i = 0; i < 700 && s.alive; i++) s = step(s, i % 5 === 0 ? { kind: 'turn', dir: ((i / 5) % 4) as 0 | 1 | 2 | 3 } : null);
    expect(s.maxX - s.minX).toBeLessThanOrEqual(largura0);
    for (let y = 0; y < s.gridH; y++) {
      for (let x = 0; x < s.gridW; x++) {
        if (x < s.minX || x > s.maxX || y < s.minY || y > s.maxY) {
          expect(s.corr[y * s.gridW + x]).toBe(0);
        }
      }
    }
  });
});
