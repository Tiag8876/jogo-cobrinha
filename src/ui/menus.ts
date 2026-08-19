import type { SaveData } from '../meta/save';
import type { ModeId } from '../core/config';
import { MODES, MODE_ORDER, POWERS } from '../core/config';
import { listarSkins, listarPoderes, listarReliquias, comprar, equipar } from '../meta/shop';
import type { ShopItem } from '../meta/shop';
import { sfxUi, sfxCompra } from '../audio/synth';
import { drawIcone } from './hud';
import { drawSkinPreview, drawRelicIcon } from './preview';
import { skinById } from '../render/skins/defs';
import type { PowerId, RelicId } from '../core/config';

// Menus em DOM: acessiveis por teclado e leitor de tela, e mais leves
// que redesenhar tudo em canvas. Zero framework.

const CSS = `
.ouro-ui{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(12,10,8,0.9);color:#E2DAC8;z-index:10;
  font:400 16px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));
  box-sizing:border-box;overflow:auto;overscroll-behavior:contain}
.ouro-box{width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;gap:14px}
.ouro-titulo{font-size:clamp(34px,11vw,64px);font-weight:800;letter-spacing:.16em;margin:0;line-height:1}
.ouro-sub{opacity:.6;margin:0;font-size:13px;letter-spacing:.08em}
.ouro-lista{display:flex;flex-direction:column;gap:8px}
.ouro-btn{display:block;width:100%;text-align:left;background:rgba(226,218,200,.06);
  border:1px solid rgba(226,218,200,.14);color:inherit;font:inherit;padding:12px 14px;
  border-radius:3px;cursor:pointer;transition:background .12s,transform .12s}
.ouro-btn:hover,.ouro-btn:focus-visible{background:rgba(217,164,65,.18);outline:2px solid #D9A441;outline-offset:-2px}
.ouro-btn:active{transform:translateY(1px)}
.ouro-btn[aria-pressed=true]{border-color:#D9A441;background:rgba(217,164,65,.14)}
.ouro-btn b{display:block;font-size:17px;letter-spacing:.06em}
.ouro-btn span{display:block;opacity:.62;font-size:12.5px;margin-top:3px}
.ouro-linha{display:flex;gap:8px;flex-wrap:wrap}
.ouro-linha .ouro-btn{width:auto;flex:1;text-align:center;min-width:96px}
.ouro-abas{display:flex;gap:6px}
.ouro-moedas{font-size:14px;letter-spacing:.1em;opacity:.85}
.ouro-caro{opacity:.42}
.ouro-tag{float:right;font-size:11px;letter-spacing:.1em;opacity:.75}
.ouro-grande{font-size:clamp(40px,14vw,72px);font-weight:800;line-height:1;margin:0}
.ouro-tab{display:flex;justify-content:space-between;font-size:13px;opacity:.8;
  border-bottom:1px solid rgba(226,218,200,.1);padding:4px 0}
.ouro-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.ouro-card{display:flex;flex-direction:column;gap:6px;align-items:stretch;padding:10px}
.ouro-card canvas{width:100%;height:56px;display:block;border-radius:2px;
  background:radial-gradient(circle at 50% 40%,rgba(226,218,200,.05),rgba(0,0,0,.25))}
.ouro-card b{font-size:14.5px}
.ouro-card span{font-size:11.5px;line-height:1.35;min-height:2.7em}
.ouro-rodape-card{display:flex;justify-content:space-between;align-items:center;font-size:12px}
.ouro-preco{display:inline-flex;align-items:center;gap:5px;letter-spacing:.04em}
.ouro-preco i{width:9px;height:9px;border-radius:50%;background:#D9A441;
  box-shadow:0 0 5px rgba(217,164,65,.7);font-style:normal}
.ouro-rar{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.9}
.ouro-rar-comum{color:#9C9484}.ouro-rar-incomum{color:#8FBF5A}
.ouro-rar-raro{color:#6EA8FF}.ouro-rar-lendario{color:#D9A441}
.ouro-equipado{color:#D9A441}
.ouro-continuar{border-color:#D9A441;background:rgba(217,164,65,.1)}
.ouro-dpad{position:fixed;left:calc(10px + env(safe-area-inset-left));
  bottom:calc(10px + env(safe-area-inset-bottom));width:150px;height:150px;z-index:5;opacity:.5}
.ouro-dbtn{position:absolute;width:50px;height:50px;background:rgba(226,218,200,.12);
  border:1px solid rgba(226,218,200,.2);border-radius:4px;padding:0}
.ouro-d-cima{left:50px;top:0}.ouro-d-esq{left:0;top:50px}
.ouro-d-dir{left:100px;top:50px}.ouro-d-baixo{left:50px;top:100px}
@media (prefers-reduced-motion:reduce){.ouro-btn{transition:none}}
`;

