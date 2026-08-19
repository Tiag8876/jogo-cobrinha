import type { SaveData } from '../meta/save';
import type { ModeId } from '../core/config';
import { MODES, MODE_ORDER, POWERS, RELICS, OURO_SEGMENTOS } from '../core/config';
import { listarSkins, listarPoderes, listarReliquias, comprar, equipar } from '../meta/shop';
import type { ShopItem } from '../meta/shop';
import { sfxUi, sfxCompra } from '../audio/synth';
import { drawIcone } from './hud';
import { drawSkinPreview, drawRelicIcon, drawModeIcon } from './preview';
import { skinById } from '../render/skins/defs';
import { RARIDADE, causaTexto } from './textos';
import type { PowerId, RelicId } from '../core/config';

// Menus em DOM: acessiveis por teclado e leitor de tela, e mais leves
// que redesenhar tudo em canvas. Zero framework.

const CSS = `
.ouro-ui{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(12,10,8,0.9);color:#E2DAC8;z-index:10;
  font:400 16px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  padding:calc(12px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right))
    calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));
  box-sizing:border-box;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;
  touch-action:pan-y;-webkit-overflow-scrolling:touch}
.ouro-box{width:min(560px,100%);display:flex;flex-direction:column;gap:14px;margin:auto 0}
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
.ouro-tab{display:flex;justify-content:space-between;gap:12px;font-size:13px;opacity:.8;
  border-bottom:1px solid rgba(226,218,200,.1);padding:4px 0}
.ouro-tab span{min-width:0}
.ouro-item{display:flex;gap:9px;align-items:flex-start;padding:6px 0;
  border-bottom:1px solid rgba(226,218,200,.1)}
.ouro-item-n{flex:none;width:20px;height:20px;border-radius:3px;font-size:11.5px;font-weight:700;
  display:flex;align-items:center;justify-content:center;
  border:1px solid rgba(226,218,200,.24);background:rgba(226,218,200,.06)}
.ouro-item-txt{min-width:0;flex:1}
.ouro-item-txt b{display:block;font-size:13.5px;letter-spacing:.04em}
.ouro-item-txt span{display:block;font-size:11.5px;opacity:.6;margin-top:2px;line-height:1.35}
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
.ouro-continuar{border-color:#D9A441;background:rgba(217,164,65,.14)}
.ouro-ui{background:radial-gradient(ellipse at 50% 42%,rgba(12,10,8,.62) 0%,rgba(12,10,8,.88) 55%,rgba(12,10,8,.97) 100%)}
.ouro-box>*{position:relative}
.ouro-marca,.ouro-chips,.ouro-teclas,.ouro-tab,.ouro-sub{text-shadow:0 1px 10px rgba(12,10,8,.95)}
.ouro-marca{display:flex;align-items:center;gap:14px}
.ouro-marca canvas{width:64px;height:64px;flex:none}
.ouro-marca h1{margin:0}
.ouro-lema{opacity:.55;margin:2px 0 0;font-size:12.5px;letter-spacing:.06em;line-height:1.35}
.ouro-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ouro-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;
  border:1px solid rgba(226,218,200,.16);background:rgba(226,218,200,.05);font-size:12px;letter-spacing:.04em}
.ouro-chip canvas{width:34px;height:16px;display:block}
.ouro-chip b{font-weight:700;letter-spacing:.06em}
.ouro-chip-moeda i{width:9px;height:9px;border-radius:50%;background:#D9A441;
  box-shadow:0 0 6px rgba(217,164,65,.75);font-style:normal;display:inline-block}
.ouro-modo{display:flex;align-items:center;gap:12px;padding:11px 13px}
.ouro-modo canvas{width:40px;height:40px;flex:none;opacity:.9}
.ouro-modo-txt{flex:1;min-width:0}
.ouro-modo-txt b{display:block;font-size:16.5px;letter-spacing:.06em}
.ouro-modo-txt span{display:block;opacity:.6;font-size:12px;margin-top:2px}
.ouro-rec{font-size:11px;letter-spacing:.1em;opacity:.85;text-align:right;flex:none;color:#D9A441}
.ouro-teclas{display:flex;gap:6px 14px;flex-wrap:wrap;font-size:11.5px;opacity:.6}
.ouro-par{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.ouro-tecla{border:1px solid rgba(226,218,200,.24);border-radius:3px;padding:2px 6px;letter-spacing:.06em}
.ouro-destaque{border-color:rgba(217,164,65,.55);background:rgba(217,164,65,.09)}
.ouro-dpad{position:fixed;left:calc(8px + env(safe-area-inset-left));
  bottom:calc(8px + env(safe-area-inset-bottom));z-index:5;opacity:.42;touch-action:none}
.ouro-dbtn{position:absolute;background:rgba(226,218,200,.14);
  border:1px solid rgba(226,218,200,.22);border-radius:6px;padding:0;touch-action:none}
.ouro-dbtn:active{background:rgba(217,164,65,.3)}
@media (prefers-reduced-motion:reduce){.ouro-btn{transition:none}}
/* Celular deitado: pouca altura, entao tudo encolhe e a grade da loja
   usa colunas mais estreitas para caber sem rolagem infinita. */
@media (max-height:480px){
  .ouro-ui{font-size:14px;padding-top:calc(8px + env(safe-area-inset-top));
    padding-bottom:calc(8px + env(safe-area-inset-bottom))}
  .ouro-box{gap:9px}
  .ouro-titulo{font-size:clamp(24px,7vw,40px)}
  .ouro-marca canvas{width:44px;height:44px}
  .ouro-btn{padding:9px 12px}
  .ouro-modo{padding:8px 11px;gap:9px}
  .ouro-modo canvas{width:30px;height:30px}
  .ouro-modo-txt b{font-size:14.5px}
  .ouro-modo-txt span{font-size:11px}
  .ouro-grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr))}
  .ouro-card canvas{height:42px}
  .ouro-lema,.ouro-teclas{display:none}
}
/* Tela bem estreita: uma coluna so na loja, para o card nao espremer. */
@media (max-width:340px){
  .ouro-grid{grid-template-columns:1fr}
  .ouro-linha .ouro-btn{min-width:0}
}
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

  // Redesenha a tela atual, para o conteudo acompanhar o giro do aparelho
  // e as previas em canvas nascerem na resolucao nova.
  reabrir(): void {
    switch (this.tela) {
      case 'menu':
        this.menu();
        break;
      case 'loja':
        this.loja();
        break;
      case 'opcoes':
        this.opcoes();
        break;
      case 'pausa':
        this.pausa();
        break;
      default:
        break;
    }
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

    // Marca: o anel do ouroboro desenhado ao lado do titulo.
    const marca = el('div', 'ouro-marca');
    const selo = document.createElement('canvas');
    selo.width = 128;
    selo.height = 128;
    drawModeIcon(selo, 'ouroboro', '#D9A441');
    marca.appendChild(selo);
    const textoMarca = el('div');
    textoMarca.appendChild(el('h1', 'ouro-titulo', 'OUROBORO'));
    textoMarca.appendChild(el('p', 'ouro-lema', 'O corpo é a sua energia. Gastar salva agora e empobrece depois.'));
    marca.appendChild(textoMarca);
    box.appendChild(marca);

    box.appendChild(this.chipsEstado());

    const lista = el('div', 'ouro-lista');
    if (this.h.temRunSalva()) {
      const b = botao('Continuar partida', 'sua partida foi guardada onde parou', () => this.h.retomarRun());
      b.classList.add('ouro-continuar');
      lista.appendChild(b);
    }
    for (const id of MODE_ORDER) {
      lista.appendChild(this.cardModo(id));
    }
    box.appendChild(lista);

    const linha = el('div', 'ouro-linha');
    linha.appendChild(botao('Loja', '', () => this.loja()));
    linha.appendChild(botao('Opções', '', () => this.opcoes()));
    box.appendChild(linha);

    if (this.save.diario.length > 0) {
      const hist = el('div');
      hist.appendChild(el('p', 'ouro-sub', 'DESAFIO DIÁRIO, ÚLTIMOS DIAS'));
      for (const d of this.save.diario.slice(0, 5)) {
        const l = el('div', 'ouro-tab');
        l.appendChild(el('span', undefined, d.data.split('-').reverse().join('/')));
        l.appendChild(el('span', undefined, `${d.score} pontos`));
        hist.appendChild(l);
      }
      box.appendChild(hist);
    }

    box.appendChild(this.legendaTeclas());
  }

  // Chips com o estado do jogador: moedas, skin equipada e loadout.
  private chipsEstado(): HTMLElement {
    const chips = el('div', 'ouro-chips');

    const moeda = el('div', 'ouro-chip ouro-chip-moeda');
    moeda.appendChild(el('i'));
    moeda.appendChild(el('b', undefined, String(this.save.coins)));
    moeda.appendChild(document.createTextNode('moedas'));
    chips.appendChild(moeda);

    const skin = skinById(this.save.skinEquipada);
    const chipSkin = el('div', 'ouro-chip');
    const cv = document.createElement('canvas');
    cv.width = 102;
    cv.height = 48;
    drawSkinPreview(cv, skin);
    chipSkin.appendChild(cv);
    chipSkin.appendChild(document.createTextNode(skin.nome));
    chips.appendChild(chipSkin);

    for (let i = 0; i < this.save.loadout.length; i++) {
      const p = POWERS[this.save.loadout[i]];
      const chip = el('div', 'ouro-chip');
      chip.appendChild(el('b', undefined, String(i + 1)));
      chip.appendChild(document.createTextNode(`${p.nome} -${p.custo}`));
      chips.appendChild(chip);
    }

    for (const r of this.save.reliquiasEquipadas) {
      const chip = el('div', 'ouro-chip');
      chip.appendChild(document.createTextNode(RELICS[r].nome));
      chips.appendChild(chip);
    }
    return chips;
  }

  private cardModo(id: ModeId): HTMLButtonElement {
    const m = MODES[id];
    const b = el('button', 'ouro-btn ouro-modo');
    if (id === 'ouroboro') b.classList.add('ouro-destaque');
    const cv = document.createElement('canvas');
    cv.width = 80;
    cv.height = 80;
    drawModeIcon(cv, id, '#E2DAC8');
    b.appendChild(cv);

    const txt = el('div', 'ouro-modo-txt');
    txt.appendChild(el('b', undefined, m.nome));
    txt.appendChild(el('span', undefined, m.desc));
    b.appendChild(txt);

    const rec = this.save.recordes[id];
    if (rec) b.appendChild(el('em', 'ouro-rec', `recorde\n${rec}`));

    b.addEventListener('click', () => {
      sfxUi(true);
      this.h.jogar(id);
    });
    return b;
  }

  private legendaTeclas(): HTMLElement {
    const wrap = el('div', 'ouro-teclas');
    const par = (tecla: string, oque: string): void => {
      const p = el('span', 'ouro-par');
      p.appendChild(el('span', 'ouro-tecla', tecla));
      p.appendChild(el('span', undefined, oque));
      wrap.appendChild(p);
    };
    par('setas ou WASD', 'mover');
    par('1 2 3', 'poderes');
    par('4 ou espaço', 'devorar a cauda');
    par('Esc', 'pausar');
    return wrap;
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
    mk('Relíquias', 'reliquia');
    box.appendChild(abas);

    if (this.aba === 'skin') {
      box.appendChild(el('p', 'ouro-sub', 'Skin nunca dá vantagem. Toda vantagem mora nas relíquias.'));
    } else if (this.aba === 'poder') {
      box.appendChild(el('p', 'ouro-sub', `Equipe até 3 poderes. Equipados: ${this.save.loadout.length}/3`));
    } else {
      box.appendChild(el('p', 'ouro-sub', `Alteram as regras. Equipe até 2. Equipadas: ${this.save.reliquiasEquipadas.length}/2`));
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
      const tag = el('i', `ouro-tag ouro-rar ouro-rar-${rar}`, RARIDADE[rar]);
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
    box.appendChild(el('h2', 'ouro-titulo', 'OPÇÕES'));
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

    toggle('Tremor de tela', 'a tela sacode nos impactos', () => o.shake, (v) => (o.shake = v));
    toggle('Grão de filme', 'textura sutil por cima de tudo', () => o.grao, (v) => (o.grao = v));
    toggle('Reduzir movimento', 'sem zoom, sem tremor, sem partículas', () => o.reduzirMovimento, (v) => (o.reduzirMovimento = v));
    toggle('Alto contraste', 'fundo preto e traço mais forte', () => o.altoContraste, (v) => (o.altoContraste = v));
    toggle('Áudio', 'sons e trilha sintetizados na hora', () => o.audio, (v) => (o.audio = v));
    toggle('Direcional na tela', 'botões de direção para jogar no toque', () => o.dpad, (v) => (o.dpad = v));

    const dalts = ['nenhum', 'protanopia', 'deuteranopia', 'tritanopia'] as const;
    for (const d of dalts) {
      lista.appendChild(
        botao(`Paleta: ${d === 'nenhum' ? 'padrão' : d}`, '', () => {
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
    lista.appendChild(botao('Opções', '', () => this.opcoes()));
    lista.appendChild(botao('Sair da partida', 'as moedas ganhas ficam com você', () => this.h.sair()));
    box.appendChild(lista);
    box.appendChild(this.tabelaPoderes());
    box.appendChild(this.legendaTeclas());
  }

  // Lista dos poderes equipados com o numero do atalho em destaque, para
  // o jogador aprender a tecla enquanto le o efeito.
  private tabelaPoderes(): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(el('p', 'ouro-sub', 'PODERES EQUIPADOS'));
    for (let i = 0; i < this.save.loadout.length; i++) {
      const p = POWERS[this.save.loadout[i]];
      wrap.appendChild(this.itemAtalho(String(i + 1), `${p.nome}, custa ${p.custo} segmentos`, p.desc));
    }
    wrap.appendChild(
      this.itemAtalho('4', `Ouroboro, custa ${OURO_SEGMENTOS} segmentos`, 'Devora a própria cauda por moedas e recarrega um poder'),
    );
    return wrap;
  }

  private itemAtalho(tecla: string, titulo: string, desc: string): HTMLElement {
    const l = el('div', 'ouro-item');
    l.appendChild(el('em', 'ouro-item-n', tecla));
    const txt = el('div', 'ouro-item-txt');
    txt.appendChild(el('b', undefined, titulo));
    txt.appendChild(el('span', undefined, desc));
    l.appendChild(txt);
    return l;
  }

  fim(score: number, moedas: number, recorde: boolean, causa: string, mode: ModeId): void {
    this.tela = 'fim';
    this.ultimoResultado = { score, moedas, recorde, causa, mode };
    const box = this.abrir();
    box.appendChild(
      el('p', 'ouro-sub', recorde ? 'NOVO RECORDE' : causaTexto(causa as 'desistencia').toUpperCase()),
    );
    box.appendChild(el('h2', 'ouro-grande', String(score)));
    box.appendChild(el('p', 'ouro-moedas', `+${moedas} moedas, total de ${this.save.coins}`));
    const lista = el('div', 'ouro-lista');
    lista.appendChild(botao('Jogar de novo', MODES[mode].nome, () => this.h.jogar(this.ultimoResultado.mode)));
    lista.appendChild(botao('Loja', 'gaste o que você ganhou', () => this.loja()));
    lista.appendChild(botao('Menu', '', () => this.menu()));
    box.appendChild(lista);
  }

  atualizarSave(s: SaveData): void {
    this.save = s;
  }
}
