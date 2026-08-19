# OUROBORO

Um jogo da cobrinha em que o corpo é a moeda de energia.

No Snake clássico a única decisão é para onde virar. Aqui a decisão é outra: vale a pena continuar crescendo? Cada segmento do corpo é um ponto de energia. Ativar um poder consome segmentos e encolhe a cobra em tempo real. Crescer deixa você forte e frágil ao mesmo tempo, e se a cobra chegar a zero segmentos ela se apaga, sem precisar de colisão nenhuma.

Zero dependências de runtime. TypeScript, Vite e Canvas 2D, nada mais. O bundle final tem 20 KB gzip.

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # typecheck e bundle de producao em dist/
npm test         # 62 testes de nucleo com vitest
npm run bench    # relatorio de bundle e teste de estresse em Chromium
npm run smoke    # smoke funcional: menu, partida, loja, save, mobile 320px
npm run single   # dist/ouroboro.html, o jogo inteiro em um arquivo so
```

O `bench` e o `smoke` precisam do Chromium do Playwright, que é devDependency e não entra no bundle.

## Como se joga

Setas ou WASD movem. As teclas 1, 2 e 3 ativam os poderes equipados e a tecla 4 aciona o Ouroboro (o espaço continua valendo). O teclado numérico funciona igual. Escape pausa. Cada caixinha do rodapé mostra o número do próprio atalho, então a tecla se aprende olhando para a tela. No celular, o swipe reconhece o eixo dominante com limiar baixo, o toque curto aciona o Ouroboro, e existe um d-pad opcional nas opções. Gamepad também funciona.

### As três pressões

**Corrupção, pressão espacial.** Fruta que fica no mapa apodrece e vira um bloco de corrupção, que se espalha sozinho para as células vizinhas. O mapa aperta com o tempo. No modo Clássico a corrupção mata no contato; nos outros modos você atravessa pagando 2 segmentos, e limpa a célula ao passar. Onda de Choque e Dash também limpam.

**Combo, pressão temporal.** Comer em sequência sobe o multiplicador de x1 até x8, e ele vale para pontos e moedas. A janela é curta o bastante para forçar rotas agressivas em vez de rotas seguras.

**Ouroboro, a decisão assinatura.** A qualquer momento você devora a própria cauda: corta 3 segmentos, converte em moedas multiplicadas pelo combo e recarrega na hora o poder que estiver mais longe de voltar. É o botão de vender vida por recurso.

### Poderes

Máximo de 3 equipados por run. Todos são pagos em segmentos, não em cooldown apenas.

| Poder | Custo | Efeito |
| --- | --- | --- |
| Fase | 4 | Atravessa o próprio corpo e as paredes por 2,5 s |
| Dash | 2 | Avança 6 células e limpa a corrupção do caminho |
| Rebobinar | 8 | Volta o jogo 2 segundos. Anti morte, caro de propósito |
| Ímã | 3 | Puxa as frutas em raio 6 para a cabeça por 3 s |
| Onda de Choque | 5 | Limpa a corrupção em raio 5 e empurra o resto |
| Dilatação | 4 | O mundo roda a 35% da velocidade por 3 s, o input segue normal |
| Semear | 3 | Converte 3 segmentos da cauda em 3 frutas maduras |

### Frutas

Comum dá 1 segmento e 1 moeda. Parada por 3 segundos ela amadurece, ganha espinhos e pisca: passa a valer 2 segmentos e 3 moedas, mas apodrece rápido. A amarga, roxa e hexagonal, custa 2 segmentos e recarrega todos os poderes de uma vez, então é recurso e não punição. A espelho, losango ciano, dobra o multiplicador atual por 5 segundos.

### Relíquias

Máximo de 2 equipadas. É aqui que mora toda a vantagem do jogo, de forma visível e explícita: Casca Dura, Metabolismo, Simbiose, Fome e Muda. Skin nunca dá vantagem, essa regra é dura.

### Modos

Clássico é o jogo puro: paredes matam, corrupção lenta, sem poderes. Ouroboro é o modo principal com tudo ligado e intensidade crescente. Desafio Diário usa semente determinística da data, então todo mundo joga o mesmo mapa e as mesmas frutas, com histórico local de 30 dias. Fantasma reproduz a sua melhor run como uma cobra translúcida correndo junto. Aperto encolhe a arena uma linha a cada 20 segundos.

## Decisões de design

**O núcleo é puro e determinístico, e isso não é purismo.** `step(state, command)` devolve um estado novo sem tocar em DOM, Canvas, `Date` ou `Math.random`. Essa única decisão entrega de graça quatro features que seriam difíceis de retrofitar: o replay do Fantasma (guardamos comandos, não posições), o Desafio Diário (mesma semente, mesmo mapa), o poder Rebobinar (basta guardar cópias baratas do estado) e os testes unitários. O estado foi projetado desde o começo para ser JSON puro e barato de copiar: o corpo da cobra é um array achatado de números, a corrupção é uma grade linear, e `cloneState` copia tudo com `slice`.

**Rebobinar vive no `Sim`, não no `step`.** O ring buffer de 64 estados é responsabilidade do invólucro `Sim`, que ainda é determinístico dado o mesmo conjunto de comandos. Só entram estados vivos no histórico: rebobinar para um estado morto devolveria o jogador direto para a morte.

**Timestep fixo com acumulador, render interpolado.** A lógica nunca é amarrada ao `requestAnimationFrame`. O acumulador tem clamp de 250 ms contra a espiral da morte e teto de 6 passos por frame. A cobra desliza entre ticks, e a interpolação respeita o wrap das bordas para o corpo não riscar a tela ao dar a volta.

**A fila de input mora fora do estado.** Input é do dispositivo, não da simulação. A fila aceita no máximo 2 comandos e rejeita qualquer curva que seja reversão da anterior na fila, e não apenas da direção atual. Isso mata o bug clássico de apertar duas teclas rápido no mesmo tick e a cobra virar 180 graus em si mesma. Existe teste explícito para esse caso.

**Dilatação estica o tempo real, não a contagem de ticks.** O bullet time multiplica o intervalo de parede entre ticks. A contagem de ticks não muda, então o determinismo do replay continua intacto e o input do jogador segue respondendo na velocidade normal.

**A corrupção resolve o defeito estrutural do Snake.** Sem ela, os primeiros 60 segundos de qualquer partida de Snake são um passeio seguro. Com o mapa apertando sozinho, ficar rodando em círculo deixa de ser uma estratégia.

**Nunca comunicar informação só por cor.** A corrupção tem textura ruidosa animada além da cor, a fruta madura pisca e ganha espinhos, a amarga é hexágono, a espelho é losango. Existem três paletas para daltonismo e um modo de alto contraste, mas a leitura do jogo não depende de nenhum deles.

**Zero alocação no caminho quente.** As partículas vivem em um pool pré-alocado de arrays tipados, os buffers de interpolação são reutilizados entre frames, e não há `.map()` nem `.filter()` dentro do loop. A grade, a vinheta e o grão de filme são desenhados uma vez em canvas offscreen.

**Áudio inteiramente sintetizado.** Osciladores, envelopes e ruído filtrado via WebAudio. Nenhum arquivo de som, então o peso no bundle é zero. A trilha é procedural e ganha camadas conforme o combo sobe: baixo, percussão de ruído, arpejo e pad.

**Uma armadilha de performance que valeu medir.** A transição de morte usava `ctx.filter = saturate(...)` para dessaturar a cena. O frame despencou de 60 para 2,5 fps na grade cheia. A composição `saturation` melhorou para 54 fps, ainda ruim. A versão final é uma lavagem cinza translúcida, um `fillRect` comum, que mantém os 60 fps. Vale a mesma lição de sempre: medir, não presumir.

## Arquitetura

```
src/
  core/            simulacao pura, deterministica, sem DOM e sem Canvas
    state.ts       tipo do GameState, serializavel, e clone barato
    step.ts        (state, command) => nextState, funcao pura
    sim.ts         invólucro com o ring buffer do Rebobinar
    rng.ts         mulberry32 com estado serializavel
    powers.ts      custo em segmentos e efeitos
    corruption.ts  espalhamento e onda de choque
    spawn.ts       frutas nunca em celula ocupada ou encurralada
    config.ts      numeros de balanceamento e definicoes de dados
  render/
    renderer.ts    desenha um GameState, sem regra de jogo
    layers.ts      grade, vinheta e grao em canvas offscreen
    particles.ts   pool pre alocado
    palette.ts     daltonismo e alto contraste
    skins/         definicoes data-driven
  audio/synth.ts   WebAudio, zero arquivos
  meta/
    save.ts        localStorage com versao de schema e migracao
    shop.ts        skins, poderes e reliquias
    ghost.ts       gravacao e replay de inputs, semente do diario
  ui/hud.ts menus.ts
  input/keyboard.ts gamepad.ts touch.ts
  main.ts
