import type { PowerId, RelicId, ModeId } from '../core/config';
import { POWERS_INICIAIS } from '../core/config';
import type { Daltonismo } from '../render/palette';

// localStorage com versionamento de schema e migracao. Um save antigo
// nunca pode quebrar o jogo: se nao der para migrar, cai no padrao.

export const SAVE_KEY = 'ouroboro.save';
export const SAVE_VERSION = 2;

export interface Opcoes {
  shake: boolean;
  grao: boolean;
  reduzirMovimento: boolean;
  altoContraste: boolean;
  daltonismo: Daltonismo;
  audio: boolean;
  volume: number;
  dpad: boolean;
}

export interface GhostData {
  mode: ModeId;
  seed: number;
  inputs: number[]; // pares [tick, codigo]
  score: number;
  powers: PowerId[];
  relics: RelicId[];
}

export interface DiarioEntry {
  data: string; // AAAA-MM-DD
  score: number;
}

export interface SaveData {
  v: number;
  coins: number;
  skinsDesbloqueadas: string[];
  skinEquipada: string;
  poderesDesbloqueados: PowerId[];
  loadout: PowerId[];
  reliquias: RelicId[];
  reliquiasEquipadas: RelicId[];
  recordes: Partial<Record<ModeId, number>>;
  diario: DiarioEntry[];
  ghost: GhostData | null;
  opcoes: Opcoes;
}

export function saveDefault(): SaveData {
  return {
    v: SAVE_VERSION,
    coins: 0,
    skinsDesbloqueadas: ['osso', 'brasa'],
    skinEquipada: 'osso',
    poderesDesbloqueados: POWERS_INICIAIS.slice(),
    loadout: POWERS_INICIAIS.slice(),
    reliquias: [],
    reliquiasEquipadas: [],
    recordes: {},
    diario: [],
    ghost: null,
    opcoes: {
      shake: true,
      grao: true,
      reduzirMovimento: false,
      altoContraste: false,
      daltonismo: 'nenhum',
      audio: true,
      volume: 0.7,
      dpad: false,
    },
  };
}

type Desconhecido = Record<string, unknown>;

function arrStr(v: unknown, fallback: string[]): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

// Migra qualquer save conhecido para o schema atual. Nunca lanca.
export function migrate(raw: unknown): SaveData {
  const def = saveDefault();
  if (!raw || typeof raw !== 'object') return def;
  const o = raw as Desconhecido;
  const versao = num(o.v ?? o.version, 1);

  // v1 guardava moedas em "money" e nao tinha reliquias nem diario.
  const coins = num(o.coins ?? o.money, 0);
  const opcoesRaw = (o.opcoes ?? o.options ?? {}) as Desconhecido;
  const dalt = opcoesRaw.daltonismo;

  const out: SaveData = {
    v: SAVE_VERSION,
    coins,
    skinsDesbloqueadas: arrStr(o.skinsDesbloqueadas ?? o.skins, def.skinsDesbloqueadas),
    skinEquipada: typeof (o.skinEquipada ?? o.skin) === 'string' ? String(o.skinEquipada ?? o.skin) : def.skinEquipada,
    poderesDesbloqueados: arrStr(o.poderesDesbloqueados ?? o.powers, def.poderesDesbloqueados) as PowerId[],
    loadout: arrStr(o.loadout, def.loadout) as PowerId[],
    reliquias: arrStr(o.reliquias ?? o.relics, []) as RelicId[],
    reliquiasEquipadas: arrStr(o.reliquiasEquipadas, []) as RelicId[],
    recordes: (o.recordes ?? o.best ?? {}) as Partial<Record<ModeId, number>>,
    diario: Array.isArray(o.diario) ? (o.diario as DiarioEntry[]).slice(0, 30) : [],
    ghost: (o.ghost as GhostData | null) ?? null,
    opcoes: {
      shake: bool(opcoesRaw.shake, def.opcoes.shake),
      grao: bool(opcoesRaw.grao, def.opcoes.grao),
      reduzirMovimento: bool(opcoesRaw.reduzirMovimento, def.opcoes.reduzirMovimento),
      altoContraste: bool(opcoesRaw.altoContraste, def.opcoes.altoContraste),
      daltonismo:
        dalt === 'protanopia' || dalt === 'deuteranopia' || dalt === 'tritanopia' ? dalt : 'nenhum',
      audio: bool(opcoesRaw.audio, def.opcoes.audio),
      volume: Math.max(0, Math.min(1, num(opcoesRaw.volume, def.opcoes.volume))),
      dpad: bool(opcoesRaw.dpad, def.opcoes.dpad),
    },
  };

  // Garantias de integridade que valem para qualquer versao.
  if (out.skinsDesbloqueadas.indexOf('osso') < 0) out.skinsDesbloqueadas.push('osso');
  if (out.skinsDesbloqueadas.indexOf(out.skinEquipada) < 0) out.skinEquipada = 'osso';
  for (const p of POWERS_INICIAIS) {
    if (out.poderesDesbloqueados.indexOf(p) < 0) out.poderesDesbloqueados.push(p);
  }
  out.loadout = out.loadout.filter((p) => out.poderesDesbloqueados.indexOf(p) >= 0).slice(0, 3);
  if (out.loadout.length === 0) out.loadout = POWERS_INICIAIS.slice(0, 3);
  out.reliquiasEquipadas = out.reliquiasEquipadas.filter((r) => out.reliquias.indexOf(r) >= 0).slice(0, 2);
  if (versao > SAVE_VERSION) return def; // save do futuro: nao arrisca
  return out;
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return saveDefault();
    return migrate(JSON.parse(raw));
  } catch {
    return saveDefault();
  }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Modo privado do Safari pode recusar. O jogo continua rodando.
  }
}
