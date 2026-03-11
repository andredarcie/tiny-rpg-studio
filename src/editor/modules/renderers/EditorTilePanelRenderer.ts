
import { EditorRendererBase } from './EditorRendererBase';
import { CustomSpriteLookup } from '../../../runtime/domain/sprites/CustomSpriteLookup';
import type { CustomSpriteEntry } from '../../../types/gameState';

type TileDefinitionView = {
    id: number | string;
    name?: string;
    category?: string;
};

class EditorTilePanelRenderer extends EditorRendererBase {
    renderTileList(): void {
        const tileList = this.dom.tileList;
        if (!tileList) return;

        const tiles = this.gameEngine.getTiles() as TileDefinitionView[];
        const groups = new Map<string, TileDefinitionView[]>();
        tiles.forEach((tile: TileDefinitionView) => {
            const category = tile.category || 'Diversos';
            if (!groups.has(category)) {
                groups.set(category, []);
            }
            groups.get(category)?.push(tile);
        });

        const categoryOrder = ['Terreno', 'Natureza', 'Agua', 'Construcoes', 'Interior', 'Decoracao', 'Objetos', 'Diversos'];
        const categories = Array.from(groups.keys()).sort((a, b) => {
            const ia = categoryOrder.indexOf(a);
            const ib = categoryOrder.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });

        const orderedTiles: TileDefinitionView[] = [];
        categories.forEach((category: string) => {
            const categoryTiles = groups.get(category) || [];
            categoryTiles.forEach((tile: TileDefinitionView) => orderedTiles.push(tile));
        });

        tileList.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'tile-grid';

        const game = (this.gameEngine as unknown as { getGame?(): { customSprites?: CustomSpriteEntry[] } }).getGame?.();
        const customSprites = game?.customSprites;

        orderedTiles.forEach((tile: TileDefinitionView) => {
            const card = document.createElement('div');
            card.className = 'tile-card';
            card.dataset.tileId = String(tile.id);
            if (tile.id === this.manager.selectedTileId) {
                card.classList.add('selected');
            }

            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.className = 'tile-card-select';

            const preview = document.createElement('canvas');
            preview.width = 64;
            preview.height = 64;
            const ctx = preview.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = false;
                this.gameEngine.renderer.drawTileOnCanvas(preview, tile);
            }

            selectBtn.appendChild(preview);
            card.appendChild(selectBtn);

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'sprite-edit-btn';
            editBtn.dataset.editGroup = 'tile';
            editBtn.dataset.editKey = String(tile.id);
            editBtn.textContent = '✎';
            const isCustom = CustomSpriteLookup.find(customSprites, 'tile', String(tile.id)) !== null;
            if (isCustom) {
                editBtn.classList.add('is-custom');
            }
            card.appendChild(editBtn);

            grid.appendChild(card);
        });

        tileList.appendChild(grid);
    }

    updateSelectedTilePreview(): void {
        const preview = this.dom.selectedTilePreview;
        const tile = (this.gameEngine.getTiles() as TileDefinitionView[]).find((entry) => entry.id === this.manager.selectedTileId);
        if (!preview || !tile) return;
        if (preview instanceof HTMLCanvasElement) {
            this.gameEngine.renderer.drawTileOnCanvas(preview, tile);
        }
        if (this.dom.tileSummary) {
            this.dom.tileSummary.textContent = tile.name || this.tf('tiles.summaryFallback', { id: tile.id });
        }
    }
}

export { EditorTilePanelRenderer };
