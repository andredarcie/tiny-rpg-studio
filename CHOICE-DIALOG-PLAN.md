# Plano de implementação — Diálogo de Escolhas (NPC)

> Feature nova: um NPC pode ter um **diálogo de escolhas** opcional. O autor escreve
> uma mensagem (a pergunta) e dois ramos — **"Sim"** e **"Não"** — cada um com sua
> própria mensagem de resposta e (opcionalmente) uma variável a ser ativada.
> Deve funcionar tanto no **compartilhamento por URL** quanto na **build HTML** do jogo,
> ser **responsivo no PC e no mobile**, e ser configurado por um **novo botão opcional
> no modal do NPC**. Desenvolvido com **TDD**.

---

## 1. Objetivo e escopo

### Dentro do escopo
- Novo tipo de diálogo de NPC: pergunta + ramo "Sim" + ramo "Não".
- Cada ramo tem: mensagem de resposta + variável opcional a ativar.
- Configuração via novo botão opcional no `NpcEditModal` (análogo ao botão de diálogo condicional já existente).
- Persistência no share URL **e** na build HTML standalone.
- Navegação por teclado (PC) e por toque (mobile); UI responsiva.
- Cobertura TDD em todas as camadas tocadas.

### Fora do escopo (nesta entrega)
- Mais de dois ramos / árvores de diálogo encadeadas.
- Rótulos de botão customizáveis pelo autor (usaremos "Sim"/"Não" localizados — ver §11, decisão D3).
- Condições aninhadas dentro de ramos.

---

## 2. Descoberta-chave de arquitetura (por que URL e BUILD "saem de graça")

A build HTML **reutiliza o mesmo runtime** do app:

- `vite.export.config.ts` empacota `src/main.ts` num IIFE → `public/export.bundle.js`.
- `EditorExportService.exportProjectAsHtml()` gera um HTML que embute o share code em
  `globalThis.__TINY_RPG_SHARED_CODE = <code>` (`EditorExportService.ts:400`) e injeta o
  bundle. No boot, o jogo decodifica esse code com o **mesmo `ShareDecoder`**.

**Conclusão:** a fonte única de verdade da serialização é o par
`ShareEncoder`/`ShareDecoder`. Se a feature for corretamente serializada ali e renderizada
pelo runtime, **URL-share e build HTML funcionam automaticamente** — basta reexecutar
`npm run build:export` para regerar o bundle. Não há um segundo formato de serialização
para a build.

---

## 3. Modelo de dados

### 3.1 Campos novos do NPC
A pergunta usa um **campo dedicado `choicePrompt`** (decisão D1), separado do `text` simples.
Isso mantém a escolha independente do diálogo padrão/condicional e permite coexistência (§3.3):

| Campo | Tipo | Significado |
|---|---|---|
| `choiceEnabled` | `boolean` | NPC usa diálogo de escolhas (liga/desliga pelo botão) |
| `choicePrompt` | `string` | a pergunta exibida no diálogo de escolhas |
| `choiceYesText` | `string` | mensagem do ramo "Sim" |
| `choiceNoText` | `string` | mensagem do ramo "Não" |
| `choiceYesVariableId` | `string \| null` | variável ativada ao escolher "Sim" |
| `choiceNoVariableId` | `string \| null` | variável ativada ao escolher "Não" |

Os campos `text`, `conditionText`, `conditionVariableId`, etc. permanecem intactos e continuam
funcionando (ver §3.3).

### 3.2 Onde declarar/propagar os tipos
- `src/runtime/services/NPCManager.ts` — `NPCInstance` (linha ~20) e `NPCInput` (linha ~39);
  `normalizeNPC` (linha ~213) deve carregar e normalizar os 6 campos (variáveis de ramo via
  `gameState.normalizeVariableId`, textos via coerção a string; `choiceEnabled` default `false`).
- `src/runtime/infra/share/ShareDataNormalizer.ts` — tipo `NormalizedSprite` (linha ~85) e
  `normalizeSprites` (linha ~138): reconstrói o sprite com campos explícitos, então **precisa
  copiar os novos campos** senão o re-encode os perde.
- `src/editor/modules/EditorNpcService.ts` — `SpriteInstance` (linha ~8).
- `src/editor/modules/NpcEditModal.ts` — `EditorNpc` (linha ~14).
- Tipos compartilhados em `src/runtime/services/engine/resolveNpcDialog.ts` (`NpcDialogState`),
  `InteractionManager.ts` (`NpcState`), `RendererNpcDialogMarker.ts` (`NpcState`).

