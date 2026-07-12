
import type { EditorManager } from '../EditorManager';

type TileCoord = { x: number; y: number };

class EditorTileService {
    manager: EditorManager;
    private hoverHighlight: HTMLElement | null = null;
    private hoverCursorActive = false;

    constructor(editorManager: EditorManager) {
        this.manager = editorManager;
    }

    get dom() {
        return this.manager.domCache;
    }

    get state() {
        return this.manager.state;
    }

    startPaint(ev: PointerEvent) {
        const canvas = this.dom.editorCanvas;
        if (!canvas) return;
        ev.preventDefault();

        this.clearHover();

        if (this.tryOpenObjectModal(ev)) return;

        this.state.mapPainting = true;
        canvas.setPointerCapture(ev.pointerId);
        this.applyPaint(ev);
    }

    private tryOpenObjectModal(ev: PointerEvent): boolean {
        if (this.isPlacing()) return false;

        const coord = this.getTileFromEvent(ev);
        if (!coord) return false;

        const entity = this.findEntityAt(coord);
        if (!entity) return false;

        entity.open();
        return true;
    }

    /** Locates a placed object/NPC/enemy on the given tile of the active room. */
    private findEntityAt(coord: TileCoord): { open: () => void } | null {
        const roomIndex = this.state.activeRoomIndex;

        const objects = (this.manager.gameEngine.getObjectsForRoom(roomIndex) || []) as Array<{ id?: string; x: number; y: number }>;
        const foundObject = objects.find((o) => o.x === coord.x && o.y === coord.y);
        if (foundObject?.id) {
            const id = foundObject.id;
            return { open: () => this.manager.objectEditModal.open(id) };
        }

        const sprites = (this.manager.gameEngine.getSprites() || []) as Array<{ id?: string; x?: number; y?: number; roomIndex?: number; placed?: boolean }>;
        const foundNpc = sprites.find((s) =>
            s.placed && s.roomIndex === roomIndex && s.x === coord.x && s.y === coord.y
        );
        if (foundNpc?.id) {
            const id = foundNpc.id;
            return { open: () => this.manager.npcEditModal.open(id) };
        }

        const enemies = (this.manager.gameEngine.getActiveEnemies() || []) as Array<{ id?: string; x?: number; y?: number; roomIndex?: number }>;
        const foundEnemy = enemies.find((e) =>
            e.roomIndex === roomIndex && e.x === coord.x && e.y === coord.y
        );
        if (foundEnemy?.id) {
            const id = foundEnemy.id;
            return { open: () => this.manager.enemyEditModal.open(id) };
        }

        return null;
    }

    private isPlacing(): boolean {
        return Boolean(this.state.placingNpc || this.state.placingEnemy || this.state.placingObjectType);
    }

    /**
     * Highlights the hovered tile and shows a pointer cursor when it holds a
     * placed entity, signalling that clicking it opens its edit modal.
     */
    updateHover(ev: PointerEvent) {
        if (this.state.mapPainting || this.isPlacing()) {
            this.clearHover();
            return;
        }
        const coord = this.getTileFromEvent(ev);
        const entity = coord ? this.findEntityAt(coord) : null;
        if (!coord || !entity) {
            this.clearHover();
            return;
        }
        this.showHover(coord);
    }

    private showHover(coord: TileCoord) {
        const canvas = this.dom.editorCanvas;
        if (!canvas) return;

        const highlight = this.getHoverHighlight();
        if (highlight) {
            const size = canvas.offsetWidth || canvas.clientWidth || 0;
            const tile = size / 8;
            highlight.style.width = `${tile}px`;
            highlight.style.height = `${tile}px`;
            highlight.style.left = `${canvas.offsetLeft + coord.x * tile}px`;
            highlight.style.top = `${canvas.offsetTop + coord.y * tile}px`;
            highlight.hidden = false;
        }

        canvas.style.cursor = 'pointer';
        this.hoverCursorActive = true;
    }

    clearHover() {
        if (this.hoverHighlight) this.hoverHighlight.hidden = true;
        if (this.hoverCursorActive) {
            const canvas = this.dom.editorCanvas;
            if (canvas) canvas.style.cursor = '';
            this.hoverCursorActive = false;
        }
    }

    private getHoverHighlight(): HTMLElement | null {
        if (this.hoverHighlight) return this.hoverHighlight;
        const wrapper = this.dom.editorCanvas?.parentElement;
        if (!wrapper) return null;
        const el = document.createElement('div');
        el.className = 'editor-hover-highlight';
        el.hidden = true;
        wrapper.appendChild(el);
        this.hoverHighlight = el;
        return el;
    }

    continuePaint(ev: PointerEvent) {
        if (!this.state.mapPainting) return;
        this.applyPaint(ev);
    }

    finishPaint(ev: PointerEvent) {
        if (!this.state.mapPainting) return;
        this.state.mapPainting = false;
        const canvas = this.dom.editorCanvas;
        if (!canvas) {
            this.state.mapPainting = false;
            return;
        }
        if (canvas.hasPointerCapture(ev.pointerId)) {
            canvas.releasePointerCapture(ev.pointerId);
        }
        if (this.state.skipMapHistory) {
            this.state.skipMapHistory = false;
            return;
        }
        this.manager.renderService.renderEditor();
        // Tile paint changes wall/painted-tile metrics; refresh without rebuilding the world grid.
        this.manager.renderService.renderWorldMetrics();
        this.manager.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    applyPaint(ev: PointerEvent) {
        const coord = this.getTileFromEvent(ev);
        if (!coord) return;
        const roomIndex = this.state.activeRoomIndex;

        if (this.state.placingNpc) {
            this.manager.npcService.placeNpcAt(coord);
            this.state.skipMapHistory = true;
            return;
        }
        if (this.state.placingEnemy) {
            if (this.state.repositioningEnemyId) {
                this.manager.enemyService.repositionEnemyAt(this.state.repositioningEnemyId, coord);
            } else {
                this.manager.enemyService.placeEnemyAt(coord);
            }
            this.state.skipMapHistory = true;
            return;
        }
        if (this.state.placingObjectType) {
            if (this.state.repositioningObjectId) {
                this.manager.objectService.repositionObjectAt(this.state.repositioningObjectId, coord);
            } else {
                this.manager.objectService.placeObjectAt(this.state.placingObjectType, coord, roomIndex);
            }
            this.state.skipMapHistory = true;
            return;
        }

        if (this.state.selectedTileId === null) return;
        this.manager.gameEngine.setMapTile(coord.x, coord.y, this.state.selectedTileId, roomIndex);
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
    }

    clearSelection({ render = true }: { render?: boolean } = {}) {
        const hadSelection = this.state.selectedTileId !== null;
        if (!hadSelection) return false;
        this.state.selectedTileId = null;
        if (render) {
            this.manager.renderService.renderTileList();
            this.manager.renderService.updateSelectedTilePreview();
        }
        return true;
    }

    getTileFromEvent(ev: PointerEvent) {
        const canvas = this.dom.editorCanvas;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const relX = (ev.clientX - rect.left) / rect.width;
        const relY = (ev.clientY - rect.top) / rect.height;
        if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;
        return {
            x: Math.min(7, Math.floor(relX * 8)),
            y: Math.min(7, Math.floor(relY * 8))
        };
    }
}

export { EditorTileService };
