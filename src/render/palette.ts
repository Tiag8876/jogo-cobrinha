export type Daltonismo = 'nenhum' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface Paleta {
  fundo: string;
  grade: string;
  osso: string;
  corrupcao: string;
  corrupcaoEscura: string;
  fruta: string;
  frutaMadura: string;
  frutaAmarga: string;
  frutaEspelho: string;
  perigo: string;
  parede: string;
}

const BASE: Paleta = {
  fundo: '#16130F',
  grade: 'rgba(226,218,200,0.06)',
  osso: '#E2DAC8',
  corrupcao: '#7A4BA8',
  corrupcaoEscura: '#2E1B47',
  fruta: '#C94F3D',
  frutaMadura: '#E8A33D',
  frutaAmarga: '#8E5BD0',
  frutaEspelho: '#5FC9D8',
  perigo: '#E8615A',
  parede: 'rgba(226,218,200,0.22)',
};

// Ajustes por tipo de daltonismo: separa os pares que colidem em cada caso.
const VARIANTES: Record<Daltonismo, Partial<Paleta>> = {
  nenhum: {},
  protanopia: {
    fruta: '#3D8BD4',
    frutaMadura: '#E8C13D',
    corrupcao: '#8C7BD8',
    perigo: '#4FA8E8',
  },
  deuteranopia: {
    fruta: '#4B7BE0',
    frutaMadura: '#E0B23D',
    corrupcao: '#9A6BD8',
    perigo: '#6FA0F0',
  },
  tritanopia: {
    fruta: '#D64A6A',
    frutaMadura: '#E88A3D',
    frutaEspelho: '#66C2A5',
    corrupcao: '#B04FA0',
    perigo: '#E85A8A',
  },
};

const ALTO_CONTRASTE: Partial<Paleta> = {
  fundo: '#000000',
  grade: 'rgba(255,255,255,0.16)',
  osso: '#FFFFFF',
  corrupcao: '#C070FF',
  corrupcaoEscura: '#3A0A5A',
  parede: 'rgba(255,255,255,0.5)',
};

export function buildPaleta(dalt: Daltonismo, altoContraste: boolean): Paleta {
  return {
    ...BASE,
    ...VARIANTES[dalt],
    ...(altoContraste ? ALTO_CONTRASTE : {}),
  };
}