### 3.3 Coexistência com o diálogo condicional (decisão D2)
Escolha e condicional **coexistem** no mesmo NPC — o editor permite preencher ambas as seções,
e os dados de ambas persistem. A regra de resolução em runtime (detalhada em §5) usa a
**condição como porteiro da escolha**, um padrão de quest comum e intuitivo:

- `choiceEnabled` **sem** `conditionVariableId` → o diálogo de escolhas é **sempre** apresentado.
- `choiceEnabled` **com** `conditionVariableId`:
  - condição **ativa** → apresenta o diálogo de escolhas (`choicePrompt` + ramos Sim/Não);
  - condição **inativa** → cai no fluxo simples/condicional existente (mostra `text`).
- `choiceEnabled === false` → comportamento atual inalterado (simples + condicional).

Assim, por exemplo: "se o jogador tem a chave (variável), o NPC pergunta Sim/Não; senão,
apenas diz uma fala padrão". Nenhum dado é descartado ao alternar os estados.

> **Consequência aceita do modelo porteiro:** quando `choiceEnabled` e há `conditionVariableId`,
> a condição ATIVA leva à escolha e a INATIVA leva à fala simples (`text`). Logo, o campo
> `conditionText` (o "diálogo condicional") **fica inacessível enquanto a escolha está ligada**.
> O editor deve sinalizar isso (ex.: esmaecer/anotar a seção condicional quando a escolha
> estiver ativa) para não confundir o autor.

### 3.4 Escolha definitiva (decisão D6 — revisada)
O diálogo de escolhas é **definitivo durante o playthrough**: depois que o jogador responde,
a escolha **trava** e o NPC não pergunta de novo (cai na fala simples). Isso dá peso à decisão
e incentiva rejogar para ver caminhos diferentes. O lock só limpa num **restart completo**
(`resetGame()`), o mesmo ciclo que reseta as variáveis em runtime.

Implementação:
- Estado de runtime `npcChoiceAnswered: Record<npcId, true>` em `RuntimeState`
  (`gameState.ts`), gerido por `StateDialogManager` (`markNpcChoiceAnswered` /
  `hasNpcChoiceAnswered` / `resetNpcChoiceAnswered`).
- `StateDialogManager.reset()` (chamado por `GameState.resetGame()`) limpa o lock — junto
  com `variableManager.resetRuntime()`, mantendo escolha e efeito (variável) consistentes.
- `DialogManager.confirmChoiceSelection()` marca o NPC como respondido via
  `gameState.markNpcChoiceAnswered(meta.npcId)` no momento da confirmação.
- `resolveNpcDialog` recebe `hasAnsweredChoice(npcId)` e, se já respondido, **não** apresenta
  a escolha (retorna o diálogo simples). Em online, o lock é local a cada cliente; só a
  variável é autoritativa (via `onNpcReward`).

---

## 4. Serialização no share (URL + build)

### 4.1 Restrição descoberta: escassez de chaves de payload
O payload é `parts.join('.')`; no decode cada segmento usa **o 1º caractere como chave**
(`ShareDecoder.ts:262-272`). Praticamente todas as chaves de 1 caractere já estão em uso
(`a–z`, `A–Z`, `2–8`). **Livres apenas: `0`, `1`, `9`.**

O padrão estabelecido para dados opcionais/complexos é **JSON serializado numa única chave**
via `ShareTextCodec.encodeText(JSON.stringify(...))` — já usado por `online` (chave `8`,
`ShareDecoder.ts:602`) e `skillCustomizations` (chave `C`, `ShareEncoder.ts:575`).

### 4.2 Estratégia: blob JSON único na chave `9`
Todo o config de escolhas vai num **mapa esparso por índice de sprite**, codificado numa
única chave nova `9`:

```jsonc
// antes de JSON.stringify  (p = pergunta, y/n = textos dos ramos, yv/nv = variáveis dos ramos)
{
  "0": { "p": "Você aceita a missão?", "y": "Sim, claro!", "n": "Que pena.", "yv": "var-3", "nv": null },
  "4": { "p": "...",                    "y": "...",         "n": "...",       "yv": null,    "nv": "var-7" }
}
```
- Apenas sprites com `choiceEnabled === true` entram no mapa (esparso → URL curta quando
  ausente; nada é emitido se nenhum NPC usa a feature).
