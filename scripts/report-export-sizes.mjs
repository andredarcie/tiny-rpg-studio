import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = path.join(root, 'public');
const [runtimeJavaScript, css, font] = await Promise.all([
    fs.readFile(path.join(publicDirectory, 'export.bundle.js'), 'utf8'),
    fs.readFile(path.join(publicDirectory, 'tiny-rpg-studio-sdk.css'), 'utf8'),
    fs.readFile(path.join(publicDirectory, 'pixel-operator.woff')),
]);

const server = await createServer({
    appType: 'custom',
    configFile: false,
    root,
    server: { middlewareMode: true },
});

try {
    const [{ assembleExportHtml, createExportGameMarkup }, { ShareUtils }] = await Promise.all([
        server.ssrLoadModule('/src/editor/modules/export/ExportHtmlAssembler.ts'),
        server.ssrLoadModule('/src/runtime/infra/share/ShareUtils.ts'),
    ]);
    const baseGame = {
        author: 'Tiny RPG Studio',
        height: 8,
        player: { x: 1, y: 1, roomIndex: 4 },
        tileMap: {
            ground: Array.from({ length: 9 }, () =>
                Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0))),
            overlay: Array.from({ length: 9 }, () =>
                Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null))),
        },
        title: 'Fixture',
        width: 8,
        world: { cols: 3, rows: 3 },
    };
    const fixtures = {
        minimal: baseGame,
        typical: {
            ...baseGame,
            enemies: [
                { damage: 1, lives: 2, roomIndex: 4, type: 'bandit', x: 5, y: 5 },
                { damage: 2, lives: 4, roomIndex: 5, type: 'dark-knight', x: 3, y: 2 },
            ],
            items: [
                { roomIndex: 4, type: 'key', x: 2, y: 2 },
                { roomIndex: 5, type: 'life-potion', x: 4, y: 6 },
            ],
            npcs: [
                {
                    choices: {
                        no: { text: 'Come back later.' },
                        prompt: 'Will you help?',
                        yes: { text: 'Thank you!' },
                    },
                    name: 'Guide',
                    roomIndex: 4,
                    text: 'Welcome to the adventure.',
                    type: 'old-mage',
                    x: 3,
                    y: 3,
                },
            ],
            objects: [
                { roomIndex: 4, type: 'door', x: 6, y: 4 },
                { roomIndex: 5, type: 'chest', x: 2, y: 6 },
            ],
            title: 'Typical fixture',
        },
        large: {
            ...baseGame,
            customSprites: Object.fromEntries(
                Array.from({ length: 40 }, (_, index) => [
                    `tile:${index}`,
                    Array.from({ length: 8 }, (_row, y) =>
                        Array.from({ length: 8 }, (_column, x) => (x + y + index) % 16)),
                ]),
            ),
            customTileEffects: Array.from({ length: 16 }, (_, index) => ({
                baseEffectIds: ['caustic', 'glow', 'sparkle'],
                color: `#${index.toString(16).padStart(2, '0')}AAFF`,
                id: `custom:${index}`,
                name: `Effect ${index}`,
            })),
            npcs: Array.from({ length: 32 }, (_, index) => ({
                name: `NPC ${index}`,
                roomIndex: index % 9,
                text: `A representative dialog line for fixture character ${index}.`,
                type: 'villager-man',
                x: index % 8,
                y: (index * 3) % 8,
            })),
            title: 'Large fixture',
        },
    };
    const fontDataUrl = `data:font/woff;base64,${font.toString('base64')}`;
    const rows = Object.entries(fixtures).map(([name, game]) => {
        const gameCode = ShareUtils.encode(game);
        const result = assembleExportHtml({
            css,
            editableInStudio: true,
            fontDataUrl,
            gameCode,
            gameMarkup: createExportGameMarkup({ reset: 'Restart game' }),
            locale: 'en-US',
            openStudioLabel: 'Open Studio',
            runtimeJavaScript,
            title: game.title,
        });
        return { fixture: name, ...result.sections };
    });
    console.table(rows);
} finally {
    await server.close();
}
