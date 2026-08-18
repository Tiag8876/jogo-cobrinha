// Definicao de skin, lida pelo renderer. Adicionar skin nova nao pode
// exigir mexer no motor: basta acrescentar um objeto em defs.ts.

export type Forma = 'circulo' | 'vertebra' | 'bloco' | 'faceta' | 'particula' | 'fita' | 'vidro' | 'pilula';
export type Rastro = 'nenhum' | 'poeira' | 'brasa' | 'pulso' | 'caco' | 'papel' | 'sombra' | 'cardume' | 'faisca' | 'tinta';
export type Olho = 'ponto' | 'fenda' | 'led' | 'vazio' | 'cruz' | 'anel';
export type Raridade = 'comum' | 'incomum' | 'raro' | 'lendario';

export interface SkinDef {
  id: string;
  nome: string;
  raridade: Raridade;
  preco: number;
  acento: string; // cor de acento da skin, usada com avareza
  cabeca: string;
  cauda: string;
  forma: Forma;
  rastro: Rastro;
  olho: Olho;
  contorno: string | null;
  // Pulso de luz percorrendo o corpo, 0 desliga.
  pulso: number;
  // Espessura da espinha que liga os segmentos, 0 deixa o corpo solto.
  espinha: number;
  // Som da mordida: frequencia base e timbre.
  mordida: { freq: number; tipo: OscillatorType; ruido: number };
}