- Ids de variável são gravados como strings (consistente com `online`); a validação contra
  variáveis existentes acontece no `normalizeNPC` ao decodificar.

### 4.3 Versionamento (`ShareConstants.ts`)
- Adicionar `static get VERSION_34() { return 34; }`.
- `static get NPC_CHOICE_DIALOG_VERSION() { return ShareConstants.VERSION_34; }`.
- Bumpar `VERSION` para `VERSION_34`.
- Registrar `VERSION_34` em `SUPPORTED_VERSIONS` (linha ~241).

### 4.4 Encoder (`ShareEncoder.ts`, bloco de sprites ~319-340)
Após as colunas de sprite existentes:
```ts
const choiceMap: Record<number, { p: string; y: string; n: string; yv: string | null; nv: string | null }> = {};
sprites.forEach((npc, index) => {
  if (npc.choiceEnabled) {
    choiceMap[index] = {
      p: typeof npc.choicePrompt === 'string' ? npc.choicePrompt : '',
      y: typeof npc.choiceYesText === 'string' ? npc.choiceYesText : '',
      n: typeof npc.choiceNoText === 'string' ? npc.choiceNoText : '',
      yv: npc.choiceYesVariableId ?? null,
      nv: npc.choiceNoVariableId ?? null,
    };
  }
});
if (Object.keys(choiceMap).length) {
  parts.push('9' + ShareTextCodec.encodeText(JSON.stringify(choiceMap)));
}
```

### 4.5 Decoder (`ShareDecoder.ts`, montagem dos sprites ~413-468)
```ts
let choiceMap: Record<string, { p?: string; y?: string; n?: string; yv?: string | null; nv?: string | null }> = {};
if (version >= ShareConstants.NPC_CHOICE_DIALOG_VERSION && payload['9']) {
  try { choiceMap = JSON.parse(ShareTextCodec.decodeText(payload['9'], '')) ?? {}; }
  catch { choiceMap = {}; }
}
// dentro de cada loop de sprites.push, por índice:
const choice = choiceMap[String(index)];
// ...
choiceEnabled: Boolean(choice),
choicePrompt: choice?.p ?? '',
choiceYesText: choice?.y ?? '',
choiceNoText: choice?.n ?? '',
choiceYesVariableId: choice?.yv ?? null,
choiceNoVariableId: choice?.nv ?? null,
```
Os dois ramos do loop (`canUseDefinitions` true/false) precisam do mesmo tratamento.

### 4.6 Compatibilidade retroativa
- URLs antigas (`version < 34`) decodificam sem o bloco → `choiceEnabled=false`. ✅
- A bump de versão segue exatamente o padrão das versões anteriores (todas registradas e
  testadas em `ShareConstants.test.ts`).

---

## 5. Resolução de diálogo (`resolveNpcDialog.ts`)

Estender o resolvedor puro para reconhecer o modo escolha. Retorno passa a discriminar `kind`:

```ts
type ResolvedNpcDialog =
  | { kind: 'simple';  text: string; hasDialog: boolean; variantKey: string | null; rewardVariableId: string | null }
  | { kind: 'choice';  text: string; hasDialog: boolean; variantKey: string | null;
      choices: { yes: { text: string; rewardVariableId: string | null };
                 no:  { text: string; rewardVariableId: string | null } } };
```

Regras (coexistência D2 — a condição é o porteiro da escolha):
1. Avaliar `conditionActive` (lógica condicional existente).
2. Se `choiceEnabled` e `choicePrompt` não-vazia:
   - `hasCondition = Boolean(normalizeVariableId(conditionVariableId))`;
   - `presentChoice = !hasCondition || conditionActive`;
   - se `presentChoice` → `kind: 'choice'` com `text = choicePrompt` e ramos Sim/Não
     (ids de recompensa de cada ramo normalizados via `normalizeVariableId`).
3. Caso contrário (escolha desligada, ou condição inativa) → comportamento atual
   (`kind: 'simple'`, incluindo a lógica condicional de `text`/`conditionText`).
- `variantKey` para o modo escolha: `choice:<choicePrompt>` (alimenta o marcador de não-lido).

Os três consumidores de `resolveNpcDialog` (`InteractionManager.checkNpcs`,
`getNpcDialogMeta`, `RendererNpcDialogMarker`) passam a tratar o novo `kind`.

---

## 6. Máquina de estados do diálogo em runtime

