import type { DeathCause } from '../core/state';
import type { Forma, Rastro, Olho, Raridade } from '../render/skins/types';

// Rotulos em portugues do Brasil. Os identificadores internos ficam sem
// acento para nao virarem chave fragil; a traducao para a tela mora aqui.

export const RARIDADE: Record<Raridade, string> = {
  comum: 'comum',
  incomum: 'incomum',
  raro: 'raro',
  lendario: 'lendário',
};

export const FORMA: Record<Forma, string> = {
  circulo: 'círculo',
  vertebra: 'vértebra',
  bloco: 'bloco',
  faceta: 'faceta',
  particula: 'partícula',
  fita: 'fita',
  vidro: 'vidro',
  pilula: 'pílula',
};

export const RASTRO: Record<Rastro, string> = {
  nenhum: 'nenhum',
  poeira: 'poeira',
  brasa: 'brasa',
  pulso: 'pulso',
  caco: 'cacos',
  papel: 'papel',
  sombra: 'sombra',
  cardume: 'cardume',
  faisca: 'faísca',
  tinta: 'tinta',
};

export const OLHO: Record<Olho, string> = {
  ponto: 'ponto',
  fenda: 'fenda',
  led: 'led',
  vazio: 'vazio',
  cruz: 'cruz',
  anel: 'anel',
};

// Frase que aparece na tela de fim, ja com a preposicao certa.
export function causaTexto(c: DeathCause | 'desistencia'): string {
  switch (c) {
    case 'parede':
      return 'batida na parede';
    case 'corpo':
      return 'mordida no próprio corpo';
    case 'corrupcao':
      return 'contato com a corrupção';
    case 'fome':
      return 'energia esgotada';
    case 'desistencia':
      return 'desistência';
    default:
      return 'fim de partida';
  }
}
