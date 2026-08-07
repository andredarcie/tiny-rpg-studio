# Plano — Fontes e caixas de diálogo

Resposta a duas propostas independentes da comunidade sobre a caixa de diálogo:

1. **itch.io** — a caixa mostra "duas palavras no mobile e uma parede de texto no desktop".
2. **GMTK game jam** — a caixa reserva uma área grande e quase vazia; deveria ser fina e
   colada no rodapé, abraçando o conteúdo (sketch "Current textbox" vs "Suggest textbox").

As duas apontam para o mesmo defeito por ângulos diferentes, e a segunda levanta uma
pergunta de design que este plano responde com medição.

**Status: implementado.** Passos 1 a 4 entregues e validados no jogo rodando; o passo 5
(limite de caracteres) ficou de fora de propósito — ver §5. Resultado visual em
`comparacao-caixa-de-dialogo.png`, e os números medidos no app real em §7.

---

## 1. Diagnóstico

### A causa raiz é uma só

Todo o resto do jogo (tiles, sprites, HUD, o texto "LVL 1") é desenhado em **pixels
internos do canvas** e portanto escala junto com o canvas. **Só o texto do diálogo** está
preso a um valor fixo em **pixels de tela** (`--engine-font-size: 12px`), porque o diálogo
não é desenhado no canvas — é um overlay HTML/CSS por cima dele
(`RendererDialogRenderer.ts`).

O resultado é que a fonte do diálogo **não escala**, enquanto a fonte do HUD escala. As
duas só coincidem quando o canvas está exatamente 1,5× ampliado. Abaixo disso o diálogo
fica maior que o HUD; acima, menor. É exatamente a inversão descrita na proposta, e ela
sai de uma única fórmula:

```
fonte do HUD     = 8 px internos × ratio      (escala)
fonte do diálogo = 12 px de tela              (fixa)
ratio            = altura exibida do canvas ÷ 196 px internos
```

### Dois pontos no código produzem o valor fixo

1. `src/runtime/adapters/renderer/RendererDialogRenderer.ts:138`
   ```ts
   box.style.fontSize = 'var(--engine-font-size)';
   ```
2. A regra universal em `src/styles.css:82-84` (e a cópia em `src/export/styles.css:49-51`):
   ```css
   body * { font-size: var(--engine-font-size); }
   ```

O ponto 2 é uma armadilha e **precisa ser tratado primeiro**: `body *` casa diretamente
com o elemento `.game-dialog-text`, então ele ganha 12px por regra própria, não por
herança do `.game-dialog-box`. Verifiquei isso no browser — pondo 24px na caixa, o filho
que de fato renderiza o texto continuou em 12px:

```
box definido em 24px → box computa 24px → .game-dialog-text computa 12px
```

**Consequência prática: mexer só na linha 138 não muda nada na tela.** A correção tem de
atingir o elemento que carrega o texto.

### A altura da caixa é proporcional, o texto não

`RendererDialogRenderer.ts:213` fixa a área de texto em **um terço do viewport de
gameplay**:

```ts
this.pageTextHeightPx = Math.max(FONT_SIZE * ratio, (this.gameplayHeight / 3) * ratio);
```

Como a altura escala e a fonte não, o número de linhas por página varia com o tamanho da
tela — que é o sintoma reclamado.

### Medições (canvas real 128×196 internos, fonte real, CSS real)

Reproduzi o DOM do renderer no browser e rodei a mesma matemática de paginação, com um
diálogo de 216 caracteres:

| | ratio | fonte diálogo | fonte HUD | diálogo ÷ HUD | chars/linha | linhas/página | chars/página | páginas |
|---|---|---|---|---|---|---|---|---|
| Mobile  | 1,0 | 12px | 8px  | **1,5×** | 8  | 2 | 16  | **16** |
| Desktop | 3,0 | 12px | 24px | **0,5×** | 28 | 8 | 224 | **1** |

Oscilação de **3×** no tamanho relativo. A primeira página no mobile sai como
`"I HAVE / WANDERED"` — duas palavras, exatamente o que aparece no screenshot com
`"BEARDED / OLD MAN:"`. No desktop as 8 linhas cabem todas numa página só: a parede de
texto. As duas evidências saem da mesma fórmula, mudando só o `ratio`.

