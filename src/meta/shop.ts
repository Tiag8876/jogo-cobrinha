import type { SaveData } from './save';
import type { PowerId, RelicId } from '../core/config';
import { POWERS, RELICS } from '../core/config';
import { SKINS, skinById } from '../render/skins/defs';

// Regra dura: skin nunca da vantagem. Toda vantagem mora nas Reliquias.

export type ItemTipo = 'skin' | 'poder' | 'reliquia';

export interface ShopItem {
  tipo: ItemTipo;
  id: string;
  nome: string;
  desc: string;
  preco: number;
  comprado: boolean;
  equipado: boolean;
}

export function listarSkins(s: SaveData): ShopItem[] {
  return SKINS.map((sk) => ({
    tipo: 'skin' as const,
    id: sk.id,
    nome: sk.nome,
    desc: `forma ${sk.forma}, rastro ${sk.rastro}, olho ${sk.olho}. Sem efeito no jogo`,
    preco: sk.preco,
    comprado: s.skinsDesbloqueadas.indexOf(sk.id) >= 0,
    equipado: s.skinEquipada === sk.id,
  }));
}

export function listarPoderes(s: SaveData): ShopItem[] {
  return (Object.keys(POWERS) as PowerId[]).map((id) => {
    const p = POWERS[id];
    return {
      tipo: 'poder' as const,
      id,
      nome: p.nome,
      desc: `${p.desc}. Custo ${p.custo} segmentos`,
      preco: p.preco,
      comprado: s.poderesDesbloqueados.indexOf(id) >= 0,
      equipado: s.loadout.indexOf(id) >= 0,
    };
  });
}

export function listarReliquias(s: SaveData): ShopItem[] {
  return (Object.keys(RELICS) as RelicId[]).map((id) => {
    const r = RELICS[id];
    return {
      tipo: 'reliquia' as const,
      id,
      nome: r.nome,
      desc: r.desc,
      preco: r.preco,
      comprado: s.reliquias.indexOf(id) >= 0,
      equipado: s.reliquiasEquipadas.indexOf(id) >= 0,
    };
  });
}

export type CompraResultado = 'ok' | 'sem_moedas' | 'ja_tem';

export function comprar(s: SaveData, item: ShopItem): CompraResultado {
  if (item.comprado) return 'ja_tem';
  if (s.coins < item.preco) return 'sem_moedas';
  s.coins -= item.preco;
  if (item.tipo === 'skin') s.skinsDesbloqueadas.push(item.id);
  else if (item.tipo === 'poder') s.poderesDesbloqueados.push(item.id as PowerId);
  else s.reliquias.push(item.id as RelicId);
  return 'ok';
}

// Equipar alterna. Poderes tem teto de 3, reliquias teto de 2.
export function equipar(s: SaveData, item: ShopItem): void {
  if (!item.comprado) return;
  if (item.tipo === 'skin') {
    s.skinEquipada = item.id;
    return;
  }
  if (item.tipo === 'poder') {
    const id = item.id as PowerId;
    const i = s.loadout.indexOf(id);
    if (i >= 0) s.loadout.splice(i, 1);
    else if (s.loadout.length < 3) s.loadout.push(id);
    else {
      s.loadout.shift();
      s.loadout.push(id);
    }
    return;
  }
  const id = item.id as RelicId;
  const i = s.reliquiasEquipadas.indexOf(id);
  if (i >= 0) s.reliquiasEquipadas.splice(i, 1);
  else if (s.reliquiasEquipadas.length < 2) s.reliquiasEquipadas.push(id);
  else {
    s.reliquiasEquipadas.shift();
    s.reliquiasEquipadas.push(id);
  }
}

export function skinAtual(s: SaveData) {
  return skinById(s.skinEquipada);
}
