import type { GameEngine } from '../GameEngine';
import type { GameplayCell, GameplayPixels, GameplayScene, GameplayTile } from '../../adapters/renderer/GameplayPresentation';

export function buildGameplayScene(engine: GameEngine): GameplayScene {
    const { gameState, tileManager, renderer, movementManager } = engine;
    const game = gameState.getGame();
    const size = game.roomSize;
    const { rows, cols } = game.world;
    const width = cols * size;
    const height = rows * size;
    const player = gameState.getPlayer() ?? game.start;
    const palette = renderer.paletteManager;
    const cells: GameplayCell[] = Array.from({ length: width * height });
    const textures = new Map<string | number, GameplayPixels | null>();
    const cutouts = new Map<string | number, boolean>();
    const copyPixels = (frame: readonly (readonly (string | null)[])[]): GameplayPixels =>
        frame.map(row => row.map(color => color === 'transparent' ? null : color));
    const isLiquid = (id: string | number | null): boolean => {
        if (id === null) return false;
        const effect = tileManager.getTileVisualEffect(id);
        return effect === 'water' || effect === 'lava';
    };
    const pixels = (id: string | number | null): GameplayPixels | null => {
        if (id === null) return null;
        if (!textures.has(id)) {
            const tile = tileManager.getTile(id);
            const frame = tile ? tileManager.getTilePixels(tile) : null;
            textures.set(id, frame ? copyPixels(frame) : null);
        }
        return textures.get(id) ?? null;
    };
    const isCutout = (id: string | number | null): boolean => {
        if (id === null) return false;
        if (!cutouts.has(id)) {
            const tile = tileManager.getTile(id);
            const frames = tile?.frames?.length ? tile.frames : tile?.pixels ? [tile.pixels] : [];
            cutouts.set(id, pixels(id)?.some(row => row.includes(null)) === true
                || frames.some(frame => frame.some(row => row.includes('transparent'))));
        }
        return cutouts.get(id) === true;
    };
    const entities = renderer.entityRenderer.getPresentationEntities(cols, size);
    const blockers = new Map(game.objects.filter(object => movementManager.isPresentationBlocker(object))
        .map(object => [`${object.roomIndex}:${object.x}:${object.y}`, object]));
    for (let index = 0; index < rows * cols; index++) {
        const room = game.rooms.at(index);
        const map = tileManager.getTileMap(index);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const ground = map.ground[y]?.[x] ?? null;
            const overlay = map.overlay[y]?.[x] ?? null;
            const blockedTiles = [overlay, ground].filter(id => id !== null && !movementManager.canTraverseCollisionTile(tileManager.getTile(id)));
            const wallTile = blockedTiles.find(id => !isLiquid(id) && !isCutout(id));
            const liquidOverlay = isLiquid(overlay);
            const groundBillboard = ground !== null && !isLiquid(ground) && isCutout(ground)
                && tileManager.getTile(ground)?.collision === true && !room?.walls[y]?.[x];
            const worldX = (index % cols) * size + x;
            const worldY = Math.floor(index / cols) * size + y;
            const blocker = blockers.get(`${index}:${x}:${y}`);
            const wall = pixels(wallTile ?? (room?.walls[y]?.[x] ? overlay ?? ground : null));
            const solid = !room || Boolean(room.walls[y]?.[x] || wallTile !== undefined);
            cells[worldY * width + worldX] = {
                solid, blocked: solid || blockedTiles.length > 0 || Boolean(blocker), wall,
                floor: pixels(liquidOverlay ? overlay : groundBillboard ? null : ground), color: palette.getColor(room?.tiles[y]?.[x] ?? room?.bg ?? 0),
                groundTileId: ground, overlayTileId: overlay, terrainWall: Boolean(room?.walls[y]?.[x]),
                roomIndex: index, localX: x, localY: y,
            };
            if (groundBillboard) {
                const sprite = pixels(ground);
                if (sprite) entities.push({ id: `tile-ground-${index}-${x}-${y}`, key: `tile-ground-${index}-${x}-${y}`,
                    kind: 'tile', type: String(ground), roomIndex: index, localX: x, localY: y,
                    x: worldX + 0.5, y: worldY + 0.5, pixels: sprite });
            }
            if (overlay !== null && !liquidOverlay && wallTile !== overlay && !room?.walls[y]?.[x]) {
                const sprite = pixels(overlay);
                if (sprite) entities.push({ id: `tile-${index}-${x}-${y}`, key: `tile-${index}-${x}-${y}`,
                    kind: 'tile', type: String(overlay), roomIndex: index, localX: x, localY: y,
                    x: worldX + 0.5, y: worldY + 0.5, pixels: sprite });
            }
        }
    }
    const tiles: GameplayTile[] = tileManager.getTiles().flatMap(tile => tile.id === undefined ? [] : [{
        id: tile.id, name: tile.name ?? '', category: tile.category ?? '', collision: tile.collision === true,
        visualEffect: tileManager.getTileVisualEffect(tile.id), mergeEdges: tile.mergeEdges === true,
        frames: (tile.frames?.length ? tile.frames : tile.pixels ? [tile.pixels] : []).map(copyPixels), pixels: pixels(tile.id),
    }]);
    const playerPixels = renderer.spriteFactory.getPlayerSprite();
    const livePlayer = gameState.getPlayer();
    return { width, height, cells, entities, tiles,
        world: { rows, cols, roomSize: size, activeRoomIndex: player.roomIndex },
        rooms: Array.from({ length: rows * cols }, (_, index) => ({ index, x: (index % cols) * size,
            y: Math.floor(index / cols) * size, width: size, height: size, exists: Boolean(game.rooms[index]),
            backgroundIndex: game.rooms[index]?.bg ?? 0, background: palette.getColor(game.rooms[index]?.bg ?? 0) })),
        palette: [...palette.getActivePalette()], animationFrame: tileManager.getAnimationFrameIndex(), animationIntervalMs: renderer.tileAnimationInterval,
        customTileEffects: structuredClone(game.customTileEffects ?? []),
        status: { playing: gameState.playing, gameOver: gameState.isGameOver(), dialogActive: gameState.getDialog().active },
        player: { x: (player.roomIndex % cols) * size + player.x + 0.5,
            y: Math.floor(player.roomIndex / cols) * size + player.y + 0.5,
            roomIndex: player.roomIndex, localX: player.x, localY: player.y,
            pixels: playerPixels ? copyPixels(playerPixels) : null,
            facing: livePlayer && livePlayer.x < livePlayer.lastX ? 'left' : 'right',
            lives: livePlayer?.currentLives, maxLives: livePlayer?.maxLives },
        ceiling: palette.getColor(game.rooms[player.roomIndex]?.bg ?? 0), floor: palette.getColor(5), boundary: palette.getColor(1) };
}
