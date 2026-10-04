import { readFileSync, writeFileSync } from 'node:fs';
import { TinyRPG } from 'tiny-rpg-studio-sdk';
import { exportHtml } from 'tiny-rpg-studio-sdk/html';

const game = new TinyRPG().setTitle('SDK Adventure').setAuthor('Example');
const effect = game.createTileEffect('Glow', ['glow']);
game.configureTile(0, { visualEffect: effect, mergeEdges: true });
game.room(0).addNPC({ type: 'old-mage', name: 'Merlin', x: 2, y: 2,
    text: 'Your adventure is complete.', rewardVariable: 'END_GAME', disappearAfterDialog: true });
game.room(0).addExit({ x: 7, y: 7, targetRoomIndex: 8, targetX: 0, targetY: 0 });
const loaded = TinyRPG.fromShareCode(game.toShareCode());
const asset = subpath => new URL(import.meta.resolve(`tiny-rpg-studio-sdk/${subpath}`));
const { html } = exportHtml(loaded.toProjectData(), {
    runtimeJavaScript: readFileSync(asset('runtime.js'), 'utf8'),
    css: readFileSync(asset('styles.css'), 'utf8'),
    fontDataUrl: `data:font/woff;base64,${readFileSync(asset('font.woff')).toString('base64')}`,
});
writeFileSync('sdk-adventure.html', html);
console.log(loaded.buildURL());
