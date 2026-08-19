import type { Dir } from '../core/state';

export interface InputSink {
  dir(d: Dir): void;
  power(slot: number): void;
  ouroboro(): void;
  pause(): void;
}

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: 0,
  ArrowRight: 1,
  ArrowDown: 2,
  ArrowLeft: 3,
  KeyW: 0,
  KeyD: 1,
  KeyS: 2,
  KeyA: 3,
};

// Devolve o teardown: nada de vazar listener ao trocar de tela.
export function attachKeyboard(sink: InputSink): () => void {
  const handler = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const dir = KEY_TO_DIR[e.code];
    if (dir !== undefined) {
      e.preventDefault();
      sink.dir(dir);
      return;
    }
    // Atalhos numericos do rodape: 1 a 3 sao os poderes, 4 e o Ouroboro.
    // Numpad vale igual, e o espaco segue como atalho do Ouroboro.
    if (e.code === 'Digit1' || e.code === 'Numpad1') sink.power(0);
    else if (e.code === 'Digit2' || e.code === 'Numpad2') sink.power(1);
    else if (e.code === 'Digit3' || e.code === 'Numpad3') sink.power(2);
    else if (e.code === 'Digit4' || e.code === 'Numpad4') sink.ouroboro();
    else if (e.code === 'Space') {
      e.preventDefault();
      sink.ouroboro();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      sink.pause();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
