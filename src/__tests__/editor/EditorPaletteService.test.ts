import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorPaletteService } from '../../editor/modules/EditorPaletteService';
import { TextResources } from '../../runtime/adapters/TextResources';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';

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

type PaletteServiceManager = ConstructorParameters<typeof EditorPaletteService>[0];

type PaletteDomFixture = {
    paletteGrid: HTMLDivElement | null;
    projectPalettePanel: HTMLDivElement | null;
    projectPaletteToggle: HTMLButtonElement | null;
    colorPickerModal: HTMLDivElement | null;
    colorPickerInput: HTMLInputElement | null;
    colorPreviewCurrent: HTMLDivElement | null;
    colorPreviewNew: HTMLDivElement | null;
    colorPickerIndex: HTMLSpanElement | null;
    palettePresetSelect: HTMLSelectElement | null;
    paletteResetButton: HTMLButtonElement | null;
    colorPickerConfirm: HTMLButtonElement | null;
    colorPickerCancel: HTMLButtonElement | null;
    paletteImportButton: HTMLButtonElement | null;
    paletteExportButton: HTMLButtonElement | null;
};

type PaletteManagerFixture = {
    gameEngine: {
        getCustomPalette: ReturnType<typeof vi.fn<() => string[] | null>>;
        setCustomPalette: ReturnType<typeof vi.fn<(p: string[]) => void>>;
        resetPaletteToDefault: ReturnType<typeof vi.fn<() => void>>;
        draw: ReturnType<typeof vi.fn>;
    };
    historyManager: { pushCurrentState: ReturnType<typeof vi.fn> };
    renderAll: ReturnType<typeof vi.fn>;
    dom: PaletteDomFixture;
    state: {
        palettePanelCollapsed: boolean;
        editingColorIndex: number | null;
    };
};

function asPaletteServiceManager(manager: PaletteManagerFixture): PaletteServiceManager {
    return manager as unknown as PaletteServiceManager;
}

function createManager(overrides: {
    paletteCollapsed?: boolean;
    palette?: string[] | null;
    editingColorIndex?: number | null;
} = {}): PaletteManagerFixture {
    const {
        paletteCollapsed = true,
        palette = CUSTOM_PALETTE,
        editingColorIndex = null
    } = overrides;

    const paletteGrid = document.createElement('div');
    const projectPalettePanel = document.createElement('div');
    const projectPaletteToggle = document.createElement('button');
    const colorPickerModal = document.createElement('div');
    colorPickerModal.hidden = true;
    const colorPickerInput = document.createElement('input') as HTMLInputElement;
    const colorPreviewCurrent = document.createElement('div');
    const colorPreviewNew = document.createElement('div');
    const colorPickerIndex = document.createElement('span');
    const palettePresetSelect = document.createElement('select');
    const paletteResetButton = document.createElement('button');
    const colorPickerConfirm = document.createElement('button');
    const colorPickerCancel = document.createElement('button');

    let customPalette: string[] | null = palette;

    const gameEngine = {
        getCustomPalette: vi.fn(() => customPalette),
        setCustomPalette: vi.fn((p: string[]) => { customPalette = p; }),
        resetPaletteToDefault: vi.fn(() => { customPalette = null; }),
        draw: vi.fn()
    };

    const historyManager = { pushCurrentState: vi.fn() };
    const renderAll = vi.fn();

    const manager: PaletteManagerFixture = {
        gameEngine,
        historyManager,
        renderAll,
        dom: {
            paletteGrid,
            projectPalettePanel,
            projectPaletteToggle,
            colorPickerModal,
            colorPickerInput,
            colorPreviewCurrent,
            colorPreviewNew,
            colorPickerIndex,
            palettePresetSelect,
            paletteResetButton,
            colorPickerConfirm,
            colorPickerCancel,
            paletteImportButton: null,
            paletteExportButton: null
        },
        state: {
            palettePanelCollapsed: paletteCollapsed,
            editingColorIndex
        }
    };

    return manager;
}

