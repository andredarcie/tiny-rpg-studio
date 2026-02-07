import type { EditorManager } from '../EditorManager';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';
import { PALETTE_PRESETS } from '../../runtime/domain/definitions/PalettePresets';
import { TextResources } from '../../runtime/adapters/TextResources';

export class EditorPaletteService {
    manager: EditorManager;

    constructor(manager: EditorManager) {
        this.manager = manager;
    }

    private get text() {
        return TextResources;
    }

    // Returns a translated string if available, otherwise falls back to the provided default or the key itself.
    private t(key: string, fallback = ''): string {
        const textResources = this.text as typeof TextResources & { get: (lookupKey: string, defaultValue: string) => string };
        const translatedText = textResources.get(key, fallback);
        if (translatedText) return translatedText;
        if (fallback) return fallback;
        return key || '';
    }

    initialize(): void {
        this.populatePresetSelect();
        this.renderPaletteGrid();
        this.bindEvents();
        this.syncPaletteState();
    }

    renderPaletteGrid(): void {
        const grid = this.manager.dom.paletteGrid;
        if (!grid) return;

        const palette = this.getCurrentPalette();
        grid.innerHTML = '';

        palette.forEach((color, index) => {
            const button = document.createElement('button');
            button.className = 'palette-color-button';
            button.style.backgroundColor = color;
            button.dataset.colorIndex = String(index);
            button.setAttribute('aria-label', `Color ${index}: ${color}`);
            button.title = `Cor ${index}: ${color}`;

            button.addEventListener('click', () => {
                this.openColorPicker(index);
            });

            grid.appendChild(button);
        });
    }

    private getCurrentPalette(): string[] {
        const customPalette = this.manager.gameEngine.getCustomPalette();
        return customPalette || [...TileDefinitions.PICO8_COLORS];
    }

    private openColorPicker(colorIndex: number): void {
        const modal = this.manager.dom.colorPickerModal;
        const input = this.manager.dom.colorPickerInput;
        const currentSwatch = this.manager.dom.colorPreviewCurrent;
        const newSwatch = this.manager.dom.colorPreviewNew;
        const indexLabel = this.manager.dom.colorPickerIndex;
        const currentValue = document.getElementById('color-preview-current-value');
        const newValue = document.getElementById('color-preview-new-value');

        if (!modal || !input || !currentSwatch || !newSwatch || !indexLabel) return;

        this.manager.state.editingColorIndex = colorIndex;

        const currentColor = this.getCurrentPalette()[colorIndex];

        // Setup UI
        input.value = currentColor;
        currentSwatch.style.backgroundColor = currentColor;
        newSwatch.style.backgroundColor = currentColor;
        if (currentValue) currentValue.textContent = currentColor.toUpperCase();
        if (newValue) newValue.textContent = currentColor.toUpperCase();
        indexLabel.textContent = `#${colorIndex}`;

        // Show modal
        modal.hidden = false;

        // Update preview on input change
        const updatePreview = () => {
            newSwatch.style.backgroundColor = input.value;
            if (newValue) newValue.textContent = input.value.toUpperCase();
        };
        input.addEventListener('input', updatePreview);
    }

    closeColorPicker(): void {
        const modal = this.manager.dom.colorPickerModal;
        if (modal) {
            modal.hidden = true;
        }
        this.manager.state.editingColorIndex = null;
    }

    confirmColorChange(): void {
        const colorIndex = this.manager.state.editingColorIndex;
        const input = this.manager.dom.colorPickerInput;

        if (colorIndex === null || !input) {
            this.closeColorPicker();
            return;
        }

        const newColor = input.value.trim().toUpperCase();

        // Validate hex color format
        if (!this.isValidHexColor(newColor)) {
            console.warn(`Invalid hex color format: "${newColor}". Expected format: #RRGGBB`);
            this.closeColorPicker();
            return;
        }

        this.setColorAtIndex(colorIndex, newColor);
        this.closeColorPicker();
        this.renderPaletteGrid();
        this.syncPresetSelect();

        // Força re-render completo do editor e do jogo
        this.manager.renderAll();
        this.manager.gameEngine.draw();

        // Salva no histórico
        this.manager.historyManager.pushCurrentState();
    }

    private isValidHexColor(color: string): boolean {
        // Validate hex color format: #RRGGBB (6 hex digits)
        return /^#[0-9A-Fa-f]{6}$/.test(color);
    }

    private setColorAtIndex(index: number, color: string): void {
        // Validate index bounds
        if (index < 0 || index >= 16) {
            console.error(`Invalid palette index: ${index}. Must be between 0 and 15.`);
            return;
        }

        // Validate color format
        if (!this.isValidHexColor(color)) {
            console.error(`Invalid hex color format: "${color}". Expected format: #RRGGBB`);
            return;
        }

        let customPalette = this.manager.gameEngine.getCustomPalette();

        if (!customPalette) {
            customPalette = [...TileDefinitions.PICO8_COLORS];
        } else {
            customPalette = [...customPalette];
        }

        customPalette[index] = color;
        this.manager.gameEngine.setCustomPalette(customPalette);
    }

