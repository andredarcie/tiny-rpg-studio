import type { EditorManager } from '../EditorManager';
import type { CustomSpriteEntry, GameDefinition } from '../../types/gameState';
import { TextResources } from '../../runtime/adapters/TextResources';
import {
    CUSTOM_TILE_EFFECT_LIMITS,
    isCustomTileEffectId,
    normalizeCustomTileEffects,
    type CustomTileEffectDefinition,
    type CustomTileEffectId,
} from '../../runtime/domain/definitions/customTileEffects';
import { CustomEffectsIO, type PortableCustomEffectRecipe } from './CustomEffectsIO';
import {
    CustomSpritesIO,
    type AppliedTileEffectsBundle,
    type TileEffectAssignment,
} from './CustomSpritesIO';

type GameWithSprites = Pick<
    GameDefinition,
    'customSprites' | 'customTileEffects' | 'tileset' | 'title'
>;
type GameTile = GameWithSprites['tileset']['tiles'][number];

type EffectReconciliationResult =
    | {
          ok: true;
          definitions: CustomTileEffectDefinition[];
          resolvedAssignments: Array<{ tile: GameTile; effectId: CustomTileEffectId }>;
          added: number;
          reused: number;
          skippedAssignments: number;
      }
    | { ok: false; error: string };

