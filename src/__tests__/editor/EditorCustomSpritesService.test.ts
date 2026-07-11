import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorCustomSpritesService } from '../../editor/modules/EditorCustomSpritesService';
import { CustomSpritesIO } from '../../editor/modules/CustomSpritesIO';
import type { CustomSpriteEntry, CustomSpriteFrame } from '../../types/gameState';

function makeFrame(fill: number | null = 3): CustomSpriteFrame {
    return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => fill));
}

function makeEntry(
    overrides: Partial<CustomSpriteEntry> & Pick<CustomSpriteEntry, 'group' | 'key'> = {
        group: 'tile',
        key: '0',
    }
): CustomSpriteEntry {
    return {
        group: overrides.group,
        key: overrides.key,
        variant: overrides.variant ?? 'base',
        frames: overrides.frames ?? [makeFrame()],
    };
}

type ServiceManager = ConstructorParameters<typeof EditorCustomSpritesService>[0];

type ManagerFixture = {
    gameEngine: {
        getGame: ReturnType<typeof vi.fn>;
        draw: ReturnType<typeof vi.fn>;
        renderer: { spriteFactory: { invalidate: ReturnType<typeof vi.fn> } };
        tileManager: { refreshAnimationMetadata: ReturnType<typeof vi.fn> };
    };
    historyManager: { pushCurrentState: ReturnType<typeof vi.fn> };
    renderAll: ReturnType<typeof vi.fn>;
    updateJSON: ReturnType<typeof vi.fn>;
    dom: {
        spritesImportButton: HTMLButtonElement;
        spritesExportButton: HTMLButtonElement;
        spritesClearButton: HTMLButtonElement;
    };
    game: { title: string; customSprites?: CustomSpriteEntry[] };
};

function asServiceManager(manager: ManagerFixture): ServiceManager {
    return manager as unknown as ServiceManager;
}

function createManager(customSprites?: CustomSpriteEntry[]): ManagerFixture {
    const game: ManagerFixture['game'] = {
        title: 'My Test Game',
        customSprites,
    };

    return {
        gameEngine: {
            getGame: vi.fn(() => game),
            draw: vi.fn(),
            renderer: { spriteFactory: { invalidate: vi.fn() } },
            tileManager: { refreshAnimationMetadata: vi.fn() },
        },
        historyManager: { pushCurrentState: vi.fn() },
        renderAll: vi.fn(),
        updateJSON: vi.fn(),
        dom: {
            spritesImportButton: document.createElement('button'),
            spritesExportButton: document.createElement('button'),
            spritesClearButton: document.createElement('button'),
        },
        game,
    };
}

