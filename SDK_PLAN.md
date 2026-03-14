# Plano: tiny-rpg-studio-sdk - pacote npm

## Contexto

O Tiny RPG Maker tem infraestrutura de serializacao pronta (ShareEncoder, ShareDecoder, ShareUrlHelper).
O objetivo e expor uma API builder fluente que produza o payload correto para o ShareEncoder e gere uma URL jogavel.

URL gerada:  https://andredarcie.github.io/tiny-rpg-studio/#v25.g...

Zero modificacoes ao codigo existente. O SDK e uma camada nova em cima da infra de share.

---

## Tipos validos

### Inimigos (EnemyDefinitions.ts:13-111)
  'giant-rat' | 'bandit' | 'skeleton' | 'dark-knight' |
  'necromancer' | 'dragon' | 'fallen-king' | 'ancient-demon'

### NPCs (NPCDefinitions.ts:14-295)
  'old-mage' | 'villager-man' | 'villager-woman' | 'child' |
  'king' | 'knight' | 'thief' | 'blacksmith' |
  e variantes -elf e -dwarf de cada um, mais 'thought-bubble' | 'wooden-sign'

### Objetos suportados na Fase 1 (itemTypes.ts)
  'key'          -> addKey()           (unico por sala)
  'door'         -> addDoor()          (unico por sala)
  'life-potion'  -> addPotion()        (unico por sala)
  'sword'        -> addSword()         (unico por sala)
  'sword-bronze' -> addSword({tier:'bronze'})
  'sword-wood'   -> addSword({tier:'wood'})
  'player-end'   -> addEnd()           (unico por sala)

### Objetos NAO suportados na Fase 1
  'door-variable', 'switch', 'xp-scroll'

---

## Regras de validacao (fail fast, executadas no momento da chamada)

  Regra                          | Fonte no codec
  -------------------------------|-------------------------------------------
  x em [0, MATRIX_SIZE-1]        | SharePositionCodec.ts:13-14
  y em [0, MATRIX_SIZE-1]        | SharePositionCodec.ts:13-14
  roomIndex em [0, MAX_ROOM_INDEX]| SharePositionCodec.ts:12
  tipo inimigo na lista valida   | EnemyDefinitions / ShareDataNormalizer
  tipo NPC na lista valida       | NPCDefinitions / ShareDataNormalizer.ts:129-177
  max 9 inimigos por sala        | ShareDataNormalizer.ts:205-208
  key unica por sala             | ShareDataNormalizer.ts:212-231
  door unica por sala            | ShareDataNormalizer.ts:212-231
  life-potion unica por sala     | ShareDataNormalizer.ts:212-231
  sword* unico por sala          | ShareDataNormalizer.ts:212-231
  player-end unico por sala      | ShareDataNormalizer.ts:363-388
  ground deve ser MATRIX_SIZE x MATRIX_SIZE | (normalizacao silenciosa evitada)
  palette: 16 strings '#RRGGBB'  | (normalizacao silenciosa evitada)
  title max 80 chars             | ShareEncoder.ts:437 (trunca silenciosamente)
  author max 60 chars            | ShareEncoder.ts:441 (trunca silenciosamente)

Constantes usadas (nunca hardcoded no SDK):
  ShareConstants.MATRIX_SIZE         (ShareConstants.ts:116)
  ShareConstants.MAX_ROOM_INDEX      (ShareConstants.ts:136)
  ShareConstants.WORLD_ROOM_COUNT    (ShareConstants.ts:132)

---

## Problema critico: tileset.maps indexado por posicao

ShareMatrixCodec (ShareMatrixCodec.ts:61-80) itera de 0 ate WORLD_ROOM_COUNT-1
e le maps[index]?.ground. O builder usa Map<number,RoomBuilder> e monta assim:

  const count = ShareConstants.WORLD_ROOM_COUNT;
  const maps = Array.from({ length: count }, (_, i) => {
    const rb = this._rooms.get(i);
    return rb ? rb._getTileData() : {};
  });

---

## Arquivos a criar