```

A regra que não se quebra: nada em `core/` importa de `render/`, `ui/`, `audio/` ou `input/`, e nada de `render/` decide regra de jogo.

## Como adicionar uma skin nova

O sistema é data-driven: o renderer lê a definição e aplica. Adicionar skin não exige mexer no motor.

Abra `src/render/skins/defs.ts` e acrescente um objeto ao array `SKINS`:

```ts
{
  id: 'salgema',
  nome: 'Salgema',
  raridade: 'raro',
  preco: 680,
  acento: '#9FE8E2',      // cor de acento, usada com avareza
  cabeca: '#EAFBFA',      // cor da cabeca
  cauda: '#2E5A58',       // cor da cauda, o corpo interpola entre as duas
  forma: 'faceta',        // circulo, vertebra, bloco, faceta, particula, fita, vidro, pilula
  rastro: 'caco',         // poeira, brasa, pulso, caco, papel, sombra, cardume, faisca, tinta, nenhum
  olho: 'anel',           // ponto, fenda, led, vazio, cruz, anel
  contorno: '#9FE8E2',    // contorno do segmento, ou null
  pulso: 0.4,             // luz correndo da cauda para a cabeca, 0 desliga
  espinha: 0.55,          // espessura da espinha que liga os segmentos, 0 deixa solto
  mordida: { freq: 1100, tipo: 'triangle', ruido: 0.4 },  // som da mordida
}
```

Pronto. A skin aparece na loja automaticamente, com o preço declarado, e o renderer e o sintetizador de áudio passam a usá-la quando equipada. Se precisar de uma forma, rastro ou olho que ainda não existem, acrescente o nome ao tipo em `src/render/skins/types.ts` e trate o caso novo no `switch` correspondente do renderer.

Não invente campo que afete regra: a checagem em `tests/meta.test.ts` falha se alguma skin ganhar atributo de vantagem mecânica.

## Orçamento de performance

Metas medidas, não presumidas. Rode `npm run bench` para reproduzir.

| Métrica | Meta | Medido |
| --- | --- | --- |
| Bundle JS gzip | abaixo de 150 KB | 24,4 KB |
| Bundle bruto | | 70,6 KB |
| Requisições após a carga | zero | zero |
| Tempo até jogável | abaixo de 1 s | 157 ms |
| FPS no estresse, 217 segmentos e 372 partículas | 60 | 60,2 |
| Pior frame | 16,6 ms | 16,8 ms |
| Erros de console | nenhum | nenhum |

O bundle sai em IIFE com base relativa, então roda em subpasta, em `file://` e como arquivo único. O jogo funciona offline depois da primeira carga, via um service worker cache first de 30 linhas. Testado em viewport de 320 px e em desktop.

## Qualidade

`npm test` roda 58 testes sobre o núcleo puro, cobrindo determinismo byte a byte com a mesma semente, pureza de `step`, o buffer de input contra reversão de 180 graus, frutas que nunca nascem em célula ocupada, poder que não ativa sem segmentos suficientes, Rebobinar restaurando o estado exato de 2 segundos atrás, corrupção que não escapa da grade e save de schema antigo migrando sem quebrar.

`npm run smoke` roda 30 verificações funcionais no bundle de produção em Chromium, em desktop e em 320 px: menu, compra na loja, persistência de opções, partida com sequência de inputs, pausa, encerramento gravando o save, migração de save v1 no boot, ausência de erros de console e ausência de acúmulo de DOM ao trocar de tela.
