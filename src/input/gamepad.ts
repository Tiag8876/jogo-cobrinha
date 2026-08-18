import type { InputSink } from './keyboard';
import type { Dir } from '../core/state';

// Gamepad e polling, nao evento. Chamado uma vez por frame.

const anterior: boolean[] = [];

function pressed(i: number, agora: boolean, sink: () => void): void {
  if (agora && !anterior[i]) sink();
  anterior[i] = agora;
}

export function pollGamepad(sink: InputSink): void {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (!pad) continue;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const b = pad.buttons;
    const up = (b[12] && b[12].pressed) || ay < -0.5;
    const down = (b[13] && b[13].pressed) || ay > 0.5;
    const left = (b[14] && b[14].pressed) || ax < -0.5;
    const right = (b[15] && b[15].pressed) || ax > 0.5;
    pressed(0, !!up, () => sink.dir(0 as Dir));
    pressed(1, !!right, () => sink.dir(1 as Dir));
    pressed(2, !!down, () => sink.dir(2 as Dir));
    pressed(3, !!left, () => sink.dir(3 as Dir));
    pressed(4, !!(b[0] && b[0].pressed), () => sink.ouroboro());
    pressed(5, !!(b[2] && b[2].pressed), () => sink.power(0));
    pressed(6, !!(b[1] && b[1].pressed), () => sink.power(1));
    pressed(7, !!(b[3] && b[3].pressed), () => sink.power(2));
    pressed(8, !!(b[9] && b[9].pressed), () => sink.pause());
    return;
  }
}
