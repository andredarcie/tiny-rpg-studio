import type { CustomSpriteEntry, CustomSpriteVariant, CustomSpriteFrame } from '../../types/gameState';
import { CustomSpriteLookup } from '../../runtime/domain/sprites/CustomSpriteLookup';
import { track } from '../../analytics/track';
import { RendererConstants } from '../../runtime/adapters/renderer/RendererConstants';
import { TextResources } from '../../runtime/adapters/TextResources';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';
import { SpriteMatrixRegistry } from '../../runtime/domain/sprites/SpriteMatrixRegistry';
import {
    normalizeCustomTileEffects,
    type CustomTileEffectDefinition,
    type TileVisualEffectKind,
} from '../../runtime/domain/definitions/customTileEffects';

type ManagerDeps = {
    gameEngine: {
        getGame(): unknown;
        renderer: {
            spriteFactory: { invalidate(): void };
            paletteManager: { getActivePalette(): string[] };
        };
        tileManager: {
            getTile(id: number | string): unknown;
            refreshAnimationMetadata(): void;
            getTileVisualEffect?(id: number | string): TileVisualEffectKind;
            setTileVisualEffect?(id: number | string, effect: TileVisualEffectKind): void;
        };
    };
    renderAll(): void;
    updateJSON(): void;
    history: { pushCurrentState(): void };
};

type ObjectDef = { type: string; sprite?: CustomSpriteFrame; spriteOn?: CustomSpriteFrame };
type DualStateObjectDef = ObjectDef & { spriteOn: CustomSpriteFrame };

type DomDeps = {
    pixelArtEditorModal: HTMLElement | null;
    paeCanvas: HTMLCanvasElement | null;
    paePalette: HTMLElement | null;
    paeSpriteMeta: HTMLElement | null;
    paeVariantBar: HTMLElement | null;
    paeFrameBar: HTMLElement | null;
    paeSave: HTMLButtonElement | null;
    paeReset: HTMLButtonElement | null;
    paeClose: HTMLButtonElement | null;
    paeCopyCode: HTMLButtonElement | null;
    paeToolPaint: HTMLButtonElement | null;
    paeToolErase: HTMLButtonElement | null;
    paeTileEffectRow?: HTMLElement | null;
    paeTileEffect?: HTMLSelectElement | null;
};

export class PixelArtEditorController {
    private group: CustomSpriteEntry['group'] | null = null;
    private key = '';
    private variant: CustomSpriteVariant = 'base';
    private frames: CustomSpriteFrame[] = [];
    private activeFrameIndex = 0;
    private selectedColor: number | null = 0;
    private tool: 'paint' | 'erase' = 'paint';
    private isPainting = false;
    private manager: ManagerDeps | null = null;
    private dom: DomDeps | null = null;
    private eventsReady = false;
    private languageEventsReady = false;
    private tileEffectDraft: TileVisualEffectKind = 'none';

    init(manager: ManagerDeps, dom: DomDeps): void {
        this.manager = manager;
        this.dom = dom;
        this.bindStaticEvents();
        this.bindLanguageEvents();
    }

    open(group: CustomSpriteEntry['group'], key: string, variant: CustomSpriteVariant = 'base'): boolean {
        if (!this.manager) return false;

        this.group = group;
        this.key = key;
        this.variant = variant;
        this.activeFrameIndex = 0;
        this.tool = 'paint';
        this.selectedColor = 0;
        this.tileEffectDraft = 'none';

        const game = this.manager.gameEngine.getGame() as { customSprites?: CustomSpriteEntry[] };

        const objectDef = group === 'object' ? this.findObjectDef(key) : undefined;

        if (this.hasDualStateSprite(objectDef)) {
            this.frames = this.loadDualStateFrames(key, objectDef, game.customSprites);
        } else {
            const custom = CustomSpriteLookup.find(game.customSprites, group, key, variant);
            this.frames = custom ? this.cloneFrames(custom.frames) : this.loadBaseFrames(group, key, variant);
        }

        this.dom?.pixelArtEditorModal?.removeAttribute('hidden');
        this.renderMeta();
        this.renderPalette();
        this.renderFrameBar();
        this.syncTileEffectSelect();
        this.renderCanvas();
        this.syncToolButtons();
        return true;
    }

