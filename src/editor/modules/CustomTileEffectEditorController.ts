import { TextResources } from '../../runtime/adapters/TextResources';
import { listBaseTileEffects } from '../../runtime/adapters/renderer/tileEffects/baseEffectRegistry';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';
import { GameConfig } from '../../config/GameConfig';
import {
    CUSTOM_TILE_EFFECT_LIMITS,
    normalizeCustomTileEffects,
    type BaseTileEffectId,
    type CreateCustomTileEffectError,
    type CustomTileEffectDefinition,
    type CustomTileEffectId,
} from '../../runtime/domain/definitions/customTileEffects';
import type { TileDefinition } from '../../runtime/domain/definitions/tileTypes';

type ManagerDeps = {
    gameEngine: {
        createCustomTileEffect(name: string, ids: readonly BaseTileEffectId[]): {
            ok: boolean;
            error?: CreateCustomTileEffectError;
        };
        deleteCustomTileEffect(id: CustomTileEffectId): boolean;
        getGame(): { customTileEffects?: CustomTileEffectDefinition[] };
        tileManager: { getTile(id: number | string): TileDefinition | null };
        renderer: {
            drawCustomTileEffectPreview(
                canvas: HTMLCanvasElement,
                tile: TileDefinition | null,
                ids: readonly BaseTileEffectId[],
                frameOverride?: number,
                timeMs?: number
            ): void;
        };
    };
    renderAll(): void;
    updateJSON(): void;
    history: { pushCurrentState(): void };
};

type DomDeps = {
    customTileEffectOpen: HTMLButtonElement | null;
    customTileEffectModal: HTMLElement | null;
};

export class CustomTileEffectEditorController {
    private manager: ManagerDeps | null = null;
    private dom: DomDeps | null = null;
    private selectedIds: BaseTileEffectId[] = [];
    private sampleTile: TileDefinition | null = null;
    private lastFocus: HTMLElement | null = null;
    private lastError: CreateCustomTileEffectError | null = null;
    private eventsReady = false;
    private previewAnimationFrame: number | null = null;
    private previewStartedAt = 0;
    private previewStep = 0;

    init(manager: ManagerDeps, dom: DomDeps): void {
        this.manager = manager;
        this.dom = dom;
        this.bindEvents();
    }

    open(): void {
        const modal = this.dom?.customTileEffectModal;
        if (!modal || !this.manager) return;
        this.lastFocus = document.activeElement as HTMLElement | null;
        this.selectedIds = [];
        this.nameInput().value = '';
        this.lastError = null;
        this.previewStep = 0;
        this.setStatus('');
        this.sampleTile = this.manager.gameEngine.tileManager.getTile(0)
            ?? TileDefinitions.TILE_PRESETS.find((tile) => Number(tile.id) === 0)
            ?? TileDefinitions.TILE_PRESETS[0];
        modal.removeAttribute('hidden');
        this.render();
        this.startPreviewAnimation();
        this.nameInput().focus();
    }

    close(): void {
        this.stopPreviewAnimation();
        this.dom?.customTileEffectModal?.setAttribute('hidden', '');
        this.selectedIds = [];
        this.lastFocus?.focus();
    }

    save(): void {
        if (!this.manager) return;
        const result = this.manager.gameEngine.createCustomTileEffect(
            this.nameInput().value,
            this.selectedIds
        );
        if (!result.ok) {
            this.lastError = result.error ?? 'invalid-passes';
            this.setStatus(this.errorText(this.lastError));
            return;
        }
        this.manager.renderAll();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
        this.close();
    }

    private render(): void {
        this.renderCatalog();
        this.renderSelected();
        this.renderSavedEffects();
        this.renderPreview();
        if (this.lastError) this.setStatus(this.errorText(this.lastError));
    }

    private renderPreview(): void {
        const canvas = this.query<HTMLCanvasElement>('#custom-effect-preview');
        if (canvas && this.manager) {
            this.manager.gameEngine.renderer.drawCustomTileEffectPreview(
                canvas,
                this.sampleTile,
                this.selectedIds,
                this.previewStep,
                this.previewStep * GameConfig.animation.tileInterval
            );
        }
    }

    private startPreviewAnimation(): void {
        this.stopPreviewAnimation();
        if (typeof globalThis.requestAnimationFrame !== 'function') return;
        this.previewStep = 0;
        this.previewStartedAt = performance.now();
        let lastRenderedStep = 0;
        const tick = (now: number) => {
            const modal = this.dom?.customTileEffectModal;
            if (!modal || modal.hasAttribute('hidden')) {
                this.previewAnimationFrame = null;
                return;
            }
            const step = Math.floor((now - this.previewStartedAt) / GameConfig.animation.tileInterval);
            if (step !== lastRenderedStep) {
                lastRenderedStep = step;
                this.previewStep = step;
                this.renderPreview();
            }
            this.previewAnimationFrame = globalThis.requestAnimationFrame(tick);
        };
        this.previewAnimationFrame = globalThis.requestAnimationFrame(tick);
    }

    private stopPreviewAnimation(): void {
        if (this.previewAnimationFrame === null) return;
        globalThis.cancelAnimationFrame(this.previewAnimationFrame);
        this.previewAnimationFrame = null;
    }