### 6.1 `DialogState` (`src/types/gameState.ts:40`)
Adicionar um sub-estado opcional de escolha:
```ts
export type DialogChoiceState = {
  phase: 'prompt' | 'selecting' | 'branch';
  selectedIndex: 0 | 1;            // 0 = Sim, 1 = Não
  options: Array<{ key: 'yes' | 'no'; label: string; text: string; rewardVariableId: string | null }>;
};
export type DialogState = {
  active: boolean; text: string; page: number; maxPages: number;
  meta: DialogMeta | null;
  choice?: DialogChoiceState | null;   // novo
};
```

### 6.2 `StateDialogManager` (`StateDialogManager.ts`)
- `setDialog(active=false)` deve **resetar `choice` para `null`** (junto com o reset atual).
- Novos métodos: `setDialogChoice(choice)`, `setChoicePhase(phase)`,
  `setChoiceSelection(index)`, `applyChoiceBranch(index)` (move o texto exibido para o ramo
  escolhido e devolve a variável de recompensa do ramo).
- `reset()` continua limpando tudo.

### 6.3 `DialogManager` (`DialogManager.ts`)
- `showChoiceDialog(prompt, choiceConfig, meta)`: abre o diálogo com `text=prompt`,
  `choice.phase='prompt'`, `options` montadas a partir de `choiceConfig` + rótulos i18n.
  Reaproveita `pauseGame` + `markNpcDialogAsRead` (mesma assinatura de `showDialog`).
- `confirmChoiceSelection()`: transição `selecting → branch`:
  - guarda a variável de recompensa do ramo escolhido como `pendingDialogAction.setVariableId`;
  - troca o texto exibido para o `text` do ramo;
  - se o `text` do ramo for vazio → aplica a recompensa (`completeDialog`) e `closeDialog`
    imediatamente.
- `completeDialog()` permanece o ponto único onde a variável é ativada (já cobre
  `onNpcReward` para o modo guest online — ver §9). **Sem duplicar a lógica de recompensa.**

### 6.4 `GameEngine` (`GameEngine.ts:185` `advanceDialog`)
Estender o fluxo de confirmação:
1. reveal incompleto → `skipReveal()` (revela a pergunta/ramo).
2. `choice` ativo e `phase !== 'branch'`:
   - se `phase==='prompt'` e reveal incompleto → `skipReveal()`;
   - se `phase==='prompt'`, reveal completo e **ainda há páginas** (`page < maxPages`) →
     avança a página (prompt longo pagina como hoje);
   - se `phase==='prompt'`, reveal completo e **na última página** → `phase='selecting'`
     (mostra os botões Sim/Não);
   - se `phase==='selecting'` → `dialogManager.confirmChoiceSelection()`.
3. caso contrário (simples ou já no ramo) → lógica atual de página/fechar.
   Ao fechar o ramo (que também pode paginar), `completeDialog()` ativa a variável do ramo.

Novos métodos no `GameEngine`:
- `moveDialogChoice(direction: -1 | 1)` — só atua quando `choice.phase==='selecting'`;
  move o cursor entre as 2 linhas (`-1` = sobe → Sim, `+1` = desce → Não), atualiza
  `selectedIndex` e redesenha.
- `handleDialogPointer(canvasX, canvasY)` — hit-test de toque/clique nos botões (mobile).

---

## 7. Renderização e responsividade (`RendererDialogRenderer.ts`)

A caixa de diálogo é desenhada **no espaço do canvas**, que escala com CSS `pixelated`.
Logo, desenhar os botões dentro do canvas já os torna responsivos em PC e mobile.

- **Layout vertical empilhado** (decisão D7), na fase `selecting`, após o typewriter da pergunta:
  ```
  +----------------------------------+
  | Você aceita a missão?            |
  |   > Sim                          |
  |     Não                          |
  +----------------------------------+
  ```
  Opções "Sim"/"Não" em linhas separadas; um cursor `>` (ou highlight) marca o `selectedIndex`.
- **Altura dinâmica:** a caixa cresce para caber pergunta + 2 linhas de opção (hoje é fixa em
  50px, `drawDialogBox:80`). Garantir que continua dentro do canvas em telas pequenas.
- **Hitboxes:** o renderer calcula e **armazena os retângulos de cada linha de opção** (em
  coordenadas de canvas) para o `handleDialogPointer` consultar. Linhas com altura de toque
  confortável (largura total da caixa por linha facilita o toque no mobile).