describe('EditorPaletteService', () => {
    const originalLocale = TextResources.getLocale();

    beforeEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
        TextResources.setLocale(originalLocale, { silent: true });
    });

    afterEach(() => {
        TextResources.setLocale(originalLocale, { silent: true });
    });

    // ─── renderPaletteGrid ────────────────────────────────────────────────────

    it('renders the palette grid using the custom palette colors', () => {
        const manager = createManager();
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.renderPaletteGrid();

        const buttons = manager.dom.paletteGrid.querySelectorAll('.palette-color-button');
        expect(buttons).toHaveLength(16);
        expect((buttons[0] as HTMLButtonElement).style.backgroundColor).toBe(toRgb(CUSTOM_PALETTE[0]));
    });

    it('returns early from renderPaletteGrid when grid element is missing', () => {
        const manager = createManager();
        manager.dom.paletteGrid = null;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        expect(() => service.renderPaletteGrid()).not.toThrow();
    });

    it('falls back to PICO8_COLORS when no custom palette is set', () => {
        const manager = createManager({ palette: null });
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.renderPaletteGrid();

        const buttons = manager.dom.paletteGrid.querySelectorAll('.palette-color-button');
        expect(buttons).toHaveLength(TileDefinitions.PICO8_COLORS.length);
    });

    it('sets data-color-index and aria-label on each button', () => {
        const manager = createManager();
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.renderPaletteGrid();

        const buttons = manager.dom.paletteGrid.querySelectorAll('.palette-color-button');
        const btn = buttons[3] as HTMLButtonElement;
        expect(btn.dataset.colorIndex).toBe('3');
        expect(btn.getAttribute('aria-label')).toContain('3');
        expect(btn.getAttribute('aria-label')).toContain(CUSTOM_PALETTE[3]);
    });

    // ─── syncPaletteState / togglePanel ──────────────────────────────────────

    it('uses English toggle labels when the locale is en-US', () => {
        TextResources.setLocale('en-US', { silent: true });

        const manager = createManager({ paletteCollapsed: true });
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.syncPaletteState();
        expect(manager.dom.projectPaletteToggle.textContent).toContain('Show color palette');

        manager.state.palettePanelCollapsed = false;
        service.syncPaletteState();
        expect(manager.dom.projectPaletteToggle.textContent).toContain('Hide color palette');
    });

    it('returns early from syncPaletteState when dom elements are missing', () => {
        const manager = createManager();
        manager.dom.projectPalettePanel = null;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        expect(() => service.syncPaletteState()).not.toThrow();
    });

    it('togglePanel hides an open panel and collapses state', () => {
        const manager = createManager({ paletteCollapsed: false });
        manager.dom.projectPalettePanel.hidden = false;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.togglePanel();

        expect(manager.dom.projectPalettePanel.hidden).toBe(true);
        expect(manager.state.palettePanelCollapsed).toBe(true);
    });

    it('togglePanel shows a hidden panel and expands state', () => {
        const manager = createManager({ paletteCollapsed: true });
        manager.dom.projectPalettePanel.hidden = true;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.togglePanel();

        expect(manager.dom.projectPalettePanel.hidden).toBe(false);
        expect(manager.state.palettePanelCollapsed).toBe(false);
    });

    it('returns early from togglePanel when dom elements are missing', () => {
        const manager = createManager();
        manager.dom.projectPalettePanel = null;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        expect(() => service.togglePanel()).not.toThrow();
    });

    // ─── closeColorPicker ─────────────────────────────────────────────────────

    it('hides modal and clears editingColorIndex on closeColorPicker', () => {
        const manager = createManager({ editingColorIndex: 3 });
        manager.dom.colorPickerModal.hidden = false;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.closeColorPicker();

        expect(manager.dom.colorPickerModal.hidden).toBe(true);
        expect(manager.state.editingColorIndex).toBeNull();
    });

    it('closeColorPicker still clears state when modal element is missing', () => {
        const manager = createManager({ editingColorIndex: 5 });
        manager.dom.colorPickerModal = null;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.closeColorPicker();

        expect(manager.state.editingColorIndex).toBeNull();
    });

    // ─── confirmColorChange ───────────────────────────────────────────────────

    it('closes picker without applying when editingColorIndex is null', () => {
        const manager = createManager({ editingColorIndex: null });
        manager.dom.colorPickerModal.hidden = false;
        manager.dom.colorPickerInput.value = '#ABCDEF';
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.confirmColorChange();

        expect(manager.gameEngine.setCustomPalette).not.toHaveBeenCalled();
        expect(manager.dom.colorPickerModal.hidden).toBe(true);
    });

    it('closes picker and warns when color format is invalid', () => {
        const manager = createManager({ editingColorIndex: 0 });
        manager.dom.colorPickerInput.value = 'not-a-color';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.confirmColorChange();

        expect(manager.gameEngine.setCustomPalette).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        expect(manager.dom.colorPickerModal.hidden).toBe(true);
        warnSpy.mockRestore();
    });

    it('applies valid color, closes modal and triggers re-render', () => {
        const manager = createManager({ editingColorIndex: 2 });
        manager.dom.colorPickerInput.value = '#FF0000';
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.confirmColorChange();

        expect(manager.gameEngine.setCustomPalette).toHaveBeenCalled();
        const appliedPalette = manager.gameEngine.setCustomPalette.mock.calls[0][0] as string[];
        expect(appliedPalette[2]).toBe('#FF0000');
        expect(manager.dom.colorPickerModal.hidden).toBe(true);
        expect(manager.renderAll).toHaveBeenCalled();
        expect(manager.gameEngine.draw).toHaveBeenCalled();
        expect(manager.historyManager.pushCurrentState).toHaveBeenCalled();
    });

    it('normalises color to uppercase before applying', () => {
        const manager = createManager({ editingColorIndex: 0 });
        manager.dom.colorPickerInput.value = '#abcdef';
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.confirmColorChange();

        const appliedPalette = manager.gameEngine.setCustomPalette.mock.calls[0][0] as string[];
        expect(appliedPalette[0]).toBe('#ABCDEF');
    });

    it('does not apply color when index is out of range', () => {
        const manager = createManager({ editingColorIndex: 20 });
        manager.dom.colorPickerInput.value = '#FFFFFF';
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.confirmColorChange();

        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('creates new palette from PICO8 colors when no custom palette is set', () => {
        const manager = createManager({ editingColorIndex: 1, palette: null });
        manager.dom.colorPickerInput.value = '#123456';
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.confirmColorChange();

        const appliedPalette = manager.gameEngine.setCustomPalette.mock.calls[0][0] as string[];
        expect(appliedPalette[1]).toBe('#123456');
        expect(appliedPalette).toHaveLength(16);
    });

    // ─── resetToDefault ───────────────────────────────────────────────────────

    it('resets palette, re-renders and saves to history', () => {
        const manager = createManager();
        const service = new EditorPaletteService(asPaletteServiceManager(manager));

        service.resetToDefault();

        expect(manager.gameEngine.resetPaletteToDefault).toHaveBeenCalled();
        expect(manager.renderAll).toHaveBeenCalled();
        expect(manager.gameEngine.draw).toHaveBeenCalled();
        expect(manager.historyManager.pushCurrentState).toHaveBeenCalled();
    });

    // ─── initialize ───────────────────────────────────────────────────────────

    it('initialize calls populatePresetSelect, renderPaletteGrid, syncPaletteState', () => {
        const manager = createManager();
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        // palettePresetSelect should have options populated
        expect(manager.dom.palettePresetSelect.options.length).toBeGreaterThan(0);
        // palette grid should have 16 buttons
        const buttons = manager.dom.paletteGrid.querySelectorAll('.palette-color-button');
        expect(buttons.length).toBe(16);
    });

    it('initialize returns early for missing elements without throwing', () => {
        const manager = createManager();
        manager.dom.paletteGrid = null;
        manager.dom.palettePresetSelect = null;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        expect(() => service.initialize()).not.toThrow();
    });

    // ─── openColorPicker (via button click) ───────────────────────────────────

    it('clicking a palette button opens the color picker modal', () => {
        const manager = createManager({ editingColorIndex: null });
        manager.dom.colorPickerModal.hidden = true;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.renderPaletteGrid();
        const btn = manager.dom.paletteGrid.querySelector('.palette-color-button') as HTMLButtonElement;
        btn.click();
        expect(manager.dom.colorPickerModal.hidden).toBe(false);
        expect(manager.state.editingColorIndex).toBe(0);
    });

    it('openColorPicker sets input value and swatches to current color', () => {
        const manager = createManager({ editingColorIndex: null });
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.renderPaletteGrid();
        const btn = manager.dom.paletteGrid.querySelectorAll('.palette-color-button')[2] as HTMLButtonElement;
        btn.click();
        expect(manager.dom.colorPickerInput.value).toBe(CUSTOM_PALETTE[2]);
    });

    it('openColorPicker returns early when required DOM elements missing', () => {
        const manager = createManager();
        manager.dom.colorPickerModal = null;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.renderPaletteGrid();
        const btn = manager.dom.paletteGrid.querySelector('.palette-color-button') as HTMLButtonElement;
        expect(() => btn.click()).not.toThrow();
        // state should remain null since no modal
        expect(manager.state.editingColorIndex).toBeNull();
    });

    // ─── populatePresetSelect / syncPresetSelect ──────────────────────────────

    it('populatePresetSelect creates options for each preset plus Custom', () => {
        const manager = createManager();
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        // First option should be "Custom"
        expect(manager.dom.palettePresetSelect.options[0].value).toBe('custom');
        // Should have more than 1 option (Custom + presets)
        expect(manager.dom.palettePresetSelect.options.length).toBeGreaterThan(1);
    });

    it('syncPresetSelect selects "custom" when palette does not match any preset', () => {
        const manager = createManager({ palette: CUSTOM_PALETTE }); // non-standard palette
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        expect(manager.dom.palettePresetSelect.value).toBe('custom');
    });

    // ─── onPresetChange (via select change event) ─────────────────────────────

    it('changing preset select applies preset palette and re-renders', () => {
        const manager = createManager();
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        // Change select to first non-custom option
        if (manager.dom.palettePresetSelect.options.length > 1) {
            manager.dom.palettePresetSelect.value = '0';
            manager.dom.palettePresetSelect.dispatchEvent(new Event('change'));
            expect(manager.gameEngine.setCustomPalette).toHaveBeenCalled();
            expect(manager.renderAll).toHaveBeenCalled();
        }
    });

    it('selecting "custom" in preset select does nothing', () => {
        const manager = createManager();
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        manager.dom.palettePresetSelect.value = 'custom';
        manager.dom.palettePresetSelect.dispatchEvent(new Event('change'));
        expect(manager.gameEngine.setCustomPalette).not.toHaveBeenCalled();
    });

    // ─── bindEvents ──────────────────────────────────────────────────────────

    it('reset button click calls resetToDefault', () => {
        const manager = createManager();
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        manager.dom.paletteResetButton.click();
        expect(manager.gameEngine.resetPaletteToDefault).toHaveBeenCalled();
    });

    it('toggle button click calls togglePanel', () => {
        const manager = createManager({ paletteCollapsed: false });
        manager.dom.projectPalettePanel.hidden = false;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        manager.dom.projectPaletteToggle.click();
        expect(manager.state.palettePanelCollapsed).toBe(true);
    });

    it('color picker confirm button calls confirmColorChange', () => {
        const manager = createManager({ editingColorIndex: 0 });
        manager.dom.colorPickerInput.value = '#AABBCC';
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        manager.dom.colorPickerConfirm.click();
        expect(manager.gameEngine.setCustomPalette).toHaveBeenCalled();
    });

    it('color picker cancel button closes the picker', () => {
        const manager = createManager({ editingColorIndex: 3 });
        manager.dom.colorPickerModal.hidden = false;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        manager.dom.colorPickerCancel.click();
        expect(manager.dom.colorPickerModal.hidden).toBe(true);
    });

    it('ESC key closes the color picker when modal is visible', () => {
        const manager = createManager({ editingColorIndex: 1 });
        manager.dom.colorPickerModal.hidden = false;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(ev);
        expect(manager.dom.colorPickerModal.hidden).toBe(true);
    });

    it('ESC key does nothing when modal is already hidden', () => {
        const manager = createManager({ editingColorIndex: null });
        manager.dom.colorPickerModal.hidden = true;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(ev);
        // still hidden, no error
        expect(manager.dom.colorPickerModal.hidden).toBe(true);
    });

    it('clicking modal backdrop closes the color picker', () => {
        const manager = createManager({ editingColorIndex: 2 });
        manager.dom.colorPickerModal.hidden = false;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        // Simulate click on the modal itself (not a child element)
        const ev = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(ev, 'target', { value: manager.dom.colorPickerModal });
        manager.dom.colorPickerModal.dispatchEvent(ev);
        expect(manager.dom.colorPickerModal.hidden).toBe(true);
    });

    // ─── paletteExportButton ─────────────────────────────────────────────────

    it('export button triggers download when palette has 16 colors', () => {
        const origCreate = URL.createObjectURL;
        URL.createObjectURL = vi.fn(() => 'blob:test-export');
        URL.revokeObjectURL = vi.fn();
        const exportBtn = document.createElement('button');
        const manager = createManager();
        manager.dom.paletteExportButton = exportBtn;
        const service = new EditorPaletteService(asPaletteServiceManager(manager));
        service.initialize();
        exportBtn.click();
        expect(URL.createObjectURL).toHaveBeenCalled();
        URL.createObjectURL = origCreate;
    });
});