    private renderCatalog(): void {
        const container = this.query<HTMLElement>('#custom-effect-catalog');
        if (!container) return;
        container.replaceChildren();
        for (const entry of listBaseTileEffects()) {
            const row = document.createElement('div');
            row.className = 'custom-effect-row';
            const copy = document.createElement('div');
            const label = document.createElement('div');
            label.textContent = this.t(entry.textKey, entry.fallbackLabel);
            copy.appendChild(label);
            if (entry.helpTextKey) {
                const help = document.createElement('small');
                help.className = 'custom-effect-help';
                help.textContent = this.t(entry.helpTextKey, entry.fallbackHelp ?? '');
                copy.appendChild(help);
            }
            const add = document.createElement('button');
            add.type = 'button';
            add.dataset.baseEffectId = entry.id;
            add.textContent = this.t('customEffects.add', 'Add');
            add.disabled = this.selectedIds.includes(entry.id);
            row.append(copy, add);
            container.appendChild(row);
        }
    }

    private renderSelected(): void {
        const container = this.query<HTMLElement>('#custom-effect-selected');
        if (!container) return;
        container.replaceChildren();
        const catalog = new Map(listBaseTileEffects().map((entry) => [entry.id, entry]));
        for (const [index, id] of this.selectedIds.entries()) {
            const entry = catalog.get(id);
            const row = document.createElement('div');
            row.className = 'custom-effect-row';
            const label = document.createElement('span');
            label.textContent = `${index + 1}. ${this.t(entry?.textKey ?? '', entry?.fallbackLabel ?? id)}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.dataset.removeBaseEffectId = id;
            remove.textContent = this.t('customEffects.remove', 'Remove');
            row.append(label, remove);
            container.appendChild(row);
        }
        if (!this.selectedIds.length) {
            const empty = document.createElement('p');
            empty.className = 'custom-effect-empty';
            empty.textContent = this.t('customEffects.empty', 'Add effects from the catalog.');
            container.appendChild(empty);
        }
    }

    private renderSavedEffects(): void {
        const container = this.query<HTMLElement>('#custom-effect-saved');
        if (!container || !this.manager) return;
        container.replaceChildren();
        const definitions = normalizeCustomTileEffects(
            this.manager.gameEngine.getGame().customTileEffects
        );
        for (const definition of definitions) {
            const row = document.createElement('div');
            row.className = 'custom-effect-row';
            const name = document.createElement('span');
            name.textContent = definition.name;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'custom-effect-delete';
            remove.dataset.deleteCustomEffectId = definition.id;
            remove.textContent = this.t('customEffects.delete', 'Delete');
            row.append(name, remove);
            container.appendChild(row);
        }
        if (!definitions.length) {
            const empty = document.createElement('p');
            empty.className = 'custom-effect-empty';
            empty.textContent = this.t('customEffects.savedEmpty', 'No custom effects created yet.');
            container.appendChild(empty);
        }
    }

    private bindEvents(): void {
        if (this.eventsReady || !this.dom?.customTileEffectModal) return;
        this.eventsReady = true;
        const modal = this.dom.customTileEffectModal;
        this.dom.customTileEffectOpen?.addEventListener('click', () => this.open());
        this.query('#custom-effect-save')?.addEventListener('click', () => this.save());
        this.query('#custom-effect-cancel')?.addEventListener('click', () => this.close());
        this.query('#custom-effect-close')?.addEventListener('click', () => this.close());
        modal.addEventListener('click', (event) => {
            if (event.target === modal) this.close();
            const target = event.target as HTMLElement;
            const addId = target.closest<HTMLElement>('[data-base-effect-id]')?.dataset.baseEffectId as BaseTileEffectId | undefined;
            if (addId && !this.selectedIds.includes(addId)) {
                this.selectedIds.push(addId);
                this.lastError = null;
                this.setStatus('');
                this.render();
            }
            const removeId = target.closest<HTMLElement>('[data-remove-base-effect-id]')?.dataset.removeBaseEffectId as BaseTileEffectId | undefined;
            if (removeId) {
                this.selectedIds = this.selectedIds.filter((id) => id !== removeId);
                this.lastError = null;
                this.setStatus('');
                this.render();
            }
            const deleteId = target.closest<HTMLElement>('[data-delete-custom-effect-id]')
                ?.dataset.deleteCustomEffectId as CustomTileEffectId | undefined;
            if (deleteId && this.manager?.gameEngine.deleteCustomTileEffect(deleteId)) {
                this.manager.renderAll();
                this.manager.updateJSON();
                this.manager.history.pushCurrentState();
                this.setStatus(this.t('customEffects.deleted', 'Effect deleted.'));
                this.render();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.hasAttribute('hidden')) this.close();
        });
        document.addEventListener('language-changed', () => {
            if (!modal.hasAttribute('hidden')) this.render();
        });
    }

    private nameInput(): HTMLInputElement {
        return this.query<HTMLInputElement>('#custom-effect-name') as HTMLInputElement;
    }

    private query<T extends Element = Element>(selector: string): T | null {
        return this.dom?.customTileEffectModal?.querySelector<T>(selector) ?? null;
    }

    private setStatus(value: string): void {
        const status = this.query<HTMLElement>('#custom-effect-status');
        if (status) status.textContent = value;
    }

    private errorText(error: CreateCustomTileEffectError): string {
        const fallback: Record<CreateCustomTileEffectError, string> = {
            'empty-name': 'Enter an effect name.',
            'duplicate-name': 'That effect name is already in use.',
            'empty-passes': 'Add at least one base effect.',
            'invalid-passes': 'The selected effects are invalid.',
            'project-limit': `A project can have up to ${CUSTOM_TILE_EFFECT_LIMITS.maxDefinitions} custom effects.`,
        };
        return this.t(`customEffects.error.${error}`, fallback[error]);
    }

    private t(key: string, fallback: string): string {
        return (TextResources.get(key, fallback) as string) || fallback;
    }
}
