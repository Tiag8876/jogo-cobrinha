import { createInitialState, TICKS_PER_SECOND_BASE, GRID_DEFAULT } from './core/state';
import type { GameState } from './core/state';
import { step, InputQueue } from './core/step';
import { buildStaticLayer, BG_COLOR } from './render/layers';
import { render } from './render/renderer';
import { attachKeyboard } from './input/keyboard';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('sem contexto 2d');

// Dimensiona o canvas para caber na viewport, com devicePixelRatio.
function fitCanvas(): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.min(window.innerWidth, window.innerHeight) - 16;
  const cell = Math.max(8, Math.floor((size * dpr) / GRID_DEFAULT));
  const px = cell * GRID_DEFAULT;
  canvas.width = px;
  canvas.height = px;
  canvas.style.width = `${px / dpr}px`;
  canvas.style.height = `${px / dpr}px`;
  return cell;
}

let cell = fitCanvas();
let layer = buildStaticLayer(GRID_DEFAULT, GRID_DEFAULT, cell);

window.addEventListener('resize', () => {
  cell = fitCanvas();
  layer = buildStaticLayer(GRID_DEFAULT, GRID_DEFAULT, cell);
});

const seed = (Math.random() * 0xffffffff) >>> 0;
let cur: GameState = createInitialState(seed);
let prev: GameState = cur;

const inputQueue = new InputQueue(2);
let paused = false;

const detachKeyboard = attachKeyboard(
  (dir) => {
    if (!cur.alive) {
      restart();
      return;
    }
    inputQueue.push(dir, cur.dir);
  },
  () => {
    paused = !paused;
  },
);
void detachKeyboard; // teardown usado quando menus chegarem no M4

window.addEventListener('blur', () => {
  paused = true;
});

function restart(): void {
  cur = createInitialState((Math.random() * 0xffffffff) >>> 0);
  prev = cur;
  inputQueue.clear();
  paused = false;
}

// Loop com timestep fixo e acumulador. Render interpolado.
const DT = 1000 / TICKS_PER_SECOND_BASE;
let acc = 0;
let last = performance.now();
let hitstopUntil = 0; // congela a simulacao por alguns ms ao comer
let eatPulse = 0;

function frame(now: number): void {
  const elapsed = Math.min(now - last, 250); // clamp anti espiral da morte
  last = now;

  if (!paused && cur.alive) {
    if (now >= hitstopUntil) acc += elapsed;
    while (acc >= DT) {
      prev = cur;
      cur = step(cur, inputQueue.consume());
      acc -= DT;
      if (cur.ateThisTick) {
        hitstopUntil = now + 40;
        eatPulse = 1;
      }
      if (!cur.alive) acc = 0;
    }
  }

  eatPulse = Math.max(0, eatPulse - elapsed / 180);

  const alpha = Math.min(1, acc / DT);
  render(ctx!, layer, prev, cur, alpha, eatPulse);

  if (paused || !cur.alive) drawOverlay(cur.alive ? 'PAUSA' : 'FIM', cur.alive ? 'espaco para voltar' : 'qualquer direcao reinicia');

  requestAnimationFrame(frame);
}

function drawOverlay(title: string, sub: string): void {
  const c = ctx!;
  c.fillStyle = 'rgba(22,19,15,0.72)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#E2DAC8';
  c.textAlign = 'center';
  c.font = `700 ${Math.floor(canvas.width * 0.09)}px ui-monospace, monospace`;
  c.fillText(title, canvas.width / 2, canvas.height / 2);
  c.font = `400 ${Math.floor(canvas.width * 0.03)}px ui-monospace, monospace`;
  c.fillText(sub, canvas.width / 2, canvas.height / 2 + canvas.width * 0.06);
}

document.body.style.background = BG_COLOR;
requestAnimationFrame((t) => {
  last = t;
  requestAnimationFrame(frame);
});