### 1. src/sdk/types.ts
  SdkObject (union dos 7 tipos suportados com campos corretos)
  EnemyType (union dos 8 tipos)
  NpcType (union completa dos NPCs)

  // Shape exato de sprite (NPC) para o ShareEncoder
  type SdkSprite = {
    type: string;       // NpcType valido
    x: number;         // [0, MATRIX_SIZE-1]
    y: number;         // [0, MATRIX_SIZE-1]
    roomIndex: number; // [0, MAX_ROOM_INDEX]
    text: string;      // dialog (vazio se nao informado)
    placed: boolean;   // sempre true quando vindo do builder
  };

  // Shape exato de enemy para o ShareEncoder
  type SdkEnemy = {
    type: string;       // EnemyType valido
    x: number;         // [0, MATRIX_SIZE-1]
    y: number;         // [0, MATRIX_SIZE-1]
    roomIndex: number; // [0, MAX_ROOM_INDEX]
  };

  // Payload completo para ShareEncoder
  type SdkSharePayload = {
    title?: string;    // max 80 chars (ShareEncoder.ts:437)
    author?: string;   // max 60 chars (ShareEncoder.ts:441)
    hideHud?: boolean;
    start?: { x: number; y: number; roomIndex: number };
    sprites?: SdkSprite[];
    enemies?: SdkEnemy[];
    objects?: SdkObject[];
    tileset?: { maps: Array<{ ground?: number[][]; overlay?: (number | null)[][] }> };
    customPalette?: string[]; // 16 strings '#RRGGBB'
  };

### 2. src/sdk/RoomBuilder.ts
  Metodos publicos: ground, overlay, addEnemy, addNPC, addKey,
    addDoor, addPotion, addSword, addEnd (todos retornam this)
  Internos: _getTileData(), _getEntities(roomIndex)
  Validacao: all rules acima, executadas imediatamente em cada metodo

### 3. src/sdk/TinyRPGBuilder.ts
  _rooms: Map<number, RoomBuilder>
  setTitle, setAuthor, hideHUD, setPlayerStart, setPalette
  room(index): RoomBuilder  (valida index, lazy-create)
  toSharePayload(): SdkSharePayload
  toShareCode(): string
  buildURL(baseUrl?: string): string

### 4. src/sdk/index.ts
  Exports publicos: TinyRPG (alias de TinyRPGBuilder), RoomBuilder,
    EnemyType, NpcType, SdkSharePayload

---

## Arquivos de build a criar

  vite.sdk.config.ts  - entry: src/sdk/index.ts, formats: es+cjs, outDir: dist/sdk
  tsconfig.sdk.json   - declaration: true, emitDeclarationOnly: true, outDir: dist/sdk

---

## Mudancas em package.json

  - Remover "private": true
  - "name": "tiny-rpg-studio-sdk"
  - "version": "1.0.0"
  - "files": ["dist/sdk"]          <- so empacota o build, nada de src/ ou docs/
  - "exports": { ".": { "import", "require", "types" } }
  - script "build:sdk"

---

## Verificacao

1. npm run build:sdk     -> dist/sdk/ sem erros de tipo
2. npm pack --dry-run    -> lista apenas dist/sdk/* (confirma "files")
3. npm link + npm link tiny-rpg-studio-sdk em projeto cliente
4. Rodar exemplo, abrir URL: mapa, skeleton, NPC, fim de jogo na sala 8
5. Testes src/__tests__/sdk/TinyRPGBuilder.test.ts:
   - tileset.maps.length === ShareConstants.WORLD_ROOM_COUNT
   - room(-1) lanca Error
   - room(MAX_ROOM_INDEX + 1) lanca Error
   - addEnemy({ type: 'invalid' }) lanca Error
   - addEnemy com x fora do range lanca Error
   - addKey() duas vezes na mesma sala lanca Error
   - addEnemy 10 vezes na mesma sala lanca Error no decimo
   - buildURL() gera URL decodificavel via ShareDecoder
   - title e skeleton presentes no decoded payload

---

## Ordem de implementacao

1. src/sdk/types.ts
2. src/sdk/RoomBuilder.ts
3. src/sdk/TinyRPGBuilder.ts
4. src/sdk/index.ts
5. vite.sdk.config.ts
6. tsconfig.sdk.json
7. Atualizar package.json
8. Testes em src/__tests__/sdk/
9. npm run build:sdk
10. npm pack --dry-run
11. npm publish