### O que já existe e não precisa ser construído

**A paginação já está implementada.** `computePages()` (linha 349) quebra o texto em
linhas medidas contra o DOM real e agrupa em páginas; `dialog.page` / `dialog.maxPages`
já circulam pelo estado (`StateDialogManager.ts:75-82`). O ponto 2 da proposta — "o
excedente vai para a próxima caixa" — **já funciona**. O que está errado é só o
*tamanho* da página. Isso reduz bastante o escopo.

### A evidência da GMTK confirma a mesma causa

O sketch da game jam contrasta a caixa atual — alta, ocupando boa parte da tela, com o
texto ocupando só as primeiras linhas e o resto vazio — com uma caixa fina colada no
rodapé, na altura exata do conteúdo.

Esse espaço vazio é o **mesmo bug visto do outro lado**. A caixa reserva sempre um terço
do viewport (`RendererDialogRenderer.ts:213`) independentemente do texto, enquanto a fonte
não escala. No desktop isso enche de texto pequeno; num diálogo curto sobra área vazia. As
duas reclamações são o mesmo defeito: **a altura da caixa não tem relação com o conteúdo**.

Isso é uma boa notícia para o escopo — a correção da fonte (§2, ponto 1) e a altura por
linhas (§2, ponto 2) já atacam as duas evidências. O que a GMTK acrescenta é uma decisão
de design a mais, tratada abaixo.

---

## 2. Mudanças propostas

### Ponto 1 — Fonte do diálogo igual à fonte do sistema

Trocar o valor fixo por `FONT_SIZE * ratio`, que é literalmente a fonte do HUD. O
`container` já calcula esse número na linha 201; basta usá-lo no elemento certo.

- Aplicar o tamanho em `.game-dialog-text` e `.game-dialog-button` (não só na caixa).
- Excluir o diálogo da regra universal, nos dois stylesheets:
  ```css
  body *:not(.game-dialog-text):not(.game-dialog-button) { font-size: var(--engine-font-size); }
  ```
  Alternativa mais limpa e menos frágil: restringir a regra universal ao chrome do editor
  em vez de `body *`, já que ela existe para o editor e o diálogo é o único caso do
  runtime que ela atinge por acidente.

**Resultado medido** — idêntico em qualquer tamanho de tela, `diálogo ÷ HUD = 1,00`:
(sobre o teto máximo que limita esse crescimento, ver §2, "Teto de tamanho".)

| | ratio | fonte diálogo | fonte HUD | chars/linha |
|---|---|---|---|---|
| Mobile  | 1,0 | 8px  | 8px  | 13 |
| Desktop | 3,0 | 24px | 24px | 13 |

**13 caracteres por linha em todo tamanho de tela.** Vale registrar o custo: no desktop
isso é menos texto por linha do que hoje (28), porque hoje a fonte está pequena demais.
É a consequência direta de pedir "a mesma fonte do sistema", e o teto absoluto num canvas
de 128px com fonte monoespaçada full-em é 16 caracteres — ou seja, 13 já está perto do
limite do design.

### Ponto 1b — Teto de tamanho da fonte

Escalar com o canvas sem limite significa que numa tela muito grande a fonte cresce junto:
num monitor 4K o canvas chega a ~10× e a fonte iria a 80 px.

```ts
const fontPx = Math.min(GameConfig.dialog.maxFontSize, FONT_SIZE * ratio);
```

#### De onde sai o valor

A primeira coisa que a pesquisa mostra é que **as normas de acessibilidade definem
mínimos, não máximos** — texto maior é um ganho de acessibilidade, não um problema. Não
existe "tamanho máximo de fonte" recomendado. O que existe são dois limites que cercam a
escolha por cima e por baixo:

| Fonte da recomendação | Número | O que é |
|---|---|---|
| Xbox Accessibility Guidelines (PC/VR) | 18 px em 1080p, **36 px em 4K** | mínimo, e ele **escala com a resolução** |
| Xbox Accessibility Guidelines (console) | 26 px em 1080p, escalável até 52 px | mínimo e topo da faixa de escala do usuário |
| Xbox Accessibility Guidelines | ≤ 80 caracteres por linha | largura máxima de linha |
| Tipografia web (Bringhurst e sucessores) | 45–75 CPL (66 ideal); 30–50 no mobile | faixa confortável de leitura |
| Corpo de texto web | 16–18 px | mínimo prático |
| Escalonamento de pixel art | só múltiplos inteiros | nitidez sem interpolação |

