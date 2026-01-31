
import { TextResources } from '../../runtime/adapters/TextResources';
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

    syncUI() {
        const game = this.gameEngine.getGame();
        if (this.dom.titleInput) {
            this.dom.titleInput.value = game.title || '';
        }
        if (this.dom.authorInput) {
            this.dom.authorInput.value = game.author || '';
        }
        this.updateJSON();
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