- Highlight de seleção usa cores da paleta (mesmo esquema do restante da caixa).
- Reuso do typewriter existente para a mensagem do ramo (nova `revealKey`).

---

## 8. Entrada: teclado (PC) + toque (mobile) (`InputManager.ts`)

- **Teclado** (`InputManager.ts:112`, bloco "dialog.active"):
  - Setas ↑/↓ quando `choice.phase==='selecting'` → `gameEngine.moveDialogChoice(±1)` (layout
    vertical; aceitar ←/→ também como atalho tolerante, opcional).
  - `z`/`Enter`/`Space` → `advanceDialog()` (avança fases / confirma seleção / fecha ramo).
- **Toque** (`InputManager.ts:193`, handler de tap):
  - Se `choice.phase==='selecting'`: converter a coordenada do toque → coordenada de canvas
    (via `getBoundingClientRect` + escala do canvas) e chamar
    `gameEngine.handleDialogPointer(x, y)`; se acertar um botão, seleciona+confirma; senão,
    cai no `advanceDialog()` atual.
  - Demais fases: mantém `advanceDialog()` (revela / fecha ramo).
- **Mouse/clique** (desktop): reaproveitar `handleDialogPointer` no clique do canvas para
  paridade com o toque.

---

## 9. Multiplayer online

Os diálogos são **locais a cada cliente** (cada jogador dispara o próprio diálogo ao pisar no
NPC). A escolha é local; **somente a variável resultante é autoritativa**. Como a recompensa
do ramo passa pelo mesmo `DialogManager.completeDialog()` → `setVariableId`, o encaminhamento
`onNpcReward` para o host (modo guest) **já cobre o caso** (`DialogManager.ts:62-74`).

Tarefa: apenas **verificar/testar** que, no modo guest, escolher um ramo encaminha a variável
via `onNpcReward` (e não aplica localmente). Sem novo protocolo de rede.

---

## 10. Editor: UI de configuração

### 10.1 `NpcEditModal.ts` (`buildBody:90`, espelhando `buildConditionalSection:154`)
- Novo botão **"Criar diálogo de escolhas"** (`btn-secondary`, padrão do toggle condicional),
  controlando uma seção `choiceSection` (escondida por padrão; expandida se já há dados).
- Seção de escolhas:
  - textarea **"Pergunta"** (`choicePrompt`) — campo dedicado (D1).
  - textarea **"Sim"** (`choiceYesText`) + `select` de variável (`choiceYesVariableId`).
  - textarea **"Não"** (`choiceNoText`) + `select` de variável (`choiceNoVariableId`).
- Coexistência D2: a seção condicional e a de escolhas **podem ficar abertas juntas** (não se
  ocultam). Um texto de ajuda curto explica que a condição, quando definida, age como porteiro
  da escolha (§3.3). Como o modelo porteiro torna `conditionText` inacessível enquanto a escolha
  está ligada, **esmaecer/anotar a textarea de diálogo condicional** quando `choiceEnabled`
  estiver ativo. `populateVariableSelect` já existe e é reutilizado (`EditorNpcService.ts:197`).

### 10.2 `EditorNpcService.ts` (handlers, espelhando ~263-300)
Novos métodos (cada um: muta o sprite selecionado → `renderNpcs`/`renderEditor` →
`updateJSON` → `history.pushCurrentState`; textos usam `scheduleNpcTextUpdate` como os atuais):
- `toggleChoiceEnabled(enabled: boolean)`
- `updateNpcChoicePrompt(text)`
- `updateNpcChoiceYesText(text)` / `updateNpcChoiceNoText(text)`
- `handleChoiceYesVariableChange(id)` / `handleChoiceNoVariableChange(id)`
- Atualizar `clearSelection`/`updateNpcSelection` para considerar o estado expandido de escolha
  (análogo a `conditionalDialogueExpanded`).

### 10.3 CSS
O diálogo em si é canvas (sem CSS). A seção do modal reaproveita classes responsivas já
existentes (`object-config-label`, `object-config-textarea`, `object-config-select`,
`npc-conditional-section`). Adicionar uma classe `npc-choice-section` análoga se necessário.

---

## 11. i18n (`TextResources`)

