# tiny-rpg-studio-sdk — Hello World

Exemplos de uso do SDK para criar jogos RPG e gerar URLs jogáveis.

## Instalação

```bash
cd examples/hello-world
npm install
```

> **Nota:** O `npm install` usa `file:../..` que aponta para o pacote local.
> Antes de rodar, certifique-se de ter feito o build do SDK:
>
> ```bash
> # Na raiz do repositório
> npm run build:sdk
> ```

---

## Exemplos disponíveis

### Hello World (`hello-world.mjs`)

Exemplo mínimo: 2 salas, 1 inimigo, 1 NPC, chave e fim de jogo.

```bash
node hello-world.mjs
```

### Advanced (`advanced.mjs`)

Demonstra todos os recursos do SDK:
- Paleta customizada
- 6 salas com inimigos de tipos diferentes
- NPCs com diálogo
- Todos os itens (chave, porta, poção, espadas de 3 tiers, fim)

```bash
node advanced.mjs
```

---

## Como funciona

```js
import { TinyRPG } from 'tiny-rpg-studio-sdk';

const game = new TinyRPG()
  .setTitle('Meu RPG')
  .setAuthor('Você')
  .setPlayerStart({ x: 1, y: 1, room: 0 });

game.room(0)
  .ground([
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ])
  .addEnemy({ type: 'skeleton', x: 3, y: 3 })
  .addNPC({ type: 'villager-man', x: 2, y: 2, text: 'Ola!' })
  .addKey({ x: 6, y: 6 });

game.room(8)
  .addEnd({ x: 4, y: 4, message: 'Você venceu!' });

const url = game.buildURL();
// https://andredarcie.github.io/tiny-rpg-studio/#v25.g...
```

---

## API resumida

### `new TinyRPG()`

| Método | Descrição |
|---|---|
| `.setTitle(text)` | Título do jogo (máx. 80 chars) |
| `.setAuthor(text)` | Nome do autor (máx. 60 chars) |
| `.setPlayerStart({ x, y, room })` | Posição inicial do jogador |
| `.setPalette(colors)` | 16 cores `#RRGGBB` |
| `.hideHUD()` | Esconde a interface |
| `.room(index)` | Retorna o `RoomBuilder` da sala `index` (0–8) |
| `.buildURL()` | Gera a URL jogável |
| `.toShareCode()` | Retorna apenas o código hash |
| `.toSharePayload()` | Retorna o objeto de dados brutos |

### `room(i)` — `RoomBuilder`

| Método | Descrição |
|---|---|
| `.ground(matrix)` | Matriz 8×8 de tiles do chão |
| `.overlay(matrix)` | Matriz 8×8 de tiles de sobreposição |
| `.addEnemy({ type, x, y })` | Adiciona inimigo (máx. 9 por sala) |
| `.addNPC({ type, x, y, text? })` | Adiciona NPC com diálogo opcional |
| `.addKey({ x, y })` | Adiciona chave (único por sala) |
| `.addDoor({ x, y })` | Adiciona porta (único por sala) |
| `.addPotion({ x, y })` | Adiciona poção de vida (único por sala) |
| `.addSword({ x, y, tier? })` | `'wood'`, `'bronze'`, `'iron'` (padrão) |
| `.addEnd({ x, y, message? })` | Adiciona tela de fim de jogo |

### Tipos de inimigo (`EnemyType`)
`giant-rat` · `bandit` · `skeleton` · `dark-knight` · `necromancer` · `dragon` · `fallen-king` · `ancient-demon`

### Tipos de NPC (`NpcType`)
`old-mage` · `villager-man` · `villager-woman` · `child` · `king` · `knight` · `thief` · `blacksmith`
+ variantes `-elf` e `-dwarf` para cada um acima
+ `thought-bubble` · `wooden-sign`
