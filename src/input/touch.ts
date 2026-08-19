import type { InputSink } from './keyboard';
import type { Dir } from '../core/state';

// Swipe tolerante: reconhece pelo eixo dominante com limiar baixo,
// sem exigir precisao. Toque curto sem arrasto vira um tap com
// coordenadas: o main decide se acertou um botao do HUD ou o Ouroboro.

const LIMIAR = 18; // px
const TOQUE_CURTO_MS = 220;

export type TapHandler = (clientX: number, clientY: number) => void;

export function attachTouch(alvo: HTMLElement, sink: InputSink, onTap: TapHandler): () => void {
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let ativo = false;
  let disparou = false;

  const start = (e: TouchEvent): void => {
    const t = e.changedTouches[0];
    x0 = t.clientX;
    y0 = t.clientY;
    t0 = e.timeStamp;
    ativo = true;
    disparou = false;
  };

  const move = (e: TouchEvent): void => {
    if (!ativo || disparou) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (Math.abs(dx) < LIMIAR && Math.abs(dy) < LIMIAR) return;
    e.preventDefault();
    const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    sink.dir(dir);
    disparou = true;
    // Reancora para permitir uma segunda curva no mesmo arrasto.
    x0 = t.clientX;
    y0 = t.clientY;
    disparou = false;
  };

  const end = (e: TouchEvent): void => {
    if (!ativo) return;
    ativo = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (e.timeStamp - t0 < TOQUE_CURTO_MS && Math.abs(dx) < LIMIAR && Math.abs(dy) < LIMIAR) {
      onTap(t.clientX, t.clientY);
    }
  };

  alvo.addEventListener('touchstart', start, { passive: true });
  alvo.addEventListener('touchmove', move, { passive: false });
  alvo.addEventListener('touchend', end, { passive: true });
  return () => {
    alvo.removeEventListener('touchstart', start);
    alvo.removeEventListener('touchmove', move);
    alvo.removeEventListener('touchend', end);
  };
}

// D-pad opcional na tela, para quem prefere botao a gesto.
export function buildDpad(sink: InputSink): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ouro-dpad';
  const dirs: [string, Dir][] = [
    ['cima', 0],
    ['esq', 3],
    ['dir', 1],
    ['baixo', 2],
  ];
  for (const [nome, d] of dirs) {
    const b = document.createElement('button');
    b.className = `ouro-dbtn ouro-d-${nome}`;
    b.setAttribute('aria-label', nome);
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sink.dir(d);
    });
    b.addEventListener('mousedown', () => sink.dir(d));
    wrap.appendChild(b);
  }
  return wrap;
}
