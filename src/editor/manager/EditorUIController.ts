
import { TextResources } from '../../runtime/adapters/TextResources';
import { setEditorFontDisabled } from '../../config/FontConfig';
import { bitmapFont } from '../../runtime/adapters/renderer/BitmapFont';
import { EditorManagerModule } from './EditorManagerModule';
import type { NpcDefinitionData } from '../../runtime/domain/entities/Npc';

type SpriteInstance = {
    id: string;
    type: string;
    name?: string;
    text?: string;
    textKey?: string | null;
};

class EditorUIController extends EditorManagerModule {
    updateGameMetadata() {
        const game = this.gameEngine.getGame();
        const title = this.normalizeTitle(this.dom.titleInput?.value || '');
        const author = this.normalizeAuthor(this.dom.authorInput?.value || '');
        game.title = title;
        game.author = author;
        this.gameEngine.syncDocumentTitle();
        this.gameEngine.refreshIntroScreen();
        this.updateJSON();
    }

    updateJSON() {
        if (this.dom.jsonArea) {
            this.dom.jsonArea.value = JSON.stringify(this.gameEngine.exportGameData(), null, 2);
        }
        this.renderService.renderVariableUsage();
        this.renderService.renderSkillList();
        this.renderService.renderTestTools();
    }

    toggleVariablePanel() {
        this.state.variablePanelCollapsed = !this.state.variablePanelCollapsed;
        this.renderService.renderVariableUsage();
    }

    toggleSkillPanel() {
        this.state.skillPanelCollapsed = !this.state.skillPanelCollapsed;
        this.renderService.renderSkillList();
    }

    toggleTestPanel() {
        this.state.testPanelCollapsed = !this.state.testPanelCollapsed;
        this.renderService.renderTestTools();
    }

    setTestStartLevel(level: number) {
        const maxLevel = this.gameEngine.getMaxPlayerLevel();
        const numeric = Number.isFinite(level) ? Math.max(1, Math.min(maxLevel, Math.floor(level))) : 1;
        this.gameEngine.updateTestSettings({ startLevel: numeric });
        this.renderService.renderTestTools();
    }

    setTestSkills(skills: string[]) {
        const normalized = Array.isArray(skills)
            ? Array.from(new Set(skills.filter((id) => typeof id === 'string' && id)))
            : [];
        this.gameEngine.updateTestSettings({ skills: normalized });
        this.renderService.renderTestTools();
    }

    setGodMode(active: boolean = false) {
        this.gameEngine.updateTestSettings({ godMode: Boolean(active) });
        this.renderService.renderTestTools();
    }

    setSkillOrder(order: string[]) {
        const normalized = Array.isArray(order) ? order.filter((id) => typeof id === 'string' && !!id) : [];
        this.gameEngine.setSkillOrder(normalized.length ? normalized : undefined);
        this.updateJSON();
    }

    setHideHud(active: boolean = false) {
        this.gameEngine.setHideHud(Boolean(active));
        this.updateJSON();
    }

    setDisableSkills(active: boolean = false) {
        this.gameEngine.setDisableSkills(Boolean(active));
        this.updateJSON();
    }

    setDisablePixelFont(active: boolean = false) {
        this.gameEngine.setDisablePixelFont(Boolean(active));
        bitmapFont.setDisabled(active);
        setEditorFontDisabled(active);
        this.updateJSON();
    }

    syncUI() {
        const game = this.gameEngine.getGame();
        if (this.dom.titleInput) {
            this.dom.titleInput.value = game.title || '';
        }
        if (this.dom.authorInput) {
            this.dom.authorInput.value = game.author || '';
        }
        if (this.dom.projectHideHud) {
            this.dom.projectHideHud.checked = Boolean(game.hideHud);
        }
        if (this.dom.projectDisableSkills) {
            this.dom.projectDisableSkills.checked = Boolean(game.disableSkills);
        }
        if (this.dom.projectDisablePixelFont) {
            this.dom.projectDisablePixelFont.checked = Boolean(game.disablePixelFont);
        }
        bitmapFont.setDisabled(Boolean(game.disablePixelFont));
        setEditorFontDisabled(Boolean(game.disablePixelFont));
        this.updateProjectTabs();
        this.updateJSON();
    }

    setActiveProjectTab(tab: string) {
        if (!tab) return;
        if (this.state.activeProjectTab === tab) {
            this.updateProjectTabs();
            return;
        }
        this.state.activeProjectTab = tab;
        this.updateProjectTabs();
    }

    updateProjectTabs() {
        const current = this.state.activeProjectTab || 'development';
        const buttons = Array.isArray(this.dom.projectTabButtons) ? this.dom.projectTabButtons : [];
        buttons.forEach((button) => {
            const match = button.dataset.projectTabButton === current;
            button.classList.toggle('active', match);
            button.setAttribute('aria-selected', match ? 'true' : 'false');
        });
        const panels = Array.isArray(this.dom.projectTabPanels) ? this.dom.projectTabPanels : [];
        panels.forEach((panel) => {
            const match = panel.dataset.projectTabPanel === current;
            panel.classList.toggle('active', match);
            panel.hidden = !match;
        });
    }

    setActiveMobilePanel(panel: string) {
        if (!panel) return;
        if (this.state.activeMobilePanel === panel) {
            this.updateMobilePanels();
            return;
        }
        this.state.activeMobilePanel = panel;
        this.updateMobilePanels();
    }

    updateMobilePanels() {
        const current = this.state.activeMobilePanel || 'tiles';
        const buttons = Array.isArray(this.dom.mobileNavButtons) ? this.dom.mobileNavButtons : [];
        buttons.forEach((button) => {
            const match = button.dataset.mobileTarget === current;
            button.classList.toggle('active', match);
        });
        const panels = Array.isArray(this.dom.mobilePanels) ? this.dom.mobilePanels : [];
        const isMobile = typeof globalThis.matchMedia === 'function'
            ? globalThis.matchMedia('(max-width: 920px)').matches
            : false;
        panels.forEach((section) => {
            if (!isMobile) {
                section.classList.remove('is-mobile-active');
                return;
            }
            const match = section.dataset.mobilePanel === current;
            section.classList.toggle('is-mobile-active', match);
        });
    }

    handleLanguageChange() {
        void (TextResources.apply() as unknown);
        this.gameEngine.gameState.variableManager.refreshPresetNames();
        this.refreshNpcLocalizedText();
        this.manager.renderAll();
        this.updateJSON();
    }

    refreshNpcLocalizedText() {
        const sprites = this.gameEngine.getSprites() as SpriteInstance[];
        if (!Array.isArray(sprites)) return;
        const definitions = this.gameEngine.npcManager.getDefinitions() as NpcDefinitionData[];
        const byType = new Map(definitions.map((def: NpcDefinitionData) => [def.type, def]));
        sprites.forEach((npc: SpriteInstance) => {
            const def = npc.type ? byType.get(npc.type) : null;
            if (def && def.nameKey) {
                npc.name = (TextResources.get(def.nameKey, def.name || npc.name || '') as string) || npc.name || '';
            }
            if (npc.textKey) {
                npc.text = (TextResources.get(npc.textKey, npc.text || '') as string) || npc.text || '';
            }
        });
    }

    normalizeTitle(raw: string | null) {
        const text = String(raw || '').slice(0, 18).replace(/\s+/g, ' ').trim();
        return text || 'Tiny RPG Studio';
    }

    normalizeAuthor(raw: string | null) {
        const text = String(raw || '').slice(0, 18).replace(/\s+/g, ' ').trim();
        return text;
    }
}

export { EditorUIController };