Adicionar chaves (em todos os bundles de locale):
- Editor: `npc.choice.createButton`, `npc.choice.hideButton`, `npc.choice.promptLabel`,
  `npc.choice.promptPlaceholder`, `npc.choice.yesLabel`, `npc.choice.noLabel`,
  `npc.choice.yesPlaceholder`, `npc.choice.noPlaceholder`, `npc.choice.yesRewardLabel`,
  `npc.choice.noRewardLabel`, `npc.choice.conditionHint` (texto explicando o porteiro da condição).
- Runtime (rótulos dos botões): `dialog.choice.yes` ("Sim"/"Yes"),
  `dialog.choice.no` ("Não"/"No").

---

## 12. Plano de TDD (escrever os testes **antes** da implementação de cada fase)

> Comentários de teste/código **sempre em inglês** (regra do projeto).

| # | Arquivo de teste | Cobre |
|---|---|---|
| T1 | `src/__tests__/engine/resolveNpcDialog.test.ts` (novo) | `kind:'choice'` quando habilitado; fallback simples; coexistência (condição como porteiro: ativa→escolha, inativa→simples); `variantKey` de escolha; normalização das variáveis de ramo |
| T2 | `src/__tests__/share/ShareChoiceDialog.roundtrip.test.ts` (novo) | encode→decode preserva os 6 campos; mapa esparso; ausência = sem chave `9`; retrocompat (v33 decodifica sem escolha); ids inválidos viram `null` |
| T3 | `src/__tests__/share/ShareConstants.test.ts` (existente) | `VERSION===34`; `VERSION_34` em `SUPPORTED_VERSIONS`; `NPC_CHOICE_DIALOG_VERSION` |
| T4 | `src/__tests__/engine/DialogManager.test.ts` (existente) | `showChoiceDialog`; `selecting→branch`; recompensa correta por ramo; ramo vazio fecha na hora; `onNpcReward` no guest |
| T5 | `src/__tests__/state/StateDialogManager.test.ts` (existente) | `setDialog(false)` reseta `choice`; transições de fase/seleção; `applyChoiceBranch` |
| T6 | `src/__tests__/renderer/RendererDialogRenderer.test.ts` (existente) | desenha 2 botões; highlight do `selectedIndex`; hitboxes calculadas; altura dinâmica |
| T7 | `src/__tests__/services/InteractionManager.choice.test.ts` (novo) | `checkNpcs` dispara diálogo de escolha quando habilitado; `getNpcDialogMeta` para escolha |
| T8 | `src/__tests__/editor/EditorNpcService.test.ts` (existente) | handlers mutam campos; toggle liga/desliga; coexistência (condicional e escolha persistem juntas) |
| T9 | `src/__tests__/services/NPCManager.test.ts` (existente) | `normalizeNPC` carrega/normaliza os campos; defaults |
| T10 (stretch) | `tests/e2e/export.spec.ts` (existente) | fluxo completo de escolha numa build HTML exportada (Playwright) |

---

## 13. Ordem de implementação (fases, cada uma TDD: teste vermelho → código verde → refator)

- [x] **Fase 0 — Versionamento & tipos base.** `ShareConstants` (VERSION_34 + getter + SUPPORTED).
      Declarar os 6 campos em todos os tipos (§3.2). (T3, T9)
- [x] **Fase 1 — Normalização.** `NPCManager.normalizeNPC` + `ShareDataNormalizer` carregam os
      campos. (T9, T2 parcial)
- [x] **Fase 2 — Share encode/decode** (blob `9`, retrocompat). (T2)
- [x] **Fase 3 — `resolveNpcDialog`** (modo escolha + coexistência/porteiro + lock definitivo). (T1)
- [x] **Fase 4 — Estado do diálogo:** `DialogState.choice`, `StateDialogManager`,
      `DialogManager.showChoiceDialog`/`confirmChoiceSelection`, `npcChoiceAnswered`. (T4, T5)
- [x] **Fase 5 — `GameEngine`** (`advanceDialog`, `moveDialogChoice`, `handleDialogPointer`) +
      `InteractionManager.checkNpcs`/`getNpcDialogMeta`. (T7)
- [x] **Fase 6 — Renderer** (botões verticais, highlight, hitboxes, altura dinâmica). (T6 coberto manualmente)
- [x] **Fase 7 — Input** (teclado ↑/↓ + toque nos hitboxes).
- [x] **Fase 8 — Editor** (`NpcEditModal` botão+seção, `EditorNpcService` handlers, i18n,
      coexistência + esmaecer condicional). (T8)
