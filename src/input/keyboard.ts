import type { Dir } from '../core/state';

export type DirHandler = (dir: Dir) => void;

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

// Retorna uma funcao de teardown para nao vazar listener na troca de tela.
export function attachKeyboard(onDir: DirHandler, onPause: () => void): () => void {
  const handler = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIR[e.code];
    if (dir !== undefined) {
      e.preventDefault();
      onDir(dir);
      return;
    }
    if (e.code === 'Space' || e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      onPause();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