let cssInjetado = false;
function injectCss(): void {
  if (cssInjetado) return;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  cssInjetado = true;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, txt?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt) e.textContent = txt;
  return e;
}

function botao(titulo: string, desc: string, onClick: () => void, marcado?: boolean): HTMLButtonElement {
  const b = el('button', 'ouro-btn');
  const t = el('b', undefined, titulo);
  b.appendChild(t);
  if (desc) b.appendChild(el('span', undefined, desc));
  if (marcado !== undefined) b.setAttribute('aria-pressed', String(marcado));
  b.addEventListener('click', () => {
    sfxUi(true);
    onClick();
  });
  return b;
}

export interface UIHandlers {
  jogar(mode: ModeId): void;
  retomar(): void;
  sair(): void;
  temRunSalva(): boolean;
  retomarRun(): void;
  mudouSave(): void;
}

export type Tela = 'menu' | 'loja' | 'opcoes' | 'pausa' | 'fim' | 'nenhuma';

export class UI {
  private root: HTMLElement;
  private save: SaveData;
  private h: UIHandlers;
  private tela: Tela = 'nenhuma';
  private aba: 'skin' | 'poder' | 'reliquia' = 'skin';
  private ultimoResultado = { score: 0, moedas: 0, recorde: false, causa: '', mode: 'ouroboro' as ModeId };

  constructor(save: SaveData, h: UIHandlers) {
    injectCss();
    this.save = save;
    this.h = h;
    this.root = el('div', 'ouro-ui');
    this.root.style.display = 'none';
    document.body.appendChild(this.root);
  }

  get aberta(): boolean {
    return this.tela !== 'nenhuma';
  }

  // Uma unica raiz, recriada por tela: nenhum listener sobrevive a troca.
  private limpar(): void {
    this.root.textContent = '';
  }

  esconder(): void {
    this.tela = 'nenhuma';
    this.limpar();
    this.root.style.display = 'none';
  }

  private abrir(): HTMLElement {
    this.limpar();
    this.root.style.display = 'flex';
    const box = el('div', 'ouro-box');
    this.root.appendChild(box);
    return box;
  }

  menu(): void {
    this.tela = 'menu';
    const box = this.abrir();
    box.appendChild(el('h1', 'ouro-titulo', 'OUROBORO'));
    box.appendChild(el('p', 'ouro-sub', 'o corpo e a sua energia. gastar salva agora e empobrece depois'));
    box.appendChild(el('p', 'ouro-moedas', `${this.save.coins} moedas`));

    const lista = el('div', 'ouro-lista');
    if (this.h.temRunSalva()) {
      const b = botao('Continuar run', 'sua partida foi guardada onde parou', () => this.h.retomarRun());
      b.classList.add('ouro-continuar');
      lista.appendChild(b);
    }
    for (const id of MODE_ORDER) {
      const m = MODES[id];
      const rec = this.save.recordes[id];
      const desc = rec ? `${m.desc}. recorde ${rec}` : m.desc;
      lista.appendChild(botao(m.nome, desc, () => this.h.jogar(id)));
    }
    box.appendChild(lista);

    const linha = el('div', 'ouro-linha');
    linha.appendChild(botao('Loja', '', () => this.loja()));
    linha.appendChild(botao('Opcoes', '', () => this.opcoes()));
    box.appendChild(linha);

    if (this.save.diario.length > 0) {
      const hist = el('div');
      hist.appendChild(el('p', 'ouro-sub', 'diario, ultimos dias'));
      for (const d of this.save.diario.slice(0, 5)) {
        const l = el('div', 'ouro-tab');
        l.appendChild(el('span', undefined, d.data));
        l.appendChild(el('span', undefined, String(d.score)));
        hist.appendChild(l);
      }
      box.appendChild(hist);
    }

    const dica = el('p', 'ouro-sub');
    dica.textContent = 'setas ou wasd movem. 1 2 3 usam poderes. espaco devora a cauda';
    box.appendChild(dica);
  }