O critério decisivo é que **o mínimo de PC escala com a resolução**: 18 px em 1080p, 36 px
em 4K. Um teto fixo abaixo de 36 px faria o texto ficar **abaixo do mínimo recomendado**
justamente nas telas maiores. Isso elimina 32 px, que era o candidato natural por ser 4× o
tamanho nativo. O menor múltiplo do tamanho nativo de 8 px que passa dos 36 px é **40 px**,
e múltiplo inteiro é exatamente o que mantém a fonte pixelada nítida.

`GameConfig.dialog.maxFontSize = 40` — 5× o nativo. Confere nos dois lados: fica acima do
mínimo de 36 px em 4K e abaixo dos 52 px até onde as mesmas diretrizes deixam o texto de
console escalar.

#### Onde o teto entra, medido com o componente real

| Tela | ratio | Fonte do HUD | Fonte aplicada | Teto atua? | Diálogo ÷ HUD | CPL |
|---|---|---|---|---|---|---|
| iPhone 13 | 2,8 | 22,5 px | 22,4 px | não | 1,00 | 13 |
| Laptop 1366×768 | 3,1 | 24,7 px | 24,7 px | não | 1,00 | 13 |
| Laptop 1536×864 | 3,6 | 28,6 px | 28,6 px | não | 1,00 | 13 |
| Full HD 1920×1080 | 4,7 | 37,2 px | 37,2 px | não | 1,00 | 13 |
| iPad | 5,2 | 41,2 px | **40 px** | sim | 0,97 | 13 |
| QHD 2560×1440 | 6,5 | 51,6 px | **40 px** | sim | 0,78 | 17 |
| 4K 3840×2160 | 10,1 | 80,4 px | **40 px** | sim | 0,50 | 28 |

**Nenhuma tela até Full HD é afetada**, e no iPad o corte é de 3%. Só QHD e 4K são
realmente limitados, e mesmo lá a largura de linha (17 e 28 CPL) fica bem abaixo do limite
de 80 e dentro da faixa de leitura confortável.

O custo, que é honesto declarar: acima do teto a fonte para de acompanhar o canvas, então
a paginação deixa de ser idêntica em toda tela (17 CPL em QHD, 28 em 4K, contra 13 no
resto). Em 4K a razão diálogo ÷ HUD volta a 0,5 — a mesma proporção que gerou a reclamação
original —, com a diferença de que ali são 40 px e o problema original eram 12 px. Qualquer
teto tem esse efeito; o que se escolhe é onde ele começa, e é uma constante só.

#### Dois achados da pesquisa que ficaram fora deste ajuste

1. **Entrelinha.** As mesmas diretrizes pedem espaçamento de pelo menos **1,5** para blocos
   com mais de duas linhas; a caixa usa **1,3** (`.game-dialog-box`, `line-height`). Subir
   para 1,5 deixaria a caixa de 4 linhas ~15% mais alta, o que puxa contra o objetivo de
   caixa menor levantado na GMTK — por isso é uma decisão sua, não um ajuste automático.
2. **Piso, não teto.** O mínimo de 18 px vale para o outro extremo: num canvas embutido
   muito pequeno (o caso do iframe do itch.io, ratio ≈ 1) a fonte fica em 8 px, abaixo do
   mínimo. Isso não se resolve na fonte do diálogo — ali o jogo inteiro está pequeno demais,
   e o caminho seria garantir um tamanho mínimo de exibição do canvas.

