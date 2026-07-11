import type { EditorManager } from '../EditorManager';
import type { CustomSpriteEntry, GameDefinition } from '../../types/gameState';
import { TextResources } from '../../runtime/adapters/TextResources';
import { CustomSpritesIO } from './CustomSpritesIO';

type GameWithSprites = Pick<GameDefinition, 'customSprites' | 'title'>;

export class EditorCustomSpritesService {
    manager: EditorManager;

    constructor(manager: EditorManager) {
        this.manager = manager;
    }

    private t(key: string, fallback = ''): string {
        const translatedText = TextResources.get(key, fallback);
        if (translatedText) return translatedText;
        if (fallback) return fallback;
        return key || '';
    }

    private format(key: string, params: Record<string, string | number>, fallback: string): string {
        return TextResources.format(key, params, fallback);
    }

    initialize(): void {
        this.bindEvents();
    }

    private bindEvents(): void {
        this.manager.dom.spritesImportButton?.addEventListener('click', () => {
            this.importSprites();
        });
        this.manager.dom.spritesExportButton?.addEventListener('click', () => {
            this.exportSprites();
        });
        this.manager.dom.spritesClearButton?.addEventListener('click', () => {
            this.clearSprites();
        });
    }

    private getGame(): GameWithSprites {
        return this.manager.gameEngine.getGame() as GameWithSprites;
    }

    private mapError(code: string): string {
        switch (code) {
            case CustomSpritesIO.ERROR_INVALID_JSON:
            case CustomSpritesIO.ERROR_WRONG_FORMAT:
            case CustomSpritesIO.ERROR_UNSUPPORTED_VERSION:
            case CustomSpritesIO.ERROR_SPRITES_NOT_ARRAY:
                return this.t('project.sprites.error.invalid', 'Invalid sprite pack file.');
            case CustomSpritesIO.ERROR_FILE_TOO_LARGE:
                return this.t('project.sprites.error.tooLarge', 'Sprite pack file is too large (max 2 MB).');
            case CustomSpritesIO.ERROR_TOO_MANY_ENTRIES:
            case CustomSpritesIO.ERROR_MERGE_TOO_LARGE:
                return this.t(
                    'project.sprites.error.tooMany',
                    'Sprite pack has too many entries (max 255).'
                );
            case CustomSpritesIO.ERROR_NOTHING_TO_IMPORT:
                return this.t('project.sprites.error.nothingValid', 'No valid sprites in pack.');
            default:
                return this.t('project.sprites.error.invalid', 'Invalid sprite pack file.');
        }
    }

    private sanitizeTitle(rawTitle: string): string {
        return rawTitle
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
    }

    private buildFilename(title: string | undefined): string {
        const safe = this.sanitizeTitle(typeof title === 'string' ? title : '');
        return safe ? `${safe}-sprites.json` : 'tiny-rpg-sprites.json';
    }

    private downloadText(filename: string, content: string): void {
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    /**
     * After a successful mutation: invalidate sprite caches, refresh editor/game UI,
     * sync JSON panel, and push history for Undo.
     */
    private refreshAfterMutation(): void {
        const engine = this.manager.gameEngine as {
            renderer?: { spriteFactory?: { invalidate(): void } };
            tileManager?: { refreshAnimationMetadata(): void };
            draw?: () => void;
        };
        engine.renderer?.spriteFactory?.invalidate();
        engine.tileManager?.refreshAnimationMetadata();
        this.manager.renderAll();
        if (engine.draw) {
            engine.draw();
        }
        this.manager.updateJSON();
        this.manager.historyManager.pushCurrentState();
    }

    private assignCustomSprites(next: CustomSpriteEntry[] | undefined): void {
        const game = this.getGame();
        if (!next || next.length === 0) {
            game.customSprites = undefined;
        } else {
            game.customSprites = next;
        }
    }

    exportSprites(): void {
        const game = this.getGame();
        const entries = game.customSprites;

        if (!Array.isArray(entries) || entries.length === 0) {
            alert(this.t('project.sprites.exportEmpty', 'Nothing to export: no custom sprites.'));
            return;
        }

        if (entries.length > CustomSpritesIO.MAX_ENTRIES) {
            alert(this.mapError(CustomSpritesIO.ERROR_TOO_MANY_ENTRIES));
            return;
        }

        const serialized = CustomSpritesIO.serialize(entries);
        if (!serialized.ok) {
            alert(this.mapError(serialized.error));
            return;
        }

        this.downloadText(this.buildFilename(game.title), serialized.text);
    }

    importSprites(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;

            if (file.size > CustomSpritesIO.MAX_FILE_BYTES) {
                alert(this.mapError(CustomSpritesIO.ERROR_FILE_TOO_LARGE));
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const text = String(reader.result || '');
                this.applyPackText(text);
            };
            reader.onerror = () => {
                alert(this.mapError(CustomSpritesIO.ERROR_INVALID_JSON));
            };
            reader.readAsText(file);
        });
        input.click();
    }

    /**
     * Parse pack text, choose merge/replace, apply in one write, refresh UI.
     * Exposed for unit tests without file I/O.
     */
    applyPackText(text: string): void {
        const parsed = CustomSpritesIO.parse(text);
        if (!parsed.ok) {
            alert(this.mapError(parsed.error));
            return;
        }

        const game = this.getGame();
        const current = game.customSprites;
        const mode = this.chooseImportMode(Array.isArray(current) ? current.length : 0);
        if (!mode) return;

        const applied = CustomSpritesIO.applyImport(current, parsed.sprites, mode);
        if (!applied.ok) {
            alert(this.mapError(applied.error));
            return;
        }

        this.assignCustomSprites(applied.sprites);
        this.refreshAfterMutation();

        const appliedCount = parsed.sprites.length;
        const skipped = parsed.skipped;
        const skippedSuffix =
            skipped > 0
                ? this.format(
                      'project.sprites.importSkippedSuffix',
                      { skipped },
                      ` (${skipped} skipped)`
                  )
                : '';
        alert(
            this.format(
                'project.sprites.importSuccess',
                { applied: appliedCount, skippedSuffix },
                `Imported ${appliedCount} sprite(s)${skippedSuffix}.`
            )
        );
    }

    /**
     * Default merge; Cancel on merge dialog offers replace with a second confirm.
     * Returns null if the user aborts.
     */
    private chooseImportMode(currentCount: number): 'merge' | 'replace' | null {
        if (currentCount === 0) {
            return 'replace';
        }

        const merge = window.confirm(
            this.t(
                'project.sprites.confirmMerge',
                'Merge into current custom sprites?\n\nOK = Merge\nCancel = Replace all (with confirmation)'
            )
        );
        if (merge) return 'merge';

        const replace = window.confirm(
            this.t(
                'project.sprites.confirmReplace',
                'Replace all custom sprites with the imported pack?'
            )
        );
        return replace ? 'replace' : null;
    }

    clearSprites(): void {
        const game = this.getGame();
        const entries = game.customSprites;
        if (!Array.isArray(entries) || entries.length === 0) {
            alert(this.t('project.sprites.clearEmpty', 'No custom sprites to clear.'));
            return;
        }

        const confirmed = window.confirm(
            this.t(
                'project.sprites.confirmClear',
                'Clear all custom sprites? This can be undone with Undo.'
            )
        );
        if (!confirmed) return;

        this.assignCustomSprites(undefined);
        this.refreshAfterMutation();
        alert(this.t('project.sprites.clearSuccess', 'All custom sprites cleared.'));
    }
}

export default EditorCustomSpritesService;