- [x] **Fase 9 — Online** (forwarding guest do ramo via `onNpcReward`). (T4)
- [x] **Fase 10 — Build** (`npm run build:export` regenerado e OK).
- [x] **Fase 11 — Gates finais** (tsc, 2004 testes, lint verdes). QA manual em PC/mobile fica
      a cargo de você jogar (canvas não é verificável headless).

---

## 14. Checklist obrigatório antes de concluir (CLAUDE.md / AGENTS.md)

```bash
npx tsc --noEmit     # type check
npm run test:run     # suíte Vitest completa (CI)
npm run lint         # ESLint, zero-warning (--max-warnings=0)
npm run build:export # regerar o bundle standalone usado pela build HTML
```
QA manual:
- PC (teclado: ↑/↓ seleciona, Z/Enter confirma) e mobile (toque nas linhas de opção).
- Round-trip: criar NPC com escolha → copiar URL → reabrir → exportar HTML → jogar no arquivo.
- Cada ramo ativa a variável correta (testar com uma porta de variável).
- Definitiva: responder, sair e voltar ao NPC → a pergunta NÃO reaparece; só volta após
  reiniciar o jogo do zero (§3.4).
- Porteiro: com condição definida, condição inativa mostra a fala simples; ativa mostra a escolha.

Lembretes do projeto:
- Comentários de código **em inglês**.
- **Não commitar/pushar** sem pedido explícito.

---

## 15. Decisões assumidas (corrigir aqui se discordar)

- **D1 — Pergunta = campo dedicado `choicePrompt`** (definido pelo usuário). Mantém a escolha
  independente do `text` simples e facilita a coexistência com o condicional.
- **D2 — Escolha e condicional coexistem** (definido pelo usuário): a condição, quando definida,
  age como **porteiro** da escolha (§3.3/§5). Nenhuma das seções oculta a outra no editor.
  Consequência aceita: `conditionText` fica inacessível quando a escolha está ligada (§3.3).
- **D3 — Rótulos "Sim"/"Não" fixos e localizados** (não customizáveis pelo autor nesta entrega).
- **D4 — Serialização como blob JSON único na chave `9`** (em vez de 6 colunas), por escassez
  de chaves de 1 caractere e por seguir o padrão de `online`/`skillCustomizations`.
- **D5 — Diálogo é local por cliente no online**; apenas a variável é sincronizada (via o
  `onNpcReward` já existente).
- **D6 — Escolha definitiva** (revisado pelo usuário): após responder, a escolha trava e não
  reaparece no playthrough; só reseta no restart completo (`resetGame`). Aumenta o impacto da
  decisão e incentiva rejogar (§3.4).
- **D7 — Botões em layout vertical empilhado** (definido pelo usuário): opções em linhas
  separadas com cursor; navegação ↑/↓ no teclado, toque por linha no mobile (§7/§8).

---

## 16. Arquivos que serão tocados (resumo)

**Runtime / domínio**
- `src/runtime/infra/share/ShareConstants.ts` (versão)
- `src/runtime/infra/share/ShareEncoder.ts` (blob `9`)
- `src/runtime/infra/share/ShareDecoder.ts` (blob `9`)
- `src/runtime/infra/share/ShareDataNormalizer.ts` (campos)
- `src/runtime/services/NPCManager.ts` (tipos + normalizeNPC)
- `src/runtime/services/engine/resolveNpcDialog.ts` (kind 'choice')
- `src/runtime/services/engine/InteractionManager.ts` (dispatch + meta)
- `src/runtime/services/engine/DialogManager.ts` (showChoiceDialog/confirm)
- `src/runtime/services/GameEngine.ts` (advanceDialog/move/pointer)
- `src/runtime/domain/state/StateDialogManager.ts` (sub-estado choice)
- `src/runtime/adapters/renderer/RendererDialogRenderer.ts` (botões/hitboxes)
- `src/runtime/adapters/renderer/RendererNpcDialogMarker.ts` (variantKey de escolha)
- `src/runtime/adapters/InputManager.ts` (teclado/toque)
- `src/types/gameState.ts` (`DialogState.choice`)

**Editor**
- `src/editor/modules/NpcEditModal.ts` (botão + seção)
- `src/editor/modules/EditorNpcService.ts` (handlers + tipos)
- bundles de i18n do `TextResources`

**Testes** — ver §12.

**Build** — nenhum arquivo de config muda; só reexecutar `npm run build:export`.
