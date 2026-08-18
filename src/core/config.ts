// Numeros de balanceamento e definicoes de dados. Sem logica.

export type PowerId = 'fase' | 'dash' | 'rebobinar' | 'ima' | 'onda' | 'dilatacao' | 'semear';

export interface PowerDef {
  id: PowerId;
  nome: string;
  custo: number; // segmentos
  cooldown: number; // ticks
  duracao: number; // ticks de efeito, 0 = instantaneo
  desc: string;
  preco: number; // custo de desbloqueio na loja
}

export const POWERS: Record<PowerId, PowerDef> = {
  fase: {
    id: 'fase',
    nome: 'Fase',
    custo: 4,
    cooldown: 80,
    duracao: 20,
    desc: 'Atravessa o proprio corpo e as paredes por 2,5 s',
    preco: 0,
  },
  dash: {
    id: 'dash',
    nome: 'Dash',
    custo: 2,
    cooldown: 40,
    duracao: 0,
    desc: 'Avanca 6 celulas e limpa a corrupcao do caminho',
    preco: 0,
  },
  rebobinar: {
    id: 'rebobinar',
    nome: 'Rebobinar',
    custo: 8,
    cooldown: 200,
    duracao: 0,
    desc: 'Volta o jogo 2 segundos. Anti morte caro de proposito',
    preco: 900,
  },
  ima: {
    id: 'ima',
    nome: 'Ima',
    custo: 3,
    cooldown: 90,
    duracao: 24,
    desc: 'Puxa as frutas em raio 6 para a cabeca por 3 s',
    preco: 260,
  },
  onda: {
    id: 'onda',
    nome: 'Onda de Choque',
    custo: 5,
    cooldown: 120,
    duracao: 0,
    desc: 'Limpa a corrupcao em raio 5 e empurra o resto',
    preco: 420,
  },
  dilatacao: {
    id: 'dilatacao',
    nome: 'Dilatacao',
    custo: 4,
    cooldown: 140,
    duracao: 24,
    desc: 'O mundo roda a 35% da velocidade por 3 s',
    preco: 640,
  },
  semear: {
    id: 'semear',
    nome: 'Semear',
    custo: 3,
    cooldown: 110,
    duracao: 0,
    desc: 'Converte 3 segmentos da cauda em 3 frutas maduras',
    preco: 380,
  },
};

export const POWER_ORDER: PowerId[] = ['fase', 'dash', 'ima', 'semear', 'onda', 'dilatacao', 'rebobinar'];
export const POWERS_INICIAIS: PowerId[] = ['fase', 'dash'];

export type RelicId = 'casca' | 'metabolismo' | 'simbiose' | 'fome' | 'muda';

export interface RelicDef {
  id: RelicId;
  nome: string;
  desc: string;
  preco: number;
}

export const RELICS: Record<RelicId, RelicDef> = {
  casca: {
    id: 'casca',
    nome: 'Casca Dura',
    desc: 'Sobrevive a primeira colisao perdendo metade dos segmentos',
    preco: 520,
  },
  metabolismo: {
    id: 'metabolismo',
    nome: 'Metabolismo',
    desc: 'Poderes custam 1 segmento a menos, piso de 1',
    preco: 340,
  },
  simbiose: {
    id: 'simbiose',
    nome: 'Simbiose',
    desc: 'A corrupcao deixa moedas ao ser limpa',
    preco: 300,
  },
  fome: {
    id: 'fome',
    nome: 'Fome',
    desc: 'Multiplicador comeca em x2, mas o timer de combo e 30% menor',
    preco: 760,
  },
  muda: {
    id: 'muda',
    nome: 'Muda',
    desc: 'A cada 30 s os 2 segmentos mais antigos caem e viram moeda',
    preco: 1100,
  },
};

export const RELIC_ORDER: RelicId[] = ['metabolismo', 'simbiose', 'casca', 'fome', 'muda'];

export type ModeId = 'classico' | 'ouroboro' | 'diario' | 'fantasma' | 'aperto';

export interface ModeDef {
  id: ModeId;
  nome: string;
  desc: string;
  paredesMatam: boolean;
  poderesLigados: boolean;
  corrupcaoMata: boolean;
  corrupcaoRitmo: number; // ticks entre passos de espalhamento, 0 desliga
  apodrece: number; // ticks ate a fruta apodrecer
  encolhe: number; // ticks entre encolhimentos da arena, 0 desliga
  intensidade: boolean; // velocidade sobe com o tempo
}

export const MODES: Record<ModeId, ModeDef> = {
  classico: {
    id: 'classico',
    nome: 'Classico',
    desc: 'Paredes matam, corrupcao lenta, sem poderes. O jogo puro',
    paredesMatam: true,
    poderesLigados: false,
    corrupcaoMata: true,
    corrupcaoRitmo: 56,
    apodrece: 120,
    encolhe: 0,
    intensidade: false,
  },
  ouroboro: {
    id: 'ouroboro',
    nome: 'Ouroboro',
    desc: 'Tudo ligado, intensidade crescente em ondas',
    paredesMatam: true,
    poderesLigados: true,
    corrupcaoMata: false,
    corrupcaoRitmo: 26,
    apodrece: 64,
    encolhe: 0,
    intensidade: true,
  },
  diario: {
    id: 'diario',
    nome: 'Desafio Diario',
    desc: 'Semente do dia. Todo mundo joga o mesmo mapa',
    paredesMatam: true,
    poderesLigados: true,
    corrupcaoMata: false,
    corrupcaoRitmo: 26,
    apodrece: 64,
    encolhe: 0,
    intensidade: true,
  },
  fantasma: {
    id: 'fantasma',
    nome: 'Fantasma',
    desc: 'Sua melhor run corre junto como uma cobra translucida',
    paredesMatam: true,
    poderesLigados: true,
    corrupcaoMata: false,
    corrupcaoRitmo: 26,
    apodrece: 64,
    encolhe: 0,
    intensidade: true,
  },
  aperto: {
    id: 'aperto',
    nome: 'Aperto',
    desc: 'A arena encolhe uma linha a cada 20 s. Curto e brutal',
    paredesMatam: true,
    poderesLigados: true,
    corrupcaoMata: false,
    corrupcaoRitmo: 34,
    apodrece: 64,
    encolhe: 160,
    intensidade: true,
  },
};

export const MODE_ORDER: ModeId[] = ['ouroboro', 'classico', 'diario', 'fantasma', 'aperto'];

// Simulacao
export const GRID_DEFAULT = 28;
export const TPS_BASE = 8;
export const TPS_MAX = 16;
export const START_LENGTH = 4;
export const MIN_LENGTH = 2; // abaixo disso a cobra se apaga
export const INPUT_BUFFER_SIZE = 2;

// Combo
export const COMBO_MAX = 8;
export const COMBO_JANELA = 30; // ticks para manter o combo

// Ouroboro voluntario
export const OURO_SEGMENTOS = 3;
export const OURO_MOEDAS_POR_SEGMENTO = 8;

// Corrupcao
export const CORRUPCAO_CUSTO = 2; // segmentos pagos ao atravessar
export const CORRUPCAO_TETO = 160; // celulas corrompidas no maximo

// Frutas
export const MADURA_APOS = 24; // ticks parada ate amadurecer
export const MIN_FRUITS = 1;
export const MAX_FRUITS = 3;

// Rebobinar
export const REWIND_SEGUNDOS = 2;
export const HISTORY_TICKS = 64; // cobre 2 s ate 16 tps com folga