  loja(): void {
    this.tela = 'loja';
    const box = this.abrir();
    box.appendChild(el('h2', 'ouro-titulo', 'LOJA'));
    box.appendChild(el('p', 'ouro-moedas', `${this.save.coins} moedas`));

    const abas = el('div', 'ouro-abas');
    const mk = (nome: string, id: 'skin' | 'poder' | 'reliquia'): void => {
      const b = botao(nome, '', () => {
        this.aba = id;
        this.loja();
      }, this.aba === id);
      b.style.textAlign = 'center';
      abas.appendChild(b);
    };
    mk('Skins', 'skin');
    mk('Poderes', 'poder');
    mk('Reliquias', 'reliquia');
    box.appendChild(abas);

    if (this.aba === 'skin') {
      box.appendChild(el('p', 'ouro-sub', 'skin nunca da vantagem. toda vantagem mora nas reliquias'));
    } else if (this.aba === 'poder') {
      box.appendChild(el('p', 'ouro-sub', `equipe ate 3. equipados: ${this.save.loadout.length}/3`));
    } else {
      box.appendChild(el('p', 'ouro-sub', `alteram as regras. equipe ate 2. equipadas: ${this.save.reliquiasEquipadas.length}/2`));
    }

    const itens: ShopItem[] =
      this.aba === 'skin' ? listarSkins(this.save) : this.aba === 'poder' ? listarPoderes(this.save) : listarReliquias(this.save);

    const lista = el('div', 'ouro-lista ouro-grid');
    for (const it of itens) {
      lista.appendChild(this.cardLoja(it));
    }
    box.appendChild(lista);
    box.appendChild(botao('Voltar', '', () => this.menu()));
  }

  // Card da loja: previa desenhada em canvas, nome, raridade, descricao
  // e preco. A previa das skins e a mesma cobra do jogo em miniatura, e
  // a dos poderes e o mesmo icone do rodape do HUD.
  private cardLoja(it: ShopItem): HTMLButtonElement {
    const b = el('button', 'ouro-btn ouro-card');
    b.setAttribute('aria-pressed', String(it.equipado));

    const cv = document.createElement('canvas');
    cv.width = 168;
    cv.height = 56;
    if (it.tipo === 'skin') {
      drawSkinPreview(cv, skinById(it.id));
    } else if (it.tipo === 'poder') {
      const c2 = cv.getContext('2d');
      if (c2) drawIcone(c2, it.id as PowerId, cv.width / 2, cv.height / 2, 16, '#E2DAC8');
    } else {
      drawRelicIcon(cv, it.id as RelicId, '#C9A2E8');
    }
    b.appendChild(cv);

    const titulo = el('b', undefined, it.nome);
    if (it.tipo === 'skin') {
      const rar = skinById(it.id).raridade;
      const tag = el('i', `ouro-tag ouro-rar ouro-rar-${rar}`, rar);
      titulo.appendChild(tag);
    }
    b.appendChild(titulo);
    b.appendChild(el('span', undefined, it.desc));

    const rodape = el('div', 'ouro-rodape-card');
    if (it.comprado) {
      rodape.appendChild(el('em', it.equipado ? 'ouro-equipado' : undefined, it.equipado ? 'equipado' : 'equipar'));
    } else {
      const preco = el('em', 'ouro-preco');
      preco.appendChild(el('i'));
      preco.appendChild(document.createTextNode(String(it.preco)));
      rodape.appendChild(preco);
    }
    b.appendChild(rodape);

    if (!it.comprado && this.save.coins < it.preco) b.classList.add('ouro-caro');

    b.addEventListener('click', () => {
      if (it.comprado) {
        equipar(this.save, it);
        sfxUi(true);
      } else {
        const r = comprar(this.save, it);
        if (r === 'ok') {
          sfxCompra();
          // O item recem comprado ja entra equipado, senao o jogador
          // paga e nada muda na proxima run.
          it.comprado = true;
          equipar(this.save, it);
        } else {
          sfxUi(false);
        }
      }
      this.h.mudouSave();
      this.loja();
    });
    return b;
  }