    close(): void {
        this.dom?.pixelArtEditorModal?.setAttribute('hidden', '');
    }

    save(): void {
        if (!this.manager || !this.group) return;
        track('pixel_sprite_saved', { group: this.group });
        const game = this.manager.gameEngine.getGame() as { customSprites?: CustomSpriteEntry[] };

        // Commit the tile's draft visual effect together with the sprite.
        if (this.group === 'tile') {
            this.persistTileVisualEffect();
        }

        const objectDef = this.group === 'object' ? this.findObjectDef(this.key) : undefined;

        if (this.hasDualStateSprite(objectDef)) {
            game.customSprites = CustomSpriteLookup.upsert(game.customSprites ?? [], {
                group: 'object', key: this.key, variant: 'base', frames: [this.frames[0]]
            });
            game.customSprites = CustomSpriteLookup.upsert(game.customSprites ?? [], {
                group: 'object', key: this.key, variant: 'on', frames: [this.frames[1]]
            });
            this.invalidateAndRefresh();
            this.close();
            return;
        }

        const entry: CustomSpriteEntry = {
            group: this.group,
            key: this.key,
            variant: this.variant,
            frames: this.frames,
        };
        game.customSprites = CustomSpriteLookup.upsert(game.customSprites ?? [], entry);
        this.invalidateAndRefresh();
        this.close();
    }

    resetToDefault(): void {
        if (!this.group) return;
        this.frames = this.loadBaseFrames(this.group, this.key, this.variant);
        this.activeFrameIndex = 0;
        if (this.group === 'tile') {
            // Restore the preset effect in draft state; Save commits it.
            const presetEffect = this.getPresetTileVisualEffect(this.key);
            const select = this.dom?.paeTileEffect;
            if (select) select.value = presetEffect;
            this.tileEffectDraft = presetEffect;
        }
        this.renderFrameBar();
        if (this.group === 'tile' && this.dom?.paeTileEffect) {
            this.rebuildTileEffectOptions();
            this.dom.paeTileEffect.value = this.tileEffectDraft;
        } else {
            this.syncTileEffectSelect();
        }
        this.renderCanvas();
    }

    copyCode(): void {
        const frame = this.frames.at(this.activeFrameIndex);
        if (!frame) return;

        const spriteKey = this.variant === 'on' ? `${this.key}--on` : this.key;

        const formatCell = (v: number | null): string =>
            v === null ? 'null' : v < 10 ? ` ${v}` : `${v}`;

        const rows = frame
            .map((row) => `        [ ${row.map(formatCell).join(',  ')} ]`)
            .join(',\n');

        const code = `'${spriteKey}': [\n${rows}\n    ]`;

        const btn = this.dom?.paeCopyCode;
        const originalText = btn?.textContent ?? '';

        navigator.clipboard.writeText(code).then(() => {
            if (btn) {
                btn.textContent = TextResources.get('pixelArtEditor.copyCodeDone', 'Copiado!') as string;
                setTimeout(() => { btn.textContent = originalText; }, 1500);
            }
        }).catch(() => {
            // fallback for environments without clipboard API
            const ta = document.createElement('textarea');
            ta.value = code;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            if (btn) {
                btn.textContent = TextResources.get('pixelArtEditor.copyCodeDone', 'Copiado!') as string;
                setTimeout(() => { btn.textContent = originalText; }, 1500);
            }
        });
    }

    // ── Rendering ──────────────────────────────────────────────