describe('EditorCustomSpritesService', () => {
    let alertMock: ReturnType<typeof vi.fn>;
    let confirmMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        document.body.innerHTML = '';
        alertMock = vi.fn();
        confirmMock = vi.fn(() => true);
        vi.stubGlobal('alert', alertMock);
        vi.stubGlobal('confirm', confirmMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('initialize binds click handlers', () => {
        const manager = createManager([makeEntry()]);
        const service = new EditorCustomSpritesService(asServiceManager(manager));
        const exportSpy = vi.spyOn(service, 'exportSprites').mockImplementation(() => undefined);
        service.initialize();
        manager.dom.spritesExportButton.click();
        expect(exportSpy).toHaveBeenCalledOnce();
    });

    it('exportSprites refuses empty customSprites', () => {
        const manager = createManager(undefined);
        const service = new EditorCustomSpritesService(asServiceManager(manager));
        const createObjectURL = vi.fn(() => 'blob:test');
        const revokeObjectURL = vi.fn();
        vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

        service.exportSprites();

        expect(alertMock).toHaveBeenCalled();
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('exportSprites does not alert when customs exist (download path runs without empty guard)', () => {
        const manager = createManager([makeEntry({ group: 'tile', key: '0' })]);
        const service = new EditorCustomSpritesService(asServiceManager(manager));

        // Avoid jsdom navigation: intercept Blob download by stubbing createObjectURL
        // and never invoking the real anchor activation path.
        const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
            throw new Error('stop-download');
        });

        expect(() => service.exportSprites()).toThrow('stop-download');
        expect(createObjectURL).toHaveBeenCalledOnce();
        expect(alertMock).not.toHaveBeenCalled();
    });

    it('applyPackText merge path mutates game, invalidates caches, and pushes history', () => {
        const manager = createManager([makeEntry({ group: 'tile', key: 'old' })]);
        const service = new EditorCustomSpritesService(asServiceManager(manager));
        confirmMock.mockReturnValue(true); // merge

        const pack = CustomSpritesIO.serialize([
            makeEntry({ group: 'npc', key: 'default', frames: [makeFrame(7)] }),
        ]);
        expect(pack.ok).toBe(true);
        if (!pack.ok) return;

        service.applyPackText(pack.text);

        expect(manager.game.customSprites).toHaveLength(2);
        expect(manager.gameEngine.renderer.spriteFactory.invalidate).toHaveBeenCalledOnce();
        expect(manager.gameEngine.tileManager.refreshAnimationMetadata).toHaveBeenCalledOnce();
        expect(manager.renderAll).toHaveBeenCalledOnce();
        expect(manager.gameEngine.draw).toHaveBeenCalledOnce();
        expect(manager.updateJSON).toHaveBeenCalledOnce();
        expect(manager.historyManager.pushCurrentState).toHaveBeenCalledOnce();
        expect(alertMock).toHaveBeenCalled();
    });

    it('applyPackText does not mutate on invalid pack', () => {
        const existing = [makeEntry({ group: 'tile', key: 'keep' })];
        const manager = createManager(existing);
        const service = new EditorCustomSpritesService(asServiceManager(manager));

        service.applyPackText('{not-json');

        expect(manager.game.customSprites).toBe(existing);
        expect(manager.historyManager.pushCurrentState).not.toHaveBeenCalled();
        expect(manager.gameEngine.renderer.spriteFactory.invalidate).not.toHaveBeenCalled();
    });

    it('applyPackText does not mutate on empty pack', () => {
        const existing = [makeEntry()];
        const manager = createManager(existing);
        const service = new EditorCustomSpritesService(asServiceManager(manager));

        service.applyPackText(
            JSON.stringify({
                format: CustomSpritesIO.FORMAT,
                version: 1,
                sprites: [],
            })
        );

        expect(manager.game.customSprites).toBe(existing);
        expect(manager.historyManager.pushCurrentState).not.toHaveBeenCalled();
    });

    it('clearSprites confirms and sets customSprites to undefined', () => {
        const manager = createManager([makeEntry()]);
        const service = new EditorCustomSpritesService(asServiceManager(manager));
        confirmMock.mockReturnValue(true);

        service.clearSprites();

        expect(manager.game.customSprites).toBeUndefined();
        expect(manager.historyManager.pushCurrentState).toHaveBeenCalledOnce();
        expect(manager.gameEngine.draw).toHaveBeenCalledOnce();
    });

    it('clearSprites aborts when confirm is cancelled', () => {
        const existing = [makeEntry()];
        const manager = createManager(existing);
        const service = new EditorCustomSpritesService(asServiceManager(manager));
        confirmMock.mockReturnValue(false);

        service.clearSprites();

        expect(manager.game.customSprites).toBe(existing);
        expect(manager.historyManager.pushCurrentState).not.toHaveBeenCalled();
    });

    it('replace mode replaces entire list when merge confirm is cancelled and replace confirmed', () => {
        const manager = createManager([makeEntry({ group: 'tile', key: 'old' })]);
        const service = new EditorCustomSpritesService(asServiceManager(manager));
        // First confirm (merge?) = false → second confirm (replace?) = true
        confirmMock.mockReturnValueOnce(false).mockReturnValueOnce(true);

        const pack = CustomSpritesIO.serialize([makeEntry({ group: 'player', key: 'default' })]);
        expect(pack.ok).toBe(true);
        if (!pack.ok) return;

        service.applyPackText(pack.text);

        expect(manager.game.customSprites).toHaveLength(1);
        expect(manager.game.customSprites?.[0]?.group).toBe('player');
    });
});