const ERROR_EFFECT_NAME_CONFLICT = 'effect_name_conflict';
const ERROR_EFFECT_CAPACITY = 'effect_capacity';
const ERROR_INVALID_DESTINATION_EFFECTS = 'invalid_destination_effects';

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
            case CustomSpritesIO.ERROR_INVALID_EFFECT_RECIPES:
            case CustomSpritesIO.ERROR_INVALID_EFFECT_ASSIGNMENTS:
                return this.t(
                    'project.sprites.error.invalidEffects',
                    'Sprite pack contains invalid custom effect data.'
                );
            case ERROR_EFFECT_NAME_CONFLICT:
                return this.t(
                    'project.sprites.error.effectConflict',
                    'An imported effect has the same name as an existing effect with a different recipe.'
                );
            case ERROR_EFFECT_CAPACITY:
                return this.t(
                    'project.sprites.error.effectCapacity',
                    'Import would exceed the limit of 16 custom effects.'
                );
            case ERROR_INVALID_DESTINATION_EFFECTS:
                return this.t(
                    'project.sprites.error.invalidCurrentEffects',
                    'Current custom effect data is invalid. Fix it before importing this pack.'
                );
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

    private collectAppliedEffects(game: GameWithSprites): AppliedTileEffectsBundle | undefined {
        const definitions = normalizeCustomTileEffects(game.customTileEffects);
        if (definitions.length === 0) return undefined;

        const keyCounts = new Map<string, number>();
        for (const tile of game.tileset.tiles) {
            if (tile.id === undefined) continue;
            const key = String(tile.id);
            keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
        }

        const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
        const usedIds = new Set<CustomTileEffectId>();
        for (const tile of game.tileset.tiles) {
            if (tile.id === undefined) continue;
            const tileKey = String(tile.id);
            if (keyCounts.get(tileKey) !== 1) continue;
            if (
                isCustomTileEffectId(tile.visualEffect) &&
                definitionById.has(tile.visualEffect)
            ) {
                usedIds.add(tile.visualEffect);
            }
        }

        const referenced = definitions.filter((definition) => usedIds.has(definition.id));
        if (referenced.length === 0) return undefined;
        const portable = CustomEffectsIO.toPortableRecipes(referenced);
        if (!portable.ok) return undefined;

        const effectIndexes = new Map(
            referenced.map((definition, index) => [definition.id, index])
        );
        const tileEffectAssignments: TileEffectAssignment[] = [];
        for (const tile of game.tileset.tiles) {
            if (tile.id === undefined) continue;
            const tileKey = String(tile.id);
            if (keyCounts.get(tileKey) !== 1 || !isCustomTileEffectId(tile.visualEffect)) continue;
            const effectIndex = effectIndexes.get(tile.visualEffect);
            if (effectIndex === undefined) continue;
            tileEffectAssignments.push({ tileKey, effectIndex });
        }

        return {
            customEffects: portable.recipes,
            tileEffectAssignments,
        };
    }

    private recipesMatch(
        definition: CustomTileEffectDefinition,
        recipe: PortableCustomEffectRecipe
    ): boolean {
        return (
            definition.baseEffectIds.length === recipe.baseEffectIds.length &&
            definition.baseEffectIds.every((id, index) => id === recipe.baseEffectIds[index]) &&
            definition.color === recipe.color
        );
    }

    private destinationEffectsAreNormalized(
        value: unknown,
        normalized: CustomTileEffectDefinition[]
    ): value is CustomTileEffectDefinition[] {
        if (!Array.isArray(value) || value.length !== normalized.length) return false;
        return value.every((candidate, index) => {
            if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
                return false;
            }
            const definition = normalized[index];
            const record = candidate as Record<string, unknown>;
            const expectedKeys = definition.color
                ? ['baseEffectIds', 'color', 'id', 'name']
                : ['baseEffectIds', 'id', 'name'];
            const actualKeys = Object.keys(record).sort();
            if (
                actualKeys.length !== expectedKeys.length ||
                actualKeys.some((key, keyIndex) => key !== expectedKeys[keyIndex]) ||
                record.id !== definition.id ||
                record.name !== definition.name ||
                record.color !== definition.color ||
                !Array.isArray(record.baseEffectIds) ||
                record.baseEffectIds.length !== definition.baseEffectIds.length
            ) {
                return false;
            }
            return record.baseEffectIds.every(
                (effectId, effectIndex) => effectId === definition.baseEffectIds[effectIndex]
            );
        });
    }

    private reconcileEffects(
        game: GameWithSprites,
        recipes: PortableCustomEffectRecipe[],
        assignments: TileEffectAssignment[]
    ): EffectReconciliationResult {
        const currentValue = game.customTileEffects;
        const normalized = normalizeCustomTileEffects(currentValue);
        if (
            currentValue !== undefined &&
            !this.destinationEffectsAreNormalized(currentValue, normalized)
        ) {
            return { ok: false, error: ERROR_INVALID_DESTINATION_EFFECTS };
        }

        const definitions = normalized.map((definition) => ({
            ...definition,
            baseEffectIds: definition.baseEffectIds.slice(),
        }));
        const usedIds = new Set(definitions.map((definition) => definition.id));
        const effectIds: CustomTileEffectId[] = [];
        let added = 0;
        let reused = 0;

        for (const recipe of recipes) {
            const nameKey = recipe.name.toLocaleLowerCase();
            const existing = definitions.find(
                (definition) => definition.name.toLocaleLowerCase() === nameKey
            );
            if (existing) {
                if (!this.recipesMatch(existing, recipe)) {
                    return { ok: false, error: ERROR_EFFECT_NAME_CONFLICT };
                }
                effectIds.push(existing.id);
                reused += 1;
                continue;
            }
            if (definitions.length >= CUSTOM_TILE_EFFECT_LIMITS.maxDefinitions) {
                return { ok: false, error: ERROR_EFFECT_CAPACITY };
            }
            let suffix = 0;
            while (usedIds.has(`custom:${suffix.toString(36)}`)) suffix += 1;
            const id = `custom:${suffix.toString(36)}` as CustomTileEffectId;
            usedIds.add(id);
            definitions.push({
                id,
                name: recipe.name,
                baseEffectIds: recipe.baseEffectIds.slice(),
                ...(recipe.color ? { color: recipe.color } : {}),
            });
            effectIds.push(id);
            added += 1;
        }

        const tilesByKey = new Map<string, GameTile[]>();
        for (const tile of game.tileset.tiles) {
            if (tile.id === undefined) continue;
            const key = String(tile.id);
            const matching = tilesByKey.get(key) ?? [];
            matching.push(tile);
            tilesByKey.set(key, matching);
        }

        const resolvedAssignments: Array<{ tile: GameTile; effectId: CustomTileEffectId }> = [];
        let skippedAssignments = 0;
        for (const assignment of assignments) {
            const matching = tilesByKey.get(assignment.tileKey);
            const effectId = effectIds[assignment.effectIndex];
            if (!matching || matching.length !== 1) {
                skippedAssignments += 1;
                continue;
            }
            resolvedAssignments.push({ tile: matching[0], effectId });
        }

        return {
            ok: true,
            definitions,
            resolvedAssignments,
            added,
            reused,
            skippedAssignments,
        };
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

        const serialized = CustomSpritesIO.serialize(
            entries,
            undefined,
            this.collectAppliedEffects(game)
        );
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
        const hasEffects = parsed.customEffects.length > 0;
        const reconciled = hasEffects
            ? this.reconcileEffects(game, parsed.customEffects, parsed.tileEffectAssignments)
            : null;
        if (reconciled && !reconciled.ok) {
            alert(this.mapError(reconciled.error));
            return;
        }

        const mode = this.chooseImportMode(
            Array.isArray(current) ? current.length : 0,
            hasEffects
        );
        if (!mode) return;

        const applied = CustomSpritesIO.applyImport(current, parsed.sprites, mode);
        if (!applied.ok) {
            alert(this.mapError(applied.error));
            return;
        }

        this.assignCustomSprites(applied.sprites);
        if (reconciled?.ok) {
            game.customTileEffects = reconciled.definitions;
            for (const assignment of reconciled.resolvedAssignments) {
                assignment.tile.visualEffect = assignment.effectId;
            }
        }
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
        if (reconciled?.ok) {
            alert(this.format(
                'project.sprites.importSuccessWithEffects',
                {
                    applied: appliedCount,
                    skipped,
                    added: reconciled.added,
                    reused: reconciled.reused,
                    assignmentsApplied: reconciled.resolvedAssignments.length,
                    assignmentsSkipped: reconciled.skippedAssignments,
                },
                `Imported ${appliedCount} sprite(s) (${skipped} skipped), added ${reconciled.added} effect(s), reused ${reconciled.reused}, and applied ${reconciled.resolvedAssignments.length} tile assignment(s) (${reconciled.skippedAssignments} skipped).`
            ));
        } else {
            alert(
                this.format(
                    'project.sprites.importSuccess',
                    { applied: appliedCount, skippedSuffix },
                    `Imported ${appliedCount} sprite(s)${skippedSuffix}.`
                )
            );
        }
    }

    /**
     * Default merge; Cancel on merge dialog offers replace with a second confirm.
     * Returns null if the user aborts.
     */
    private chooseImportMode(
        currentCount: number,
        hasEffects: boolean
    ): 'merge' | 'replace' | null {
        if (currentCount === 0) {
            if (hasEffects) {
                const confirmed = window.confirm(
                    this.t(
                        'project.sprites.confirmEffectsOnly',
                        'Import this sprite pack? It will add custom effect recipes and overwrite effect assignments on the listed tiles.'
                    )
                );
                return confirmed ? 'replace' : null;
            }
            return 'replace';
        }

        const merge = window.confirm(
            hasEffects
                ? this.t(
                      'project.sprites.confirmMergeWithEffects',
                      'Merge into current custom sprites? The pack will also add custom effects and overwrite effect assignments on the listed tiles.\n\nOK = Merge\nCancel = Replace all sprites (with confirmation)'
                  )
                : this.t(
                      'project.sprites.confirmMerge',
                      'Merge into current custom sprites?\n\nOK = Merge\nCancel = Replace all (with confirmation)'
                  )
        );
        if (merge) return 'merge';

        const replace = window.confirm(
            hasEffects
                ? this.t(
                      'project.sprites.confirmReplaceWithEffects',
                      'Replace all custom sprites with the imported pack? The pack will also add custom effects and overwrite effect assignments on the listed tiles.'
                  )
                : this.t(
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
