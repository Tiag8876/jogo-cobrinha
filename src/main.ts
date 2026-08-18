import type { Command, GameState } from './core/state';
import {
  ticksPerSecond,
  segmentCount,
  EV_COMEU,
  EV_MADURA,
  EV_AMARGA,
  EV_ESPELHO,
  EV_OURO,
  EV_PODER,
  EV_ONDA,
  EV_DASH,
  EV_MORTE,
  EV_ESCUDO,
  EV_CORRUPCAO_PAGA,
  EV_REBOBINOU,
  EV_ENCOLHEU,
} from './core/state';
import { InputQueue } from './core/step';
import { Sim } from './core/sim';
import type { ModeId } from './core/config';
import { GRID_DEFAULT, COMBO_MAX } from './core/config';
import { buildStaticLayer } from './render/layers';
import type { StaticLayer } from './render/layers';
import { render } from './render/renderer';
import type { ViewOpts } from './render/renderer';
import { buildPaleta } from './render/palette';
import type { Paleta } from './render/palette';
import { emit, updateParticles, clearParticles, KIND_PONTO, KIND_QUADRADO, KIND_RISCO, particleCount } from './render/particles';
import { drawHud } from './ui/hud';
import type { Layout } from './ui/hud';
import { UI } from './ui/menus';
import { load, save } from './meta/save';
import type { SaveData } from './meta/save';
import { skinAtual } from './meta/shop';
import { GhostRecorder, GhostPlayer, seedDoDia, dataISO } from './meta/ghost';
import { attachKeyboard } from './input/keyboard';
import type { InputSink } from './input/keyboard';
import { attachTouch, buildDpad } from './input/touch';
import { pollGamepad } from './input/gamepad';
import {
  initAudio,
  setAudio,
  sfxComer,
  sfxMadura,
  sfxAmarga,
  sfxEspelho,
  sfxOuroboro,
  sfxPoder,
  sfxDash,
  sfxOnda,
  sfxRebobinar,
  sfxMorte,
  sfxDano,
  setCamadas,
  tickMusica,
  suspendAudio,
  resumeAudio,
} from './audio/synth';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false });
if (!ctx) throw new Error('sem contexto 2d');

let saveData: SaveData = load();
let pal: Paleta = buildPaleta(saveData.opcoes.daltonismo, saveData.opcoes.altoContraste);
let layer: StaticLayer;
let lay: Layout;

const stress = new URLSearchParams(location.search).has('stress');