    private renderCanvas(): void {
        const canvas = this.dom?.paeCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const frame = this.frames[this.activeFrameIndex] ?? [];
        const rows = frame.length;
        const cols = rows > 0 ? (frame[0]?.length ?? 0) : 0;
        if (rows === 0 || cols === 0) return;

        const pixelW = canvas.width / cols;
        const pixelH = canvas.height / rows;
        const palette = this.getActivePalette();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw pixels
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = frame[r][c];
                if (idx !== null) {
                    ctx.fillStyle = palette[idx] ?? '#000000';
                } else {
                    // checkerboard for transparent
                    const even = (r + c) % 2 === 0;
                    ctx.fillStyle = even ? '#333333' : '#444444';
                }
                ctx.fillRect(c * pixelW, r * pixelH, pixelW, pixelH);
            }
        }

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        for (let r = 0; r <= rows; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * pixelH);
            ctx.lineTo(canvas.width, r * pixelH);
            ctx.stroke();
        }
        for (let c = 0; c <= cols; c++) {
            ctx.beginPath();
            ctx.moveTo(c * pixelW, 0);
            ctx.lineTo(c * pixelW, canvas.height);
            ctx.stroke();
        }
    }

    private renderPalette(): void {
        const container = this.dom?.paePalette;
        if (!container) return;
        container.innerHTML = '';
        const palette = this.getActivePalette();

        palette.forEach((color, idx) => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'pae-palette-swatch';
            if (this.selectedColor === idx) swatch.classList.add('active');
            swatch.style.background = color;
            swatch.title = this.tf('pixelArtEditor.paletteColor', { index: idx }, `Cor ${idx}`);
            swatch.dataset.paletteIndex = String(idx);
            container.appendChild(swatch);
        });

        // Transparent / erase swatch
        const nullSwatch = document.createElement('button');
        nullSwatch.type = 'button';
        nullSwatch.className = 'pae-palette-swatch pae-swatch-null';
        if (this.selectedColor === null) nullSwatch.classList.add('active');
        nullSwatch.title = this.t('pixelArtEditor.paletteTransparent', 'Transparente');
        nullSwatch.dataset.paletteIndex = 'null';
        container.appendChild(nullSwatch);
    }

    private renderMeta(): void {
        const meta = this.dom?.paeSpriteMeta;
        if (!meta) return;
        const variantLabel = this.variant !== 'base' ? ` (${this.variant})` : '';
        meta.textContent = `${this.group} / ${this.key}${variantLabel}`;
    }

    private renderFrameBar(): void {
        const frameBar = this.dom?.paeFrameBar;
        if (!frameBar) return;
        frameBar.innerHTML = '';

        if (this.frames.length <= 1) {
            frameBar.setAttribute('hidden', '');
            return;
        }

        frameBar.removeAttribute('hidden');
        this.frames.forEach((_frame, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pae-frame-btn';
            button.dataset.frameIndex = String(index);
            button.textContent = this.tf('pixelArtEditor.frameLabel', { index }, `Frame ${index}`);
            button.classList.toggle('active', index === this.activeFrameIndex);
            button.addEventListener('click', () => {
                this.activeFrameIndex = index;
                this.renderFrameBar();
                this.renderCanvas();
            });
            frameBar.appendChild(button);
        });
    }

    private syncToolButtons(): void {
        this.dom?.paeToolPaint?.classList.toggle('active', this.tool === 'paint');
        this.dom?.paeToolErase?.classList.toggle('active', this.tool === 'erase');
    }

    /** Show liquid-effect select only when editing a tile. */
    private syncTileEffectSelect(): void {
        const row = this.dom?.paeTileEffectRow;
        const select = this.dom?.paeTileEffect;
        if (!row || !select) return;

        if (this.group !== 'tile') {
            row.setAttribute('hidden', '');
            return;
        }

        row.removeAttribute('hidden');
        this.rebuildTileEffectOptions();
        const tileId = this.resolveTileId(this.key);
        const effect =
            this.manager?.gameEngine.tileManager.getTileVisualEffect?.(tileId) ??
            this.readTileVisualEffectFromGame(tileId);
        this.tileEffectDraft = effect;
        select.value = effect;
    }

    private rebuildTileEffectOptions(): void {
        const select = this.dom?.paeTileEffect;
        if (!select) return;
        const builtIns: Array<[TileVisualEffectKind, string, string]> = [
            ['none', 'pixelArtEditor.visualEffect.none', 'None'],
            ['water', 'pixelArtEditor.visualEffect.water', 'Water'],
            ['lava', 'pixelArtEditor.visualEffect.lava', 'Lava'],
        ];
        select.replaceChildren();
        for (const [value, key, fallback] of builtIns) {
            const option = document.createElement('option');
            option.value = value;
            option.dataset.textKey = key;
            option.textContent = this.t(key, fallback);
            select.appendChild(option);
        }
        const game = this.manager?.gameEngine.getGame() as { customTileEffects?: CustomTileEffectDefinition[] } | undefined;
        for (const definition of normalizeCustomTileEffects(game?.customTileEffects)) {
            const option = document.createElement('option');
            option.value = definition.id;
            option.textContent = definition.name;
            select.appendChild(option);
        }
    }

    private persistTileVisualEffect(): void {
        if (!this.manager || this.group !== 'tile') return;
        const effect = this.tileEffectDraft;
        const tileId = this.resolveTileId(this.key);
        if (this.manager.gameEngine.tileManager.setTileVisualEffect) {
            this.manager.gameEngine.tileManager.setTileVisualEffect(tileId, effect);
            return;
        }
        // Fallback: write onto tileset tile object directly.
        const game = this.manager.gameEngine.getGame() as {
            tileset?: { tiles?: Array<{ id?: number | string; visualEffect?: TileVisualEffectKind }> };
        };
        const tile = game.tileset?.tiles?.find((t) => String(t.id) === String(tileId));
        if (tile) tile.visualEffect = effect;
    }

    private resolveTileId(key: string): number | string {
        const asNum = Number(key);
        return Number.isFinite(asNum) ? asNum : key;
    }

    private readTileVisualEffectFromGame(tileId: number | string): TileVisualEffectKind {
        const game = this.manager?.gameEngine.getGame() as {
            tileset?: { tiles?: Array<{ id?: number | string; visualEffect?: string; category?: string; name?: string }> };
        } | undefined;
        const tile = game?.tileset?.tiles?.find((t) => String(t.id) === String(tileId));
        if (!tile) return 'none';
        if (tile.visualEffect === 'water' || tile.visualEffect === 'lava' || tile.visualEffect === 'none') {
            return tile.visualEffect;
        }
        const cat = (tile.category || '').toLowerCase();
        const name = (tile.name || '').toLowerCase();
        if (cat === 'agua' || name.includes('agua') || name.includes('water')) return 'water';
        if (cat === 'perigo' || name.includes('lava')) return 'lava';
        return 'none';
    }

    private getPresetTileVisualEffect(key: string): TileVisualEffectKind {
        const tileId = this.resolveTileId(key);
        const preset = TileDefinitions.TILE_PRESETS.find((t) => String(t.id) === String(tileId));
        if (preset?.visualEffect === 'water' || preset?.visualEffect === 'lava' || preset?.visualEffect === 'none') {
            return preset.visualEffect;
        }
        const cat = (preset?.category || '').toLowerCase();
        if (cat === 'agua') return 'water';
        if (cat === 'perigo') return 'lava';
        return 'none';
    }

    // ── Events (bound once in init) ─────────────────────────────

    private bindStaticEvents(): void {
        if (this.eventsReady) return;
        this.eventsReady = true;

        this.dom?.paeSave?.addEventListener('click', () => this.save());
        this.dom?.paeReset?.addEventListener('click', () => this.resetToDefault());
        this.dom?.paeClose?.addEventListener('click', () => this.close());
        this.dom?.paeCopyCode?.addEventListener('click', () => this.copyCode());

        this.dom?.paeToolPaint?.addEventListener('click', () => {
            this.tool = 'paint';
            this.syncToolButtons();
        });
        this.dom?.paeToolErase?.addEventListener('click', () => {
            this.tool = 'erase';
            this.syncToolButtons();
        });

        this.dom?.paeTileEffect?.addEventListener('change', () => {
            if (this.group !== 'tile') return;
            this.tileEffectDraft = (this.dom?.paeTileEffect?.value ?? 'none') as TileVisualEffectKind;
        });

        this.dom?.paePalette?.addEventListener('click', (e) => {
            const swatch = (e.target as Element).closest('.pae-palette-swatch') as HTMLElement | null;
            if (!swatch) return;

            this.tool = 'paint';
            this.syncToolButtons();

            const idxStr = swatch.dataset.paletteIndex;
            this.selectedColor = idxStr === 'null' ? null : parseInt(idxStr ?? '0');
            this.renderPalette();
        });

        const canvas = this.dom?.paeCanvas;
        if (canvas) {
            canvas.addEventListener('mousedown', (e) => {
                this.isPainting = true;
                this.paintAt(e);
            });
            canvas.addEventListener('mousemove', (e) => {
                if (this.isPainting) this.paintAt(e);
            });
            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.isPainting = true;
                this.paintAt(e);
            });
            canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (this.isPainting) this.paintAt(e);
            });
            canvas.addEventListener('mouseup', () => { this.isPainting = false; });
            canvas.addEventListener('mouseleave', () => { this.isPainting = false; });
        }
    }

    private paintAt(e: MouseEvent | TouchEvent): void {
        const canvas = this.dom?.paeCanvas;
        if (!canvas) return;
        const frame = this.frames[this.activeFrameIndex];

        const rect = canvas.getBoundingClientRect();
        const rows = frame.length;
        const cols = frame[0]?.length ?? 0;
        if (rows === 0 || cols === 0) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const c = Math.floor((x / rect.width) * cols);
        const r = Math.floor((y / rect.height) * rows);

        if (r < 0 || r >= rows || c < 0 || c >= cols) return;

        const newColor = this.tool === 'erase' ? null : this.selectedColor;
        if (frame[r][c] === newColor) return;

        frame[r][c] = newColor;
        this.renderCanvas();
    }

    // ── Helpers ─────────────────────────────────────────────────

    private getActivePalette(): string[] {
        if (!this.manager) {
            return [...TileDefinitions.PICO8_COLORS];
        }
        try {
            return this.manager.gameEngine.renderer.paletteManager.getActivePalette();
        } catch {
            return [...TileDefinitions.PICO8_COLORS];
        }
    }

    private bindLanguageEvents(): void {
        if (this.languageEventsReady || typeof document === 'undefined') return;
        this.languageEventsReady = true;
        document.addEventListener('language-changed', () => {
            if (this.group) {
                this.renderMeta();
            }
            if (this.frames.length > 0) {
                this.renderPalette();
                this.renderFrameBar();
            }
            if (this.group === 'tile') {
                const draft = this.tileEffectDraft;
                this.rebuildTileEffectOptions();
                if (this.dom?.paeTileEffect) this.dom.paeTileEffect.value = draft;
            }
        });
    }

    private t(key: string, fallback = ''): string {
        return (TextResources.get(key, fallback) as string) || fallback || key;
    }

    private tf(
        key: string,
        params: Record<string, string | number | boolean>,
        fallback = ''
    ): string {
        return (TextResources.format(key, params, fallback) as string) || fallback || key;
    }

    private loadBaseFrames(
        group: CustomSpriteEntry['group'],
        key: string,
        variant: CustomSpriteVariant
    ): CustomSpriteFrame[] {
        if (!this.manager) return [];

        if (group === 'player') {
            const matrix = SpriteMatrixRegistry.get('player', key) as CustomSpriteFrame | null;
            return this.cloneFrames(matrix ? [matrix] : []);
        } else if (group === 'npc') {
            const def = RendererConstants.NPC_DEFINITIONS.find((d: { type: string }) => d.type === key) as { sprite?: CustomSpriteFrame } | undefined;
            return this.cloneFrames(def?.sprite ? [def.sprite] : []);
        } else if (group === 'enemy') {
            const def = RendererConstants.ENEMY_DEFINITIONS.find((d: { type: string }) => d.type === key) as { sprite?: CustomSpriteFrame } | undefined;
            return this.cloneFrames(def?.sprite ? [def.sprite] : []);
        } else if (group === 'object') {
            const def = this.findObjectDef(key);
            if (this.hasDualStateSprite(def)) {
                const frames = [def.sprite, def.spriteOn].filter((f): f is CustomSpriteFrame => f !== undefined);
                return this.cloneFrames(frames);
            }
            const raw = variant === 'on' ? def?.spriteOn : def?.sprite;
            return this.cloneFrames(raw ? [raw] : []);
        } else {
            // Tiles use numeric layouts as the canonical source for the pixel art editor.
            const game = this.manager.gameEngine.getGame() as {
                tileset?: {
                    tiles?: {
                        id: number;
                        layouts?: CustomSpriteFrame[];
                        frames?: string[][];
                        pixels?: string[][];
                    }[];
                };
            };
            const tileId = parseInt(key);
            const rawTile = game.tileset?.tiles?.find((t) => t.id === tileId);
            if (Array.isArray(rawTile?.layouts) && rawTile.layouts.length > 0) {
                return this.cloneFrames(rawTile.layouts);
            }

            if (rawTile?.pixels) {
                const palette = TileDefinitions.PICO8_COLORS.map((color) => color.toUpperCase());
                const raw = rawTile.pixels.map((row) =>
                    row.map((value) => {
                        if (!value || value === 'transparent') return null;
                        const paletteIndex = palette.indexOf(String(value).toUpperCase());
                        return paletteIndex >= 0 ? paletteIndex : null;
                    })
                );
                return this.cloneFrames([raw]);
            }
        }

        return [];
    }

    private findObjectDef(key: string): ObjectDef | undefined {
        return (RendererConstants.OBJECT_DEFINITIONS as ObjectDef[]).find((d) => d.type === key);
    }

    private hasDualStateSprite(def: ObjectDef | undefined): def is DualStateObjectDef {
        return Array.isArray(def?.spriteOn);
    }

    private loadDualStateFrames(
        key: string,
        def: DualStateObjectDef,
        customSprites: CustomSpriteEntry[] | undefined
    ): CustomSpriteFrame[] {
        const customBase = CustomSpriteLookup.find(customSprites, 'object', key, 'base');
        const customOn = CustomSpriteLookup.find(customSprites, 'object', key, 'on');
        const frameOff = customBase?.frames[0] ?? def.sprite;
        const frameOn = customOn?.frames[0] ?? def.spriteOn;
        const frames = [frameOff, frameOn].filter((f): f is CustomSpriteFrame => f !== undefined);
        return this.cloneFrames(frames);
    }

    private cloneFrames(frames: CustomSpriteFrame[]): CustomSpriteFrame[] {
        return frames.map((frame) => frame.map((row) => row.slice()));
    }

    private invalidateAndRefresh(): void {
        if (!this.manager) return;
        this.manager.gameEngine.renderer.spriteFactory.invalidate();
        this.manager.gameEngine.tileManager.refreshAnimationMetadata();
        this.manager.renderAll();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    // ── Test helpers ─────────────────────────────────────────────

    getCurrentFrames(): CustomSpriteFrame[] {
        return this.frames;
    }

    setFrames(frames: CustomSpriteFrame[]): void {
        this.frames = frames;
    }
}