  opcoes(): void {
    this.tela = 'opcoes';
    const box = this.abrir();
    box.appendChild(el('h2', 'ouro-titulo', 'OPCOES'));
    const o = this.save.opcoes;
    const lista = el('div', 'ouro-lista');

    const toggle = (nome: string, desc: string, get: () => boolean, set: (v: boolean) => void): void => {
      lista.appendChild(
        botao(nome, desc, () => {
          set(!get());
          this.h.mudouSave();
          this.opcoes();
        }, get()),
      );
    };

    toggle('Screen shake', 'tremor de tela nos impactos', () => o.shake, (v) => (o.shake = v));
    toggle('Grao de filme', 'textura sutil por cima de tudo', () => o.grao, (v) => (o.grao = v));
    toggle('Reduzir movimento', 'sem zoom, sem tremor, sem particulas', () => o.reduzirMovimento, (v) => (o.reduzirMovimento = v));
    toggle('Alto contraste', 'fundo preto e traco mais forte', () => o.altoContraste, (v) => (o.altoContraste = v));
    toggle('Audio', 'sons e trilha sintetizados', () => o.audio, (v) => (o.audio = v));
    toggle('D-pad na tela', 'botoes de direcao no toque', () => o.dpad, (v) => (o.dpad = v));

    const dalts = ['nenhum', 'protanopia', 'deuteranopia', 'tritanopia'] as const;
    for (const d of dalts) {
      lista.appendChild(
        botao(`Paleta: ${d}`, '', () => {
          o.daltonismo = d;
          this.h.mudouSave();
          this.opcoes();
        }, o.daltonismo === d),
      );
    }
    box.appendChild(lista);
    box.appendChild(botao('Voltar', '', () => this.menu()));
  }

  pausa(): void {
    this.tela = 'pausa';
    const box = this.abrir();
    box.appendChild(el('h2', 'ouro-titulo', 'PAUSA'));
    const lista = el('div', 'ouro-lista');
    lista.appendChild(botao('Continuar', '', () => this.h.retomar()));
    lista.appendChild(botao('Opcoes', '', () => this.opcoes()));
    lista.appendChild(botao('Sair da run', 'as moedas ganhas ficam', () => this.h.sair()));
    box.appendChild(lista);
    box.appendChild(this.tabelaPoderes());
  }

  private tabelaPoderes(): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(el('p', 'ouro-sub', 'poderes equipados'));
    for (let i = 0; i < this.save.loadout.length; i++) {
      const p = POWERS[this.save.loadout[i]];
      const l = el('div', 'ouro-tab');
      l.appendChild(el('span', undefined, `${i + 1}. ${p.nome} (-${p.custo})`));
      l.appendChild(el('span', undefined, p.desc));
      wrap.appendChild(l);
    }
    return wrap;
  }

  fim(score: number, moedas: number, recorde: boolean, causa: string, mode: ModeId): void {
    this.tela = 'fim';
    this.ultimoResultado = { score, moedas, recorde, causa, mode };
    const box = this.abrir();
    box.appendChild(el('p', 'ouro-sub', recorde ? 'novo recorde' : `fim por ${causa}`));
    box.appendChild(el('h2', 'ouro-grande', String(score)));
    box.appendChild(el('p', 'ouro-moedas', `+${moedas} moedas, total ${this.save.coins}`));
    const lista = el('div', 'ouro-lista');
    lista.appendChild(botao('De novo', '', () => this.h.jogar(this.ultimoResultado.mode)));
    lista.appendChild(botao('Loja', '', () => this.loja()));
    lista.appendChild(botao('Menu', '', () => this.menu()));
    box.appendChild(lista);
  }

  atualizarSave(s: SaveData): void {
    this.save = s;
  }
}
