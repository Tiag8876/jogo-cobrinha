import { describe, it, expect } from 'vitest';
import { migrate, saveDefault, SAVE_VERSION } from '../src/meta/save';
import type { SaveData } from '../src/meta/save';
import { listarSkins, listarPoderes, listarReliquias, comprar, equipar } from '../src/meta/shop';
import { encodeCommand, decodeCommand, seedDoDia, dataISO, GhostRecorder, GhostPlayer } from '../src/meta/ghost';
import { SKINS } from '../src/render/skins/defs';
import { Sim } from '../src/core/sim';
import type { Command } from '../src/core/state';

describe('save', () => {
  it('migra um save v1 antigo sem quebrar', () => {
    const v1 = {
      version: 1,
      money: 350,
      skins: ['osso', 'circuito'],
      skin: 'circuito',
      powers: ['fase'],
      best: { ouroboro: 42 },
      options: { shake: false },
    };
    const out = migrate(v1);
    expect(out.v).toBe(SAVE_VERSION);
    expect(out.coins).toBe(350);
    expect(out.skinEquipada).toBe('circuito');
    expect(out.recordes.ouroboro).toBe(42);
    expect(out.opcoes.shake).toBe(false);
    expect(out.opcoes.volume).toBeGreaterThan(0);
    expect(out.reliquias).toEqual([]);
    // Poderes iniciais sao garantidos mesmo se faltarem no save antigo.
    expect(out.poderesDesbloqueados).toContain('dash');
    expect(out.loadout.length).toBeGreaterThan(0);
  });

  it('lixo e save do futuro caem no padrao', () => {
    expect(migrate(null).v).toBe(SAVE_VERSION);
    expect(migrate('nao sou um save').coins).toBe(0);
    expect(migrate({ v: 999, coins: 10_000 }).coins).toBe(0);
  });

  it('nunca deixa equipar item que nao foi comprado', () => {
    const out = migrate({ v: 2, loadout: ['rebobinar'], reliquiasEquipadas: ['muda'], reliquias: [] });
    expect(out.loadout).not.toContain('rebobinar');
    expect(out.reliquiasEquipadas).toEqual([]);
  });

  it('corrige skin equipada inexistente', () => {
    const out = migrate({ v: 2, skinEquipada: 'inventada', skinsDesbloqueadas: [] });
    expect(out.skinEquipada).toBe('osso');
  });
});

describe('loja', () => {
  function novo(): SaveData {
    const s = saveDefault();
    s.coins = 5000;
    return s;
  }

  it('skin nunca da vantagem: nenhuma expoe atributo de jogo', () => {
    const chavesProibidas = ['custo', 'velocidade', 'bonus', 'multiplicador', 'vida'];
    for (const sk of SKINS) {
      for (const k of Object.keys(sk)) {
        expect(chavesProibidas).not.toContain(k);
      }
    }
    expect(SKINS.length).toBeGreaterThanOrEqual(12);
  });

  it('comprar desconta moedas e desbloqueia', () => {
    const s = novo();
    const item = listarSkins(s).find((i) => !i.comprado);
    expect(item).toBeDefined();
    if (!item) return;
    const antes = s.coins;
    expect(comprar(s, item)).toBe('ok');
    expect(s.coins).toBe(antes - item.preco);
    expect(s.skinsDesbloqueadas).toContain(item.id);
  });

  it('nao compra sem moedas', () => {
    const s = saveDefault();
    s.coins = 0;
    const caro = listarReliquias(s).find((i) => i.preco > 0);
    expect(caro).toBeDefined();
    if (!caro) return;
    expect(comprar(s, caro)).toBe('sem_moedas');
    expect(s.reliquias).toEqual([]);
  });

  it('o loadout de poderes nunca passa de 3', () => {
    const s = novo();
    for (const p of listarPoderes(s)) {
      comprar(s, p);
      equipar(s, { ...p, comprado: true });
    }
    expect(s.loadout.length).toBeLessThanOrEqual(3);
  });

  it('as reliquias equipadas nunca passam de 2', () => {
    const s = novo();
    for (const r of listarReliquias(s)) {
      comprar(s, r);
      equipar(s, { ...r, comprado: true });
    }
    expect(s.reliquiasEquipadas.length).toBeLessThanOrEqual(2);
  });

  it('a curva de precos vai do barato ao caro', () => {
    const precos = listarReliquias(saveDefault()).map((r) => r.preco);
    expect(Math.min(...precos)).toBeLessThan(400);
    expect(Math.max(...precos)).toBeGreaterThan(1000);
  });
});

describe('fantasma e diario', () => {
  it('codifica e decodifica todos os comandos', () => {
    const casos: (Command | null)[] = [
      null,
      { kind: 'turn', dir: 0 },
      { kind: 'turn', dir: 3 },
      { kind: 'power', slot: 2 },
      { kind: 'ouroboro' },
    ];
    for (const c of casos) {
      expect(decodeCommand(encodeCommand(c))).toEqual(c);
    }
  });

  it('o replay reproduz a run gravada tick a tick', () => {
    const base = { seed: 777, mode: 'ouroboro' as const, powers: [], relics: [] };
    const gravador = new GhostRecorder();
    const sim = new Sim(base);
    for (let i = 0; i < 60; i++) {
      const cmd: Command | null = i % 9 === 0 ? { kind: 'turn', dir: (((i / 9) + 1) % 4) as 0 | 1 | 2 | 3 } : null;
      gravador.record(sim.state.tick, cmd);
      sim.advance(cmd);
    }
    const data = gravador.build({ ...base, score: sim.state.score });

    const player = new GhostPlayer(data);
    for (let i = 0; i < 60; i++) player.advance();
    expect(player.state.body).toEqual(sim.state.body);
    expect(player.state.score).toBe(sim.state.score);
  });

  it('o fantasma sem gravacao nao quebra', () => {
    const p = new GhostPlayer(null);
    p.advance();
    expect(p.body).toBeNull();
  });

  it('a semente do diario depende so da data', () => {
    const a = seedDoDia(new Date(Date.UTC(2026, 7, 18)));
    const b = seedDoDia(new Date(Date.UTC(2026, 7, 18, 23, 59)));
    const c = seedDoDia(new Date(Date.UTC(2026, 7, 19)));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(dataISO(new Date(Date.UTC(2026, 7, 18)))).toBe('2026-08-18');
  });

  it('o mesmo dia gera o mesmo mapa para todo mundo', () => {
    const mk = (): string => {
      const sim = new Sim({ seed: seedDoDia(new Date(Date.UTC(2026, 0, 2))), mode: 'diario', powers: [], relics: [] });
      for (let i = 0; i < 40; i++) sim.advance(null);
      return JSON.stringify(sim.state.fruits);
    };
    expect(mk()).toBe(mk());
  });
});
