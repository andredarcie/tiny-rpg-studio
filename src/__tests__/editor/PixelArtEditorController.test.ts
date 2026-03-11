import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PixelArtEditorController } from '../../editor/modules/PixelArtEditorController';
import { TextResources } from '../../runtime/adapters/TextResources';
import type { CustomSpriteEntry } from '../../types/gameState';

type PixelArtEditorManager = Parameters<PixelArtEditorController['init']>[0];
type PixelArtEditorDom = Parameters<PixelArtEditorController['init']>[1];

// Minimal manager stub
const makeManager = (customSprites: CustomSpriteEntry[] = []) => {
    const game = {
        customSprites,
        tileset: {
            tiles: [
                {
                    id: 1,
                    layouts: [Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 3))]
                },
                {
                    id: 2,
                    layouts: [
                        Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 1)),
                        Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 2)),
                    ]
                }
            ]
        }
    };
    const invalidate = vi.fn();
    const renderAll = vi.fn();
    const updateJSON = vi.fn();
    const pushCurrentState = vi.fn();
    const tileManager = {
        getTile: vi.fn().mockReturnValue({ id: 1, pixels: [[0]], frames: [[[ 0]]], animated: false }),
        refreshAnimationMetadata: vi.fn(),
    };
    const renderer = {
        spriteFactory: { invalidate },
        paletteManager: { getActivePalette: vi.fn(() => Array.from({ length: 16 }, () => '#000000')) },
    };
    const gameEngine = {
        getGame: vi.fn().mockReturnValue(game),
        renderer,
        tileManager,
        exportGameData: vi.fn().mockReturnValue({}),
    };
    const history = { pushCurrentState };
    return {
        manager: {
            gameEngine,
            renderAll,
            updateJSON,
            history,
        } as PixelArtEditorManager,
        game,
        invalidate,
        renderAll,
        updateJSON,
        pushCurrentState,
    };
};

// Minimal DOM stub
const makeDom = () => {
    const canvas = {
        getContext: vi.fn().mockReturnValue({
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 0,
        }),
        addEventListener: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 256, height: 256 }),
        width: 256,
        height: 256,
    } as unknown as HTMLCanvasElement;
    return {
        pixelArtEditorModal: { removeAttribute: vi.fn(), setAttribute: vi.fn(), hidden: true },
        paeCanvas: canvas,
        paePalette: { innerHTML: '', appendChild: vi.fn(), addEventListener: vi.fn() },
        paeSpriteMeta: { textContent: '' },
        paeVariantBar: { hidden: true, innerHTML: '' },
        paeFrameBar: document.createElement('div'),
        paeSave: { addEventListener: vi.fn() },
        paeReset: { addEventListener: vi.fn() },
        paeClose: { addEventListener: vi.fn() },
        paeToolPaint: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        paeToolErase: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
    } as unknown as PixelArtEditorDom;
};

