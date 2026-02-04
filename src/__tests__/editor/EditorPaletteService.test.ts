import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorPaletteService } from '../../editor/modules/EditorPaletteService';
import { TextResources } from '../../runtime/adapters/TextResources';
import type { EditorManager } from '../../editor/EditorManager';

const CUSTOM_PALETTE = [
    '#112233', '#445566', '#778899', '#AABBCC',
    '#DDEEFF', '#000000', '#111111', '#222222',
    '#333333', '#444444', '#555555', '#666666',
    '#777777', '#888888', '#999999', '#ABCDEF'
];

const toRgb = (hex: string) => {
    const normalized = hex.replace('#', '');
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
};

type EditorManagerLike = {
    gameEngine: { getCustomPalette: () => string[] | undefined };
    dom: {
        paletteGrid: HTMLElement;
        projectPalettePanel: HTMLElement;
        projectPaletteToggle: HTMLButtonElement;
    };
    state: { palettePanelCollapsed: boolean };
};

describe('EditorPaletteService', () => {
    const originalLocale = TextResources.getLocale() as string;

    const createManager = (paletteCollapsed = true, palette = CUSTOM_PALETTE): EditorManagerLike => ({
        gameEngine: {
            getCustomPalette: vi.fn(() => palette)
        },
        dom: {
            paletteGrid: document.createElement('div'),
            projectPalettePanel: document.createElement('div'),
            projectPaletteToggle: document.createElement('button')
        },
        state: {
            palettePanelCollapsed: paletteCollapsed
        }
    });

    beforeEach(() => {
        TextResources.setLocale(originalLocale, { silent: true });
    });

    afterEach(() => {
        TextResources.setLocale(originalLocale, { silent: true });
    });

    it('renders the palette grid using the custom palette colors', () => {
        const manager = createManager();
        const service = new EditorPaletteService(manager as unknown as EditorManager);

        service.renderPaletteGrid();

        const buttons = manager.dom.paletteGrid.querySelectorAll('.palette-color-button');
        expect(buttons).toHaveLength(16);
        expect((buttons[0] as HTMLButtonElement).style.backgroundColor).toBe(toRgb(CUSTOM_PALETTE[0]));
    });

    it('uses English toggle labels when the locale is en-US', () => {
        TextResources.setLocale('en-US', { silent: true });

        const manager = createManager(true);
        const service = new EditorPaletteService(manager as unknown as EditorManager);

        service.syncPaletteState();
        expect(manager.dom.projectPaletteToggle.textContent).toContain('Show color palette');

        manager.state.palettePanelCollapsed = false;
        service.syncPaletteState();
        expect(manager.dom.projectPaletteToggle.textContent).toContain('Hide color palette');
    });
});