Fontes: [Xbox Accessibility Guideline 101](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101),
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/use-an-easily-readable-default-font-size/),
[Baymard — line length](https://baymard.com/blog/line-length-readability),
[UXPin — optimal line length](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/),
[Learn UI Design — font size guidelines](https://www.learnui.design/blog/mobile-desktop-website-font-size-guidelines.html).

### Ponto 2 — Altura por número de linhas, com teto de 4

Substituir a altura de "um terço do viewport" por uma contagem explícita de linhas:

```ts
// Page height follows the line count, not the viewport, so the box is the same
// shape on every screen.
this.pageTextHeightPx = lines * lineHeight;
```

Com `DIALOG_MAX_LINES = 4` como constante em `GameConfig` limitando `lines`.

**Resultado medido:** 4 linhas × 13 chars ≈ **52 caracteres por página**, próximo dos "64
ou mais ou menos" sugeridos na proposta, e igual em toda tela.

Falta decidir o que `lines` vale quando o texto não enche as 4 linhas — é exatamente o
que o sketch da GMTK pede e o que a pergunta sobre "alturas diferentes" questiona.

#### A pergunta: caixa de altura variável não seria irritante?

Medi as três opções. Cobertura da área de jogo, já com a fonte corrigida (idêntica em
desktop e mobile):

| Linhas na página | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| % da área de gameplay | **17,5%** | 25,6% | 33,8% | **41,9%** |

**A preocupação está empiricamente certa.** Se a caixa for dimensionada *por página*,
varrendo 38 comprimentos de diálogo, **21 deles (55%)** terminam com uma última página
curta. Nesses casos a caixa salta no meio da conversa:

| Exemplo | Linhas por página | Cobertura por página |
|---|---|---|
| 56 chars | `[4, 1]` | 41,9% → **17,5%** |
| 60 chars | `[4, 1]` | 41,9% → **17,5%** |
| 66 chars | `[4, 2]` | 41,9% → **25,6%** |

Um salto de 41,9% para 17,5% enquanto o jogador aperta para avançar é bem visível, e
aconteceria em mais da metade dos diálogos. Redimensionar por página está descartado.

#### A saída: dimensionar por diálogo, não por página

As duas coisas são conciliáveis. O incômodo não é "NPCs diferentes têm caixas de tamanhos
diferentes" — é **a caixa mudar de tamanho enquanto o jogador está lendo**. Então:

> Calcular a altura **uma vez por diálogo**, pela página mais alta dele, e manter essa
> altura fixa em todas as suas páginas.

`computePages()` já calcula todas as páginas de uma vez e as guarda em cache
(`this.pages` / `this.pagesKey`), então o número máximo de linhas já está disponível no
mesmo instante — é uma linha a mais, sem custo estrutural.

O resultado atende as duas propostas ao mesmo tempo:

| Diálogo | Páginas | Hoje | Fixo em 4 | **Por diálogo** |
|---|---|---|---|---|
| `"HELLO!"` | 1 | ~37% | 41,9% | **17,5%** |
| `"THE MILL IS BROKEN."` | 1 | ~37% | 41,9% | **25,6%** |
| 216 chars | 5 | ~37% | 41,9% | 41,9%, sem variação |

Uma saudação curta passa a cobrir 17,5% em vez de 41,9% — é o ganho que o sketch pede — e
nenhum diálogo muda de altura no meio. A caixa só troca de tamanho entre conversas
diferentes, quando ela está sendo fechada e reaberta e não há transição visível.

Detalhe de implementação que importa: a altura tem de vir do **texto já paginado**, não do
texto revelado pelo typewriter. Como as quebras de linha são pré-calculadas, a altura
final é conhecida antes do primeiro caractere aparecer. Dimensionar pelo texto revelado
faria a caixa crescer linha a linha durante a digitação — bem pior que o problema original.

Nota sobre o ponto 3: com a quebra manual `\`, o autor pode forçar uma página de 1 linha
dentro de um diálogo de 4. A caixa fica na altura de 4 e sobra espaço naquela página — é
intenção explícita do autor e permanece estável, então está tudo bem.

### Ponto 3 — `\` como quebra de página manual

Em `computePages()`, separar o texto pelos marcadores **antes** de quebrar em linhas, e
paginar cada segmento de forma independente, sem nunca juntar dois segmentos na mesma
página:

```ts
// A backslash forces a page break; "\\" escapes a literal backslash.
const segments = text.split(/(?<!\\)\\(?!\\)/).map((s) => s.replace(/\\\\/g, '\\'));
```

Depois, para cada segmento, rodar o wrap atual e emitir suas próprias páginas.

O share **não precisa de mudança**: `ShareTextCodec` codifica em base64url sobre UTF-8
(`ShareTextCodec.ts:28-40`), então `\` sobrevive à URL sem escape adicional. Vale um teste
de round-trip mesmo assim.

No editor, adicionar uma dica curta no campo de diálogo do `NpcEditModal.ts:113-123`
explicando o `\`.

### Opcional — Limite de caracteres por diálogo

A proposta sugere ~256 caracteres para desencorajar paredes de texto. Já existe um
precedente pronto para copiar, o `PLAYER_END_TEXT_LIMIT = 40`:

- constante em `src/runtime/domain/state/StateObjectManager.ts:5`
- corte no próprio manager (`.slice()`, linha 274)
- espelhado em `ShareDataNormalizer.ts:587`
- exposto no editor como `textarea.maxLength` + texto de ajuda
  (`EditorObjectRenderer.ts:551-566`)

Sugiro tratar como fase separada: é a única mudança que pode **truncar jogos já
publicados**. Se entrar, o limite deve ser aplicado só na edição (maxLength no textarea),
e **não** no decode do share, para não quebrar retroativamente jogos existentes.

---

## 3. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/runtime/adapters/renderer/RendererDialogRenderer.ts` | fonte proporcional (138, 201, 213), altura por linhas, quebra por `\` em `computePages` |
| `src/styles.css` | tirar `.game-dialog-text` / `.game-dialog-button` da regra `body *` |
| `src/export/styles.css` | mesma mudança (cópia independente usada pelo build exportado) |
| `src/config/GameConfig.ts` | `DIALOG_MAX_LINES` + validação no `GameConfigSchema` |
| `src/editor/modules/NpcEditModal.ts` | dica sobre `\` no campo de diálogo |
| `src/__tests__/renderer/RendererDialogRenderer.test.ts` | 2 testes assertam o tamanho fixo (linhas 109-117 e 119-141) |

Os jogos no itch.io rodam o **build exportado**, que tem seu próprio `styles.css` — por
isso a correção precisa entrar nos dois stylesheets, senão o bug persiste exatamente onde
foi reportado. `public/export.bundle.js` é artefato de build e se regenera sozinho.

---

## 4. Testes

Ajustar os dois testes existentes que fixam o comportamento antigo e acrescentar:

- fonte do diálogo == `FONT_SIZE * ratio` em vários ratios (o teste da linha 119 já tem o
  laço pronto, só muda o elemento verificado);
- nunca mais que `DIALOG_MAX_LINES` linhas por página, em ratios diferentes;
- número de páginas de um texto longo é **igual** em ratio 1 e ratio 3 (é a garantia
  central contra a regressão original);
- **a altura da caixa não muda entre as páginas do mesmo diálogo** — usar um texto do
  tipo `[4, 1]` linhas (os exemplos de 56 e 60 caracteres medidos acima), que é onde o
  redimensionamento por página apareceria;
- um diálogo de uma linha produz uma caixa mais baixa que um de quatro (o ganho pedido
  pelo sketch da GMTK);
- a altura fica estável durante o typewriter, não cresce conforme o texto é revelado;
- `\` gera quebra de página; `\\` vira uma barra literal;
- round-trip de share com `\` no texto.

Fecho com os três comandos obrigatórios do `CLAUDE.md`: `npx tsc --noEmit`,
`npm run test:run`, `npm run lint`.

---

## 5. Ordem sugerida

1. **Fonte proporcional** (ponto 1 + regra CSS nos dois stylesheets). Sozinho já elimina a
   inversão e é o que a proposta do itch.io chama de "resolve a maior parte do problema".
2. **Altura por linhas, teto de 4** (ponto 2), com a constante em `GameConfig`.
3. **Altura por diálogo** (a resposta ao sketch da GMTK). Depende do passo 2 e é pequeno
   em cima dele, mas vale como commit separado: é a única mudança puramente estética da
   lista e a mais fácil de reverter se a comunidade preferir altura fixa.
4. **Quebra manual `\`** (ponto 3).
5. **Limite de caracteres** — decisão de produto à parte, pelo risco de truncar jogos já
   publicados.

Os passos 1 e 2 se sustentam sozinhos e podem ir para produção sem os demais. O passo 3 é
o que fecha a segunda evidência.

---

## 6. Para a discussão com a comunidade

Se for levar isso ao fórum, os pontos que valem ser ditos com número na mão:

- o problema do mobile/desktop e o da caixa vazia **são o mesmo bug**, não dois;
- redimensionar por página realmente incomodaria — **55% dos diálogos** teriam a caixa
  saltando no meio da conversa, no pior caso de 41,9% para 17,5% da tela;
- dimensionar **por diálogo** entrega o visual do sketch sem nenhum salto durante a leitura;
- igualar a fonte à do sistema custa largura: **13 caracteres por linha** em toda tela,
  contra os 28 de hoje no desktop. É o teto do design — num canvas de 128px com fonte
  monoespaçada full-em o máximo absoluto são 16 caracteres. Vale confirmar que a
  comunidade topa essa troca, porque ela é irreversível sem abrir mão da uniformidade.

---

## 7. O que foi entregue

Passos 1 a 4 implementados. `npx tsc --noEmit`, `npm run test:run` (2337 testes) e
`npm run lint` passam.

### Medido no jogo rodando, não só em teste

Diálogo real de um NPC, canvas exibido a 2,505× :

| Verificação | Resultado |
|---|---|
| Fonte do HUD (`8 × ratio`) | 20,04 px |
| Fonte do diálogo | **20,04 px** — idêntica, antes era fixa em 12 px |
| Teto da fonte (40 px) | segura em 40 px a partir de ratio 5; abaixo disso não interfere |
| Altura da área de texto | 104,21 px = **exatamente 4 linhas** |
| Altura da caixa nas 4 páginas | 140,1 px em todas — **sem variação** |
| Altura durante o typewriter | já final antes do primeiro caractere aparecer |
| `\` no meio do texto | inicia página nova, sem juntar com a anterior |
| Dica no editor | aparece sob o campo de diálogo, nos 5 idiomas |
| Linha em branco no fim do texto | não gera mais página vazia — ver abaixo |

### Correção: página final vazia

Um diálogo escrito em várias linhas terminava com uma **caixa completamente vazia** que o
jogador ainda tinha de dispensar. A causa: linhas em branco entravam na paginação como se
fossem conteúdo, e a quebra de linha final que um `textarea` deixa para trás virava uma
página só dela.

Era um defeito que já existia antes, mas passava despercebido: com 8 linhas por página no
desktop a linha vazia quase sempre sobrava dentro da última página. Ao baixar para 4 linhas
ela passou a transbordar para uma página própria, e o bug ficou visível.

`computePages()` agora apara linhas em branco nas duas pontas de cada página e descarta
páginas sem nada legível. Com o texto exato reportado, medido no jogo rodando: **3 páginas,
todas com conteúdo**, e o diálogo fecha na terceira.

### Mudanças

| Arquivo | O que mudou |
|---|---|
| `RendererDialogRenderer.ts` | fonte proporcional aplicada a caixa/texto/botões; altura por linhas com teto; `splitPageBreaks()` + `applyPageHeight()` |
| `GameConfig.ts` / `GameConfigSchema.ts` | `dialog.maxLines = 4` e `dialog.maxFontSize = 40`, com validação |
| `styles.css` e `export/styles.css` | `.game-dialog-text { font-size: inherit }` para o texto não ser fixado pela regra `body *` |
| `NpcEditModal.ts` + `TextResources.ts` | dica sobre `\`, traduzida em pt/en/zh/pl/es |
| `RendererDialogRenderer.test.ts` | 19 testes (eram 9): escala de fonte, teto de tamanho, teto de linhas, altura estável entre páginas, altura final durante o typewriter, `\` e `\\` |

O teste que fixava o comportamento antigo (`box.style.fontSize === 'var(--engine-font-size)'`)
foi substituído — ele existia justamente para garantir o tamanho fixo que causava o bug.

### O que não foi feito

O limite de caracteres por diálogo (§2, "Opcional") ficou de fora: é a única mudança da
lista que pode truncar jogos já publicados, e essa é uma decisão de produto, não técnica.