// Layout: arena quadrada com faixa a esquerda para a energia e rodape
// para os poderes. Respeita 320 px de largura para cima.
function computeLayout(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(280, window.innerWidth);
  const cssH = Math.max(360, window.innerHeight);
  const margem = 8;
  const esquerdaCss = Math.max(26, Math.min(52, cssW * 0.09));
  const rodapeCss = Math.max(58, Math.min(96, cssH * 0.13));
  const topoCss = Math.max(26, Math.min(44, cssH * 0.045)); // placar e moedas
  const dispW = cssW - esquerdaCss - margem * 2;
  const dispH = cssH - rodapeCss - topoCss - margem * 2;
  const arenaCss = Math.max(160, Math.min(dispW, dispH));
  const cell = Math.max(4, Math.floor((arenaCss * dpr) / GRID_DEFAULT));
  const arenaPx = cell * GRID_DEFAULT;
  const esquerda = Math.round(esquerdaCss * dpr);
  const rodape = Math.round(rodapeCss * dpr);
  const topo = Math.round(topoCss * dpr);
  const w = esquerda + arenaPx + Math.round(margem * dpr);
  const h = topo + arenaPx + rodape;

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${Math.round(w / dpr)}px`;
  canvas.style.height = `${Math.round(h / dpr)}px`;

  lay = {
    cell,
    arenaX: esquerda,
    arenaY: topo,
    arenaPx,
    w,
    h,
    esquerda,
    rodape,
  };
  layer = buildStaticLayer(GRID_DEFAULT, GRID_DEFAULT, cell, pal);
}
computeLayout();

// Estado do app
let sim: Sim | null = null;
let ghost: GhostPlayer | null = null;
let gravador = new GhostRecorder();
let modoAtual: ModeId = 'ouroboro';
let rodando = false;
let pausado = false;
let dpadEl: HTMLElement | null = null;

// Game feel
let hitstopAte = 0;
let shake = 0;
let zoom = 1;
let morte = 0;
let tempo = 0;
let acc = 0;
let last = performance.now();
let fpsAcc = 0;
let fpsFrames = 0;
let fps = 0;

const fila = new InputQueue(2);

const sink: InputSink = {
  dir(d) {
    if (!rodando || pausado || !sim) return;
    fila.pushDir(d, sim.state.dir);
  },
  power(slot) {
    if (!rodando || pausado || !sim) return;
    fila.pushCommand({ kind: 'power', slot });
  },
  ouroboro() {
    if (!rodando || pausado || !sim) return;
    fila.pushCommand({ kind: 'ouroboro' });
  },
  pause() {
    if (!rodando) return;
    if (pausado) retomar();
    else pausar();
  },
};

const ui = new UI(saveData, {
  jogar: (mode) => iniciar(mode),
  retomar: () => retomar(),
  sair: () => encerrar(true),
  mudouSave: () => {
    save(saveData);
    aplicarOpcoes();
  },
});

function aplicarOpcoes(): void {
  pal = buildPaleta(saveData.opcoes.daltonismo, saveData.opcoes.altoContraste);
  setAudio(saveData.opcoes.audio);
  computeLayout();
  atualizarDpad();
}

function atualizarDpad(): void {
  const querDpad = saveData.opcoes.dpad && rodando && !pausado;
  if (querDpad && !dpadEl) {
    dpadEl = buildDpad(sink);
    document.body.appendChild(dpadEl);
  } else if (!querDpad && dpadEl) {
    dpadEl.remove();
    dpadEl = null;
  }
}

function iniciar(mode: ModeId): void {
  initAudio();
  modoAtual = mode;
  const hoje = new Date();
  // No modo Fantasma a run corre com a mesma seed da gravacao, senao a
  // cobra translucida estaria correndo em outro mapa.
  let seed = (Math.random() * 0xffffffff) >>> 0;
  if (mode === 'diario') seed = seedDoDia(hoje);
  else if (mode === 'fantasma' && saveData.ghost) seed = saveData.ghost.seed;
  seedGravada = seed;
  sim = new Sim({
    seed,
    mode,
    powers: saveData.loadout.slice(0, 3),
    relics: saveData.reliquiasEquipadas.slice(0, 2),
  });
  gravador = new GhostRecorder();
  ghost = mode === 'fantasma' ? new GhostPlayer(saveData.ghost) : null;
  fila.clear();
  clearParticles();
  acc = 0;
  morte = 0;
  shake = 0;
  zoom = 1;
  hitstopAte = 0;
  rodando = true;
  pausado = false;
  ui.esconder();
  atualizarDpad();

  if (stress) semearEstresse();
}

// Teste de estresse: 200 segmentos e 400 particulas na tela.
function semearEstresse(): void {
  if (!sim) return;
  const s = sim.state;
  s.growth = 200;
  for (let i = 0; i < 200; i++) {
    s.body.push(s.body[s.body.length - 2], s.body[s.body.length - 1]);
  }
  for (let i = 0; i < 80; i++) {
    const x = 1 + ((i * 7) % (s.gridW - 2));
    const y = 1 + ((i * 11) % (s.gridH - 2));
    s.corr[y * s.gridW + x] = 1;
    s.corrCount++;
  }
}

function pausar(): void {
  if (!rodando || pausado) return;
  pausado = true;
  suspendAudio();
  ui.pausa();
  atualizarDpad();
}

function retomar(): void {
  if (!rodando) return;
  pausado = false;
  last = performance.now();
  resumeAudio();
  ui.esconder();
  atualizarDpad();
}

function encerrar(voluntario: boolean): void {
  if (!sim) return;
  const s = sim.state;
  rodando = false;
  pausado = false;
  atualizarDpad();

  const ganhas = s.coins;
  saveData.coins += ganhas;
  const rec = saveData.recordes[modoAtual] ?? 0;
  const novoRecorde = s.score > rec;
  if (novoRecorde) saveData.recordes[modoAtual] = s.score;

  // Grava o fantasma quando a run e a melhor de todas.
  if (novoRecorde && s.score > 0) {
    saveData.ghost = gravador.build({
      mode: modoAtual,
      seed: 0,
      score: s.score,
      powers: saveData.loadout.slice(0, 3),
      relics: saveData.reliquiasEquipadas.slice(0, 2),
    });
    // A seed real precisa acompanhar o replay.
    saveData.ghost.seed = seedGravada;
  }

  if (modoAtual === 'diario') {
    const dia = dataISO(new Date());
    const idx = saveData.diario.findIndex((d) => d.data === dia);
    if (idx >= 0) saveData.diario[idx].score = Math.max(saveData.diario[idx].score, s.score);
    else saveData.diario.unshift({ data: dia, score: s.score });
    saveData.diario = saveData.diario.slice(0, 30);
  }

  save(saveData);
  ui.atualizarSave(saveData);
  ui.fim(s.score, ganhas, novoRecorde, voluntario ? 'desistencia' : s.causa, modoAtual);
  sim = null;
  ghost = null;
}

let seedGravada = 0;

// Eventos do tick viram som, particula e tremor. O nucleo nao sabe disso.
function reagirEventos(s: GameState, agora: number): void {
  const ev = s.events;
  if (ev === 0) return;
  const reduz = saveData.opcoes.reduzirMovimento;
  const cx = lay.arenaX + (s.body[0] + 0.5) * lay.cell;
  const cy = lay.arenaY + (s.body[1] + 0.5) * lay.cell;
  const skin = skinAtual(saveData);

  if (ev & EV_COMEU) {
    hitstopAte = agora + 40;
    sfxComer(skin.mordida, s.combo);
    if (!reduz) {
      const cor = corDaSkin(skin.acento);
      emit(
        lay.arenaX + (s.lastEatX + 0.5) * lay.cell,
        lay.arenaY + (s.lastEatY + 0.5) * lay.cell,
        10,
        lay.cell * 5,
        340,
        lay.cell * 0.22,
        rastroKind(skin.rastro),
        cor[0],
        cor[1],
        cor[2],
        -1,
      );
    }
    shake = Math.min(1, shake + 0.12);
  }
  if (ev & EV_MADURA) sfxMadura();
  if (ev & EV_AMARGA) sfxAmarga();
  if (ev & EV_ESPELHO) sfxEspelho();
  if (ev & EV_OURO) {
    hitstopAte = agora + 90;
    sfxOuroboro();
    shake = Math.min(1, shake + 0.5);
    if (!reduz) emit(cx, cy, 46, lay.cell * 9, 620, lay.cell * 0.3, KIND_PONTO, 217, 164, 65, -1);
  }
  if (ev & EV_PODER) sfxPoder();
  if (ev & EV_DASH) {
    sfxDash();
    shake = Math.min(1, shake + 0.2);
    if (!reduz) emit(cx, cy, 22, lay.cell * 7, 300, lay.cell * 0.2, KIND_RISCO, 226, 218, 200, -1);
  }
  if (ev & EV_ONDA) {
    sfxOnda();
    shake = Math.min(1, shake + 0.7);
    if (!reduz) emit(cx, cy, 60, lay.cell * 12, 520, lay.cell * 0.24, KIND_QUADRADO, 122, 75, 168, -1);
  }
  if (ev & EV_REBOBINOU) {
    sfxRebobinar();
    if (!reduz) emit(cx, cy, 30, lay.cell * 6, 500, lay.cell * 0.2, KIND_PONTO, 159, 216, 232, -1);
  }
  if (ev & EV_CORRUPCAO_PAGA) {
    sfxDano();
    shake = Math.min(1, shake + 0.3);
    if (!reduz) emit(cx, cy, 16, lay.cell * 5, 380, lay.cell * 0.2, KIND_QUADRADO, 122, 75, 168, -1);
  }
  if (ev & EV_ESCUDO) {
    sfxDano();
    shake = Math.min(1, shake + 0.6);
  }
  if (ev & EV_ENCOLHEU) shake = Math.min(1, shake + 0.25);
  if (ev & EV_MORTE) {
    sfxMorte();
    shake = Math.min(1, shake + 0.9);
    if (!reduz) {
      const n = Math.min(60, segmentCount(s) * 2);
      emit(cx, cy, n, lay.cell * 6, 900, lay.cell * 0.26, KIND_QUADRADO, 226, 218, 200, -1);
    }
  }
}

// Rastro continuo da cauda, definido pela skin. Sai do pool, nao aloca.
function emitirRastro(s: GameState): void {
  if (saveData.opcoes.reduzirMovimento) return;
  const skin = skinAtual(saveData);
  if (skin.rastro === 'nenhum' || s.tick % 2 !== 0) return;
  const n = s.body.length;
  const c = corDaSkin(skin.rastro === 'sombra' ? '#000000' : skin.acento);
  emit(
    lay.arenaX + (s.body[n - 2] + 0.5) * lay.cell,
    lay.arenaY + (s.body[n - 1] + 0.5) * lay.cell,
    1,
    lay.cell * 1.4,
    420,
    lay.cell * 0.16,
    rastroKind(skin.rastro),
    c[0],
    c[1],
    c[2],
    -1,
  );
}

function rastroKind(r: string): number {
  if (r === 'caco' || r === 'papel' || r === 'pulso') return KIND_QUADRADO;
  if (r === 'faisca' || r === 'tinta') return KIND_RISCO;
  return KIND_PONTO;
}

const corCache: Record<string, [number, number, number]> = {};
function corDaSkin(hex: string): [number, number, number] {
  const hit = corCache[hex];
  if (hit) return hit;
  const v = parseInt(hex.replace('#', ''), 16);
  const out: [number, number, number] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  corCache[hex] = out;
  return out;
}

const view: ViewOpts = {
  pal,
  skin: skinAtual(saveData),
  grao: true,
  shake: 0,
  zoom: 1,
  tempo: 0,
  morte: 0,
  ghost: null,
};

function frame(now: number): void {
  const elapsed = Math.min(now - last, 250); // clamp anti espiral da morte
  last = now;
  tempo += elapsed;

  fpsAcc += elapsed;
  fpsFrames++;
  if (fpsAcc >= 500) {
    fps = (fpsFrames * 1000) / fpsAcc;
    fpsAcc = 0;
    fpsFrames = 0;
  }

  if (rodando && !pausado && sim) {
    pollGamepad(sink);
    const s = sim.state;
    // Dilatacao estica o tempo real por tick. O input segue normal.
    const escala = s.dilatacaoTimer > 0 ? 0.35 : 1;
    const dt = 1000 / (ticksPerSecond(s) * escala);
    if (now >= hitstopAte) acc += elapsed;

    let passos = 0;
    while (acc >= dt && passos < 6) {
      const cmd: Command | null = fila.consume();
      gravador.record(sim.state.tick, cmd);
      const novo = sim.advance(cmd);
      if (ghost) ghost.advance();
      acc -= dt;
      passos++;
      reagirEventos(novo, now);
      emitirRastro(novo);
      setCamadas(novo.combo);
      if (!novo.alive) {
        acc = 0;
        break;
      }
    }
    if (!sim.state.alive) {
      morte = Math.min(1, morte + elapsed / 900);
      if (morte >= 1) encerrar(false);
    }
  }

  // Amortece o game feel.
  shake = Math.max(0, shake - elapsed / 320);
  const comboAlvo = sim ? 1 + (Math.min(sim.state.combo, COMBO_MAX) / COMBO_MAX) * 0.04 : 1;
  zoom += (comboAlvo - zoom) * Math.min(1, elapsed / 200);
  updateParticles(elapsed, lay.cell * 3);
  tickMusica(elapsed, rodando && !pausado);

  desenhar();
  requestAnimationFrame(frame);
}

function desenhar(): void {
  const c = ctx!;
  c.fillStyle = pal.fundo;
  c.fillRect(0, 0, lay.w, lay.h);

  if (sim) {
    const reduz = saveData.opcoes.reduzirMovimento;
    view.pal = pal;
    view.skin = skinAtual(saveData);
    view.grao = saveData.opcoes.grao && !reduz;
    view.shake = saveData.opcoes.shake && !reduz ? shake : 0;
    view.zoom = reduz ? 1 : zoom;
    view.tempo = tempo;
    view.morte = morte;
    view.ghost = ghost ? ghost.body : null;

    const dt = 1000 / ticksPerSecond(sim.state);
    const alpha = reduz ? 1 : Math.max(0, Math.min(1, acc / dt));

    c.save();
    c.translate(lay.arenaX, lay.arenaY);
    c.beginPath();
    c.rect(0, 0, lay.arenaPx, lay.arenaPx);
    c.clip();
    render(c, layer, sim.prev, sim.state, alpha, view);
    // Na morte a cena congela e perde a cor enquanto a cobra se desfaz.
    // Uma lavagem cinza translucida, e nao ctx.filter nem composicao de
    // saturacao: os dois custam dezenas de ms por frame em canvas grande.
    if (morte > 0) {
      c.fillStyle = `rgba(126,120,110,${(morte * 0.4).toFixed(3)})`;
      c.fillRect(0, 0, lay.arenaPx, lay.arenaPx);
    }
    c.restore();

    drawHud(c, lay, sim.state, pal, tempo, saveData.coins);
  } else {
    c.save();
    c.translate(lay.arenaX, lay.arenaY);
    c.drawImage(layer.grade, 0, 0);
    c.restore();
  }

  if (stress) {
    c.fillStyle = '#7FFFD4';
    c.font = `700 ${Math.floor(lay.arenaPx * 0.035)}px ui-monospace, monospace`;
    c.textAlign = 'left';
    const segs = sim ? segmentCount(sim.state) : 0;
    c.fillText(`${fps.toFixed(1)} fps | ${segs} segmentos | ${particleCount()} particulas`, lay.arenaX + 6, lay.arenaY + lay.arenaPx - 8);
    if (sim && particleCount() < 380) {
      emit(lay.arenaX + lay.arenaPx / 2, lay.arenaY + lay.arenaPx / 2, 24, lay.cell * 8, 1200, lay.cell * 0.24, KIND_QUADRADO, 226, 218, 200, -1);
    }
  }
}

// Wiring de entrada e ciclo de vida.
attachKeyboard(sink);
attachTouch(document.body, sink);
window.addEventListener('resize', () => computeLayout());
window.addEventListener('orientationchange', () => computeLayout());
window.addEventListener('blur', () => pausar());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pausar();
});
document.body.addEventListener('pointerdown', () => initAudio(), { once: true });

// Service worker so para o jogo abrir offline. Nao busca nada em jogo.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('sw.js').catch(() => {
      // Sem service worker o jogo funciona igual, so nao abre offline.
    });
  });
}

setAudio(saveData.opcoes.audio);
seedGravada = 0;
ui.menu();
if (stress) iniciar('ouroboro');
requestAnimationFrame((t) => {
  last = t;
  requestAnimationFrame(frame);
});