describe('PixelArtEditorController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        TextResources.setLocale('en-US', { silent: true });
    });

    describe('open - loads sprites', () => {
        it('loads custom frames when a customSprites entry exists', () => {
            const customFrames = [[[5, 6], [7, 8]]];
            const { manager } = makeManager([
                { group: 'npc', key: 'wizard', variant: 'base', frames: customFrames },
            ]);
            const controller = new PixelArtEditorController();
            controller.init(manager, makeDom());

            controller.open('npc', 'wizard', 'base');

            expect(controller.getCurrentFrames()).toEqual(customFrames);
        });

        it('loads a tile from numeric layouts when opening the tile editor', () => {
            const { manager } = makeManager();
            const controller = new PixelArtEditorController();
            controller.init(manager, makeDom());

            controller.open('tile', '1');

            expect(controller.getCurrentFrames()[0]?.[0]?.[0]).toBe(3);
            expect(controller.getCurrentFrames()[0]?.length).toBe(8);
        });

        it('loads animated tile frames and renders frame buttons', () => {
            const { manager } = makeManager();
            const dom = makeDom();
            const controller = new PixelArtEditorController();
            controller.init(manager, dom);

            const opened = controller.open('tile', '2');

            expect(opened).toBe(true);
            expect(controller.getCurrentFrames()).toHaveLength(2);
            expect(dom.paeFrameBar.hidden).toBe(false);
            expect(dom.paeFrameBar.querySelectorAll('.pae-frame-btn')).toHaveLength(2);
            expect(dom.paeFrameBar.textContent).toContain('Frame 0');
            expect(dom.paeFrameBar.textContent).toContain('Frame 1');
        });

        it('switches the active frame when clicking a frame button', () => {
            const { manager } = makeManager();
            const dom = makeDom();
            const canvasContext = dom.paeCanvas.getContext('2d') as ReturnType<typeof vi.fn>;
            const controller = new PixelArtEditorController();
            controller.init(manager, dom);
            controller.open('tile', '2');

            const frameButtons = dom.paeFrameBar.querySelectorAll('.pae-frame-btn');
            (frameButtons[1] as HTMLButtonElement).click();
            const rerenderedButtons = dom.paeFrameBar.querySelectorAll('.pae-frame-btn');

            expect((rerenderedButtons[1] as HTMLButtonElement).classList.contains('active')).toBe(true);
            expect(canvasContext.clearRect).toHaveBeenCalled();
        });

        it('localizes palette swatch titles', () => {
            const { manager } = makeManager();
            const dom = makeDom();
            const appendChild = dom.paePalette.appendChild as unknown as ReturnType<typeof vi.fn>;
            const controller = new PixelArtEditorController();
            controller.init(manager, dom);

            controller.open('tile', '1');

            const appended = appendChild.mock.calls.map(([element]) => element as HTMLButtonElement);
            expect(appended[0]?.title).toBe('Color 0');
            expect(appended[appended.length - 1]?.title).toBe('Transparent');
        });
    });

    describe('save', () => {
        it('upserts into game.customSprites', () => {
            const { manager, game } = makeManager();
            const controller = new PixelArtEditorController();
            controller.init(manager, makeDom());
            controller.open('npc', 'wizard', 'base');
            controller.setFrames([[[3, 3]]]);

            controller.save();

            expect(game.customSprites.length).toBe(1);
            expect(game.customSprites[0].key).toBe('wizard');
            expect(game.customSprites[0].frames).toEqual([[[3, 3]]]);
        });

        it('calls invalidate on the renderer', () => {
            const { manager, invalidate } = makeManager();
            const controller = new PixelArtEditorController();
            controller.init(manager, makeDom());
            controller.open('npc', 'wizard', 'base');
            controller.save();

            expect(invalidate).toHaveBeenCalled();
        });

        it('calls renderAll and pushCurrentState', () => {
            const { manager, renderAll, pushCurrentState } = makeManager();
            const controller = new PixelArtEditorController();
            controller.init(manager, makeDom());
            controller.open('npc', 'wizard', 'base');
            controller.save();

            expect(renderAll).toHaveBeenCalled();
            expect(pushCurrentState).toHaveBeenCalled();
        });
    });

    describe('resetToDefault', () => {
        it('reloads the base sprite into frames without changing game.customSprites', () => {
            const { manager, game } = makeManager([
                { group: 'npc', key: 'wizard', variant: 'base', frames: [[[9, 9]]] },
            ]);
            const controller = new PixelArtEditorController();
            controller.init(manager, makeDom());
            controller.open('npc', 'wizard', 'base');
            // Manually edit one pixel.
            controller.setFrames([[[7, 7]]]);

            controller.resetToDefault();

            expect(game.customSprites.length).toBe(1);
            expect(controller.getCurrentFrames()).not.toEqual([[[7, 7]]]);
        });

        it('does not call invalidate or renderAll because it does not save', () => {
            const { manager, invalidate, renderAll } = makeManager([
                { group: 'npc', key: 'wizard', variant: 'base', frames: [[[0]]] },
            ]);
            const controller = new PixelArtEditorController();
            controller.init(manager, makeDom());
            controller.open('npc', 'wizard', 'base');

            controller.resetToDefault();

            expect(invalidate).not.toHaveBeenCalled();
            expect(renderAll).not.toHaveBeenCalled();
        });
    });
});
