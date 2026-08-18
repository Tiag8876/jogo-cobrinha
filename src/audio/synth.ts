// Tudo sintetizado: osciladores, envelopes e ruido filtrado.
// Zero arquivos de som, zero peso no bundle.

let ctxA: AudioContext | null = null;
let master: GainNode | null = null;
let ruidoBuf: AudioBuffer | null = null;
let ligado = true;
let volume = 0.7;

// Trilha procedural
let proxNota = 0;
let passo = 0;
let camadas = 1;

const ESCALA = [0, 3, 5, 7, 10, 12, 15]; // menor pentatonica com extensao

export function audioLigado(): boolean {
  return ligado;
}

export function setAudio(on: boolean): void {
  ligado = on;
  if (master) master.gain.value = on ? volume : 0;
}

export function setVolume(v: number): void {
  volume = v;
  if (master) master.gain.value = ligado ? v : 0;
}

// Precisa ser chamado a partir de um gesto do usuario.
export function initAudio(): void {
  if (ctxA) {
    if (ctxA.state === 'suspended') void ctxA.resume();
    return;
  }
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctxA = new Ctor();
  master = ctxA.createGain();
  master.gain.value = ligado ? volume : 0;
  const comp = ctxA.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 8;
  master.connect(comp).connect(ctxA.destination);

  const len = Math.floor(ctxA.sampleRate * 0.6);
  ruidoBuf = ctxA.createBuffer(1, len, ctxA.sampleRate);
  const d = ruidoBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

function now(): number {
  return ctxA ? ctxA.currentTime : 0;
}

interface ToneOpts {
  freq: number;
  tipo?: OscillatorType;
  dur?: number;
  vol?: number;
  slide?: number; // frequencia final
  atk?: number;
  destino?: AudioNode;
}

function tone(o: ToneOpts): void {
  if (!ctxA || !master || !ligado) return;
  const t = now();
  const dur = o.dur ?? 0.12;
  const osc = ctxA.createOscillator();
  const g = ctxA.createGain();
  osc.type = o.tipo ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
  const atk = o.atk ?? 0.004;
  const vol = o.vol ?? 0.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(o.destino ?? master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, q: number, tipo: BiquadFilterType = 'bandpass'): void {
  if (!ctxA || !master || !ruidoBuf || !ligado) return;
  const t = now();
  const src = ctxA.createBufferSource();
  src.buffer = ruidoBuf;
  const f = ctxA.createBiquadFilter();
  f.type = tipo;
  f.frequency.setValueAtTime(freq, t);
  f.Q.value = q;
  const g = ctxA.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur);
}

export interface MordidaSom {
  freq: number;
  tipo: OscillatorType;
  ruido: number;
}

export function sfxComer(m: MordidaSom, combo: number): void {
  const mult = 1 + Math.min(combo, 8) * 0.09;
  tone({ freq: m.freq * mult, tipo: m.tipo, dur: 0.09, vol: 0.18, slide: m.freq * mult * 1.9 });
  if (m.ruido > 0) noise(0.06 * m.ruido, 0.09 * m.ruido, 1200 + combo * 180, 3);
}

export function sfxMadura(): void {
  tone({ freq: 520, tipo: 'triangle', dur: 0.14, vol: 0.16, slide: 900 });
  tone({ freq: 780, tipo: 'sine', dur: 0.2, vol: 0.1, slide: 1300 });
}

export function sfxAmarga(): void {
  tone({ freq: 300, tipo: 'sawtooth', dur: 0.26, vol: 0.14, slide: 130 });
  noise(0.2, 0.08, 400, 1, 'lowpass');
}

export function sfxEspelho(): void {
  tone({ freq: 880, tipo: 'sine', dur: 0.3, vol: 0.12, slide: 1760 });
  tone({ freq: 1320, tipo: 'sine', dur: 0.3, vol: 0.07, slide: 2640 });
}

// O som assinatura: precisa ser gostoso de apertar.
export function sfxOuroboro(): void {
  tone({ freq: 320, tipo: 'sawtooth', dur: 0.42, vol: 0.2, slide: 60 });
  tone({ freq: 160, tipo: 'square', dur: 0.34, vol: 0.14, slide: 40 });
  noise(0.36, 0.16, 700, 0.8, 'lowpass');
  tone({ freq: 1200, tipo: 'sine', dur: 0.5, vol: 0.08, slide: 220 });
}

export function sfxPoder(): void {
  tone({ freq: 420, tipo: 'square', dur: 0.1, vol: 0.13, slide: 840 });
}

export function sfxDash(): void {
  noise(0.14, 0.14, 2200, 1.5, 'highpass');
  tone({ freq: 700, tipo: 'sawtooth', dur: 0.1, vol: 0.1, slide: 1600 });
}

export function sfxOnda(): void {
  noise(0.45, 0.2, 220, 0.6, 'lowpass');
  tone({ freq: 90, tipo: 'sine', dur: 0.4, vol: 0.2, slide: 40 });
}

export function sfxRebobinar(): void {
  tone({ freq: 1200, tipo: 'sine', dur: 0.5, vol: 0.14, slide: 200 });
  noise(0.5, 0.08, 900, 2);
}

export function sfxDano(): void {
  tone({ freq: 180, tipo: 'square', dur: 0.16, vol: 0.16, slide: 70 });
  noise(0.12, 0.12, 500, 1, 'lowpass');
}

export function sfxMorte(): void {
  tone({ freq: 260, tipo: 'sawtooth', dur: 1.1, vol: 0.2, slide: 35 });
  tone({ freq: 130, tipo: 'sine', dur: 1.3, vol: 0.16, slide: 28 });
  noise(0.9, 0.12, 300, 0.7, 'lowpass');
}

export function sfxUi(alto: boolean): void {
  tone({ freq: alto ? 660 : 440, tipo: 'triangle', dur: 0.05, vol: 0.09 });
}

export function sfxCompra(): void {
  tone({ freq: 520, tipo: 'triangle', dur: 0.08, vol: 0.12 });
  tone({ freq: 780, tipo: 'triangle', dur: 0.14, vol: 0.1, slide: 1040 });
}

// Trilha procedural: ganha camadas conforme o combo sobe.
export function setCamadas(combo: number): void {
  camadas = Math.max(1, Math.min(4, Math.ceil(combo / 2)));
}

export function tickMusica(dtMs: number, tocando: boolean): void {
  if (!ctxA || !ligado || !tocando) return;
  proxNota -= dtMs;
  if (proxNota > 0) return;
  proxNota = 340 - camadas * 24;
  passo++;

  const raiz = 55; // A1
  const grau = ESCALA[(passo * 3) % ESCALA.length];
  const baixo = raiz * Math.pow(2, grau / 12);

  // Camada 1: baixo pulsante, sempre presente.
  if (passo % 2 === 0) tone({ freq: baixo, tipo: 'triangle', dur: 0.3, vol: 0.075 });
  // Camada 2: percussao de ruido.
  if (camadas >= 2 && passo % 4 === 2) noise(0.07, 0.05, 3200, 2, 'highpass');
  // Camada 3: arpejo.
  if (camadas >= 3) {
    const nota = baixo * 4 * Math.pow(2, ESCALA[(passo * 5) % ESCALA.length] / 12);
    tone({ freq: nota, tipo: 'square', dur: 0.11, vol: 0.032 });
  }
  // Camada 4: pad agudo no topo do combo.
  if (camadas >= 4 && passo % 8 === 0) {
    tone({ freq: baixo * 8, tipo: 'sine', dur: 0.9, vol: 0.028, slide: baixo * 6 });
  }
}

export function suspendAudio(): void {
  if (ctxA && ctxA.state === 'running') void ctxA.suspend();
}

export function resumeAudio(): void {
  if (ctxA && ctxA.state === 'suspended') void ctxA.resume();
}