    resetToDefault(): void {
        this.manager.gameEngine.resetPaletteToDefault();
        this.renderPaletteGrid();
        this.syncPresetSelect();

        // Força re-render completo do editor e do jogo
        this.manager.renderAll();
        this.manager.gameEngine.draw();

        this.manager.historyManager.pushCurrentState();
    }

    togglePanel(): void {
        const panel = this.manager.dom.projectPalettePanel;
        const toggle = this.manager.dom.projectPaletteToggle;

        if (!panel || !toggle) return;

        const isHidden = panel.hidden;
        panel.hidden = !isHidden;
        toggle.setAttribute('aria-expanded', String(!isHidden));

        this.manager.state.palettePanelCollapsed = !isHidden;

        // Update button text
        this.updateToggleText();
    }

    syncPaletteState(): void {
        const panel = this.manager.dom.projectPalettePanel;
        const toggle = this.manager.dom.projectPaletteToggle;

        if (!panel || !toggle) return;

        const isCollapsed = this.manager.state.palettePanelCollapsed;
        panel.hidden = isCollapsed;
        toggle.setAttribute('aria-expanded', String(!isCollapsed));

        // Update button text
        this.updateToggleText();
    }

    private updateToggleText(): void {
        const toggle = this.manager.dom.projectPaletteToggle;
        if (!toggle) return;

        const isCollapsed = this.manager.state.palettePanelCollapsed;
        const actionText = isCollapsed
            ? this.t('project.paletteExpand', 'Show color palette')
            : this.t('project.paletteCollapse', 'Hide color palette');

        toggle.textContent = `🎨 ${actionText}`;
    }

    private populatePresetSelect(): void {
        const select = this.manager.dom.palettePresetSelect;
        if (!select) return;

        select.innerHTML = '';

        // "Custom" option
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = this.t('project.palettePresetCustom', 'Custom');
        select.appendChild(customOption);

        // Preset options
        PALETTE_PRESETS.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = preset.name;
            select.appendChild(option);
        });

        this.syncPresetSelect();
    }

    private syncPresetSelect(): void {
        const select = this.manager.dom.palettePresetSelect;
        if (!select) return;

        const currentPalette = this.getCurrentPalette().map(c => c.toUpperCase());

        const matchIndex = PALETTE_PRESETS.findIndex(preset => {
            const hexColors = this.buildPaletteFromPreset(preset);
            return hexColors.length === currentPalette.length &&
                hexColors.every((c, i) => c.toUpperCase() === currentPalette[i]);
        });

        select.value = matchIndex >= 0 ? String(matchIndex) : 'custom';
    }

    private onPresetChange(): void {
        const select = this.manager.dom.palettePresetSelect;
        if (!select) return;

        const value = select.value;
        if (value === 'custom') return;

        const index = parseInt(value, 10);
        const preset = PALETTE_PRESETS[index];

        this.manager.gameEngine.setCustomPalette(this.buildPaletteFromPreset(preset));
        this.renderPaletteGrid();

        this.manager.renderAll();
        this.manager.gameEngine.draw();

        this.manager.historyManager.pushCurrentState();
    }

    private buildPaletteFromPreset(preset: typeof PALETTE_PRESETS[number]): string[] {
        const palette = [...TileDefinitions.PICO8_COLORS];

        preset.colors.forEach((color) => {
            const idx = color.pico8Index;
            if (typeof idx !== 'number' || !Number.isFinite(idx)) return;
            if (idx < 0 || idx >= palette.length) return;
            palette[idx] = color.hex;
        });

        return palette;
    }

    private bindEvents(): void {
        // Toggle panel
        this.manager.dom.projectPaletteToggle?.addEventListener('click', () => {
            this.togglePanel();
        });

        // Preset select
        this.manager.dom.palettePresetSelect?.addEventListener('change', () => {
            this.onPresetChange();
        });

        // Reset button
        this.manager.dom.paletteResetButton?.addEventListener('click', () => {
            this.resetToDefault();
        });

        // Color picker confirm
        this.manager.dom.colorPickerConfirm?.addEventListener('click', () => {
            this.confirmColorChange();
        });

        // Color picker cancel
        this.manager.dom.colorPickerCancel?.addEventListener('click', () => {
            this.closeColorPicker();
        });

        // Close modal on backdrop click
        this.manager.dom.colorPickerModal?.addEventListener('click', (e) => {
            if (e.target === this.manager.dom.colorPickerModal) {
                this.closeColorPicker();
            }
        });

        // ESC to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.manager.dom.colorPickerModal?.hidden) {
                this.closeColorPicker();
            }
        });
    }
}
