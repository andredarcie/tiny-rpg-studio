import type { EditorManager } from '../EditorManager';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';

export class EditorPaletteService {
    manager: EditorManager;

    constructor(manager: EditorManager) {
        this.manager = manager;
    }

    initialize(): void {
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

        if (!modal || !input || !currentSwatch || !newSwatch || !indexLabel) return;

        this.manager.state.editingColorIndex = colorIndex;

        const currentColor = this.getCurrentPalette()[colorIndex];

        // Setup UI
        input.value = currentColor;
        currentSwatch.style.backgroundColor = currentColor;
        newSwatch.style.backgroundColor = currentColor;
        indexLabel.textContent = `#${colorIndex}`;

        // Show modal
        modal.hidden = false;

        // Update preview on input change
        const updatePreview = () => {
            newSwatch.style.backgroundColor = input.value;
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

        const newColor = input.value.toUpperCase();
        this.setColorAtIndex(colorIndex, newColor);
        this.closeColorPicker();
        this.renderPaletteGrid();

        // Força re-render completo do editor e do jogo
        this.manager.renderAll();
        this.manager.gameEngine.draw();

        // Salva no histórico
        this.manager.historyManager.pushCurrentState();
    }

    private setColorAtIndex(index: number, color: string): void {
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
        const textResources =
            ((globalThis as typeof globalThis & { TextResources?: { get?: (key: string, fallback: string) => string } }).TextResources);

        const actionText = isCollapsed
            ? (textResources?.get ? textResources.get('project.paletteExpand', 'Mostrar paleta de cores') : 'Mostrar paleta de cores')
            : (textResources?.get ? textResources.get('project.paletteCollapse', 'Esconder paleta de cores') : 'Esconder paleta de cores');

        toggle.textContent = `🎨 ${actionText}`;
    }

    private bindEvents(): void {
        // Toggle panel
        this.manager.dom.projectPaletteToggle?.addEventListener('click', () => {
            this.togglePanel();
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
