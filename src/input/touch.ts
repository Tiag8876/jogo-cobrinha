import type { InputSink } from './keyboard';
import type { Dir } from '../core/state';

// Swipe tolerante: reconhece pelo eixo dominante, com limiar baixo e
// proporcional a tela, sem exigir precisao. Um arrasto continuo pode
// encadear varias curvas. Toque curto vira um tap com coordenadas, e o
// main decide se acertou um botao do HUD ou o Ouroboro.

const TOQUE_CURTO_MS = 260;

export type TapHandler = (clientX: number, clientY: number) => void;

// O limiar acompanha o tamanho do aparelho: 4% do menor lado, preso
// entre 10 e 26 px. Em tela pequena o dedo anda menos, e o gesto tem
// que continuar valendo.
function limiar(): number {
  const menor = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(10, Math.min(26, menor * 0.04));
}

// Toque que comeca sobre um menu, sobre o direcional ou sobre qualquer
// botao pertence a interface, nao ao tabuleiro: o jogo nao intercepta,
// senao a lista da loja para de rolar no celular.
function daInterface(alvo: EventTarget | null): boolean {
  const el = alvo as Element | null;
  if (!el || typeof el.closest !== 'function') return false;
  return el.closest('.ouro-ui, .ouro-dpad, button, a, input, select') !== null;
}

export function attachTouch(alvo: HTMLElement, sink: InputSink, onTap: TapHandler): () => void {
  let x0 = 0;
  let y0 = 0;
  let tx = 0;
  let ty = 0;
  let t0 = 0;
  let ativo = false;
  let curvou = false;
  let idToque = -1;

  const start = (e: TouchEvent): void => {
    if (ativo || daInterface(e.target)) return;
    const t = e.changedTouches[0];
    idToque = t.identifier;
    x0 = tx = t.clientX;
    y0 = ty = t.clientY;
    t0 = e.timeStamp;
    ativo = true;
    curvou = false;
  };

  // Encontra o dedo que iniciou o gesto: multitoque nao deve embaralhar.
  function meuToque(e: TouchEvent): Touch | null {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === idToque) return e.changedTouches[i];
    }
    return null;
  }

  const move = (e: TouchEvent): void => {
    if (!ativo) return;
    const t = meuToque(e);
    if (!t) return;
    const lim = limiar();
    const dx = t.clientX - tx;
    const dy = t.clientY - ty;
    if (Math.abs(dx) < lim && Math.abs(dy) < lim) return;
    if (e.cancelable) e.preventDefault();
    const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    sink.dir(dir);
    curvou = true;
    // Reancora no ponto atual, para o mesmo arrasto poder desenhar uma
    // segunda curva sem levantar o dedo.
    tx = t.clientX;
    ty = t.clientY;
  };

  const end = (e: TouchEvent): void => {
    if (!ativo) return;
    const t = meuToque(e);
    if (!t) return;
    ativo = false;
    idToque = -1;
    if (curvou) return;
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    const lim = limiar();
    const curto = e.timeStamp - t0 < TOQUE_CURTO_MS;
    // Gesto rapido e curto ainda conta como curva, com metade do limiar:
    // o dedo apressado quase nunca completa a distancia cheia.
    if (curto && (Math.abs(dx) > lim * 0.5 || Math.abs(dy) > lim * 0.5)) {
      sink.dir(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
      return;
    }
    if (curto) onTap(t.clientX, t.clientY);
  };

  const cancel = (): void => {
    ativo = false;
    idToque = -1;
  };

  alvo.addEventListener('touchstart', start, { passive: true });
  alvo.addEventListener('touchmove', move, { passive: false });
  alvo.addEventListener('touchend', end, { passive: true });
  alvo.addEventListener('touchcancel', cancel, { passive: true });
  return () => {
    alvo.removeEventListener('touchstart', start);
    alvo.removeEventListener('touchmove', move);
    alvo.removeEventListener('touchend', end);
    alvo.removeEventListener('touchcancel', cancel);
  };
}

// Direcional opcional na tela. O tamanho vem do layout, para caber tanto
// no celular em pe quanto deitado.
export function buildDpad(sink: InputSink, tamanho: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ouro-dpad';
  const b = Math.round(tamanho / 3);
  wrap.style.width = `${b * 3}px`;
  wrap.style.height = `${b * 3}px`;
  const dirs: [string, Dir, number, number][] = [
    ['cima', 0, b, 0],
    ['esquerda', 3, 0, b],
    ['direita', 1, b * 2, b],
    ['baixo', 2, b, b * 2],
  ];
  for (const [nome, d, x, y] of dirs) {
    const btn = document.createElement('button');
    btn.className = 'ouro-dbtn';
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    btn.style.width = `${b}px`;
    btn.style.height = `${b}px`;
    btn.setAttribute('aria-label', nome);
    const acionar = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      sink.dir(d);
    };
    btn.addEventListener('touchstart', acionar, { passive: false });
    btn.addEventListener('mousedown', acionar);
    wrap.appendChild(btn);
  }
  return wrap;
}
