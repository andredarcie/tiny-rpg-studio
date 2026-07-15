
import { TextResources } from '../../runtime/adapters/TextResources';
import { setEditorFontDisabled } from '../../config/FontConfig';
import { bitmapFont } from '../../runtime/adapters/renderer/BitmapFont';
import { EditorManagerModule } from './EditorManagerModule';
import type { NpcDefinitionData } from '../../runtime/domain/entities/Npc';
import {
    buildBackgroundMusicUrl,
    normalizeBackgroundMusicVolume,
    normalizeBackgroundMusicVideoId,
} from '../../runtime/infra/share/BackgroundMusicVideoId';
import { ShareUrlHelper } from '../../runtime/infra/share/ShareUrlHelper';
import { ONLINE_PLAYER_START_2_TYPE } from '../modules/EditorObjectService';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';
import {
    DEFAULT_SPRITE_OUTLINE_COLOR_INDEX,
    normalizeSpriteOutlineColor,
} from '../../runtime/domain/state/StateDataManager';

type SpriteInstance = {
    id: string;
    type: string;
    name?: string;
    text?: string;
    textKey?: string | null;
};

import type { OnlineConfig } from '../../types/gameState';

type ProjectGameSettings = {
    title?: string;
    author?: string;
    hideHud?: boolean;
    spriteOutline?: boolean;
    spriteOutlineColor?: number;
    disableSkills?: boolean;
    disablePixelFont?: boolean;
    backgroundMusicVideoId?: string;
    online?: OnlineConfig;
    start?: { x: number; y: number; roomIndex: number };
    backgroundMusicVolume?: number;
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

    setSpriteOutline(active: boolean = true) {
        this.gameEngine.setSpriteOutline(Boolean(active));
        if (this.dom.projectSpriteOutlineColor) {
            this.dom.projectSpriteOutlineColor.disabled = !active;
        }
        this.updateJSON();
        this.refreshOutlineViews();
    }

    setSpriteOutlineColor(colorIndex: number = DEFAULT_SPRITE_OUTLINE_COLOR_INDEX) {
        this.gameEngine.setSpriteOutlineColor(normalizeSpriteOutlineColor(colorIndex));
        this.syncSpriteOutlineColorSelect();
        this.updateJSON();
        this.refreshOutlineViews();
    }

    /** Redraw editor surfaces that use the shared outline (game canvas already redraws via GameEngine). */
    private refreshOutlineViews() {
        this.renderService.renderEditor();
        this.renderService.renderTileList();
        this.renderService.updateSelectedTilePreview();
        this.renderService.renderObjectCatalog();
        this.renderService.renderObjects();
    }

    /** Rebuild outline color options from the current 16-color palette. */
    refreshSpriteOutlineColorSelect() {
        const select = this.dom.projectSpriteOutlineColor;
        if (!select) return;

        const game = this.gameEngine.getGame() as ProjectGameSettings;
        const selected = normalizeSpriteOutlineColor(game.spriteOutlineColor);
        const customPalette = this.gameEngine.getCustomPalette();
        const colors = Array.isArray(customPalette) && customPalette.length >= 16
            ? customPalette
            : [...TileDefinitions.PICO8_COLORS];

        select.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const color = colors[i] ?? '#000000';
            const option = document.createElement('option');
            option.value = String(i);
            option.textContent = `${i}: ${String(color).toUpperCase()}`;
            option.style.backgroundColor = color;
            // Light text on dark swatches improves readability in native selects.
            option.style.color = '#ffffff';
            if (i === selected) option.selected = true;
            select.appendChild(option);
        }
        select.value = String(selected);
        select.style.backgroundColor = colors[selected] ?? '#000000';
        select.style.color = '#ffffff';
        select.disabled = game.spriteOutline === false;
    }

    private syncSpriteOutlineColorSelect() {
        const select = this.dom.projectSpriteOutlineColor;
        if (!select) return;
        const game = this.gameEngine.getGame() as ProjectGameSettings;
        const selected = normalizeSpriteOutlineColor(game.spriteOutlineColor);
        if (select.options.length !== 16) {
            this.refreshSpriteOutlineColorSelect();
            return;
        }
        select.value = String(selected);
        const option = select.selectedOptions.item(0);
        select.style.backgroundColor = option?.style.backgroundColor ?? select.style.backgroundColor;
        select.disabled = game.spriteOutline === false;
    }

    setDisableSkills(active: boolean = false) {
        this.gameEngine.setDisableSkills(Boolean(active));
        this.updateJSON();
    }

    setBackgroundMusicUrl(url: string) {
        const game = this.gameEngine.getGame() as ProjectGameSettings;
        game.backgroundMusicVideoId = normalizeBackgroundMusicVideoId(url);
        this.gameEngine.backgroundMusicEngine.syncFromGame(game);
        if (typeof document !== 'undefined' && document.body.classList.contains('editor-mode')) {
            this.gameEngine.backgroundMusicEngine.stop();
        }
        this.gameEngine.refreshIntroScreen();
        this.updateJSON();
    }

    setOnlineEnabled(enabled: boolean): void {
        const game = this.gameEngine.getGame();
        if (!game.online) game.online = { enabled: false };
        game.online.enabled = enabled;
        if (enabled) {
            this.ensureP2SpawnBesidePlayer1(game as ProjectGameSettings);
        }
        if (this.dom.projectOnlineControls) {
            this.dom.projectOnlineControls.style.display = enabled ? 'block' : 'none';
        }
        if (!enabled && this.dom.onlineServerUrlRow) {
            this.dom.onlineServerUrlRow.style.display = 'none';
        }
        if (!enabled && this.state.placingObjectType === ONLINE_PLAYER_START_2_TYPE) {
            this.manager.objectService.togglePlacement(ONLINE_PLAYER_START_2_TYPE, true);
        }
        this.manager.renderObjectCatalog();
        this.manager.renderService.renderEditor();
        this.syncP2SpawnLabel();
        this.updateJSON();
    }

    private ensureP2SpawnBesidePlayer1(game: ProjectGameSettings): void {
        if (!game.online?.enabled) return;
        const start = game.start ?? { x: 1, y: 1, roomIndex: 0 };
        const candidates = [
            { x: start.x + 1, y: start.y },
            { x: start.x - 1, y: start.y },
            { x: start.x, y: start.y + 1 },
            { x: start.x, y: start.y - 1 },
        ];
        const p2 = candidates.find((pos) => pos.x >= 0 && pos.x <= 7 && pos.y >= 0 && pos.y <= 7)
            ?? { x: Math.min(7, Math.max(0, start.x)), y: Math.min(7, Math.max(0, start.y)) };
        game.online.spawnPoints = [{ role: 'p2', roomIndex: start.roomIndex, x: p2.x, y: p2.y }];
    }

    setP2Spawn(): void {
        const game = this.gameEngine.getGame() as ProjectGameSettings & { start?: { x: number; y: number; roomIndex: number } };
        if (!game.online?.enabled) return;
        const start = game.start ?? { x: 1, y: 1, roomIndex: 0 };
        game.online.spawnPoints = [{ role: 'p2', roomIndex: start.roomIndex, x: start.x, y: start.y }];
        this.syncP2SpawnLabel();
        this.updateJSON();
    }

    private syncP2SpawnLabel(): void {
        const game = this.gameEngine.getGame() as ProjectGameSettings;
        const spawn = game.online?.spawnPoints?.[0];
        if (this.dom.onlineP2SpawnLabel) {
            this.dom.onlineP2SpawnLabel.textContent = spawn
                ? TextResources.format('project.online.spawnLabel', { room: spawn.roomIndex, x: spawn.x, y: spawn.y }, `sala ${spawn.roomIndex} (${spawn.x}, ${spawn.y})`)
                : TextResources.get('project.online.spawnUnset', 'não definido') as string;
        }
    }

    startOnlineServer(): void {
        const game = this.gameEngine.getGame();
        if (!game.online?.enabled) return;
        const guid = crypto.randomUUID();
        const gameData = this.gameEngine.exportGameData() as Record<string, unknown>;
        const shareUrl = new URL(ShareUrlHelper.buildShareUrl(gameData));
        shareUrl.searchParams.set('online-mode', guid);
        const finalUrl = shareUrl.toString();
        if (this.dom.onlineServerUrl) this.dom.onlineServerUrl.value = finalUrl;
        if (this.dom.onlineServerUrlRow) this.dom.onlineServerUrlRow.style.display = 'block';
        const clipboard = Reflect.get(navigator, 'clipboard') as Clipboard | undefined;
        if (clipboard) void clipboard.writeText(finalUrl).catch(() => undefined);
    }

    setBackgroundMusicVolume(value: number) {
        const game = this.gameEngine.getGame() as ProjectGameSettings;
        const volume = normalizeBackgroundMusicVolume(value);
        game.backgroundMusicVolume = volume;
        this.gameEngine.backgroundMusicEngine.syncFromGame(game);
        if (typeof document !== 'undefined' && document.body.classList.contains('editor-mode')) {
            this.gameEngine.backgroundMusicEngine.stop();
        }
        this.syncBackgroundMusicVolumeControls(volume);
        this.updateJSON();
    }

    setDisablePixelFont(active: boolean = false) {
        this.gameEngine.setDisablePixelFont(Boolean(active));
        bitmapFont.setDisabled(active);
        setEditorFontDisabled(active);
        this.updateJSON();
    }

    syncUI() {
        const game = this.gameEngine.getGame() as ProjectGameSettings;
        if (this.dom.titleInput) {
            this.dom.titleInput.value = game.title || '';
        }
        if (this.dom.authorInput) {
            this.dom.authorInput.value = game.author || '';
        }
        if (this.dom.projectHideHud) {
            this.dom.projectHideHud.checked = Boolean(game.hideHud);
        }
        if (this.dom.projectSpriteOutline) {
            this.dom.projectSpriteOutline.checked = game.spriteOutline !== false;
        }
        this.refreshSpriteOutlineColorSelect();
        if (this.dom.projectDisableSkills) {
            this.dom.projectDisableSkills.checked = Boolean(game.disableSkills);
        }
        if (this.dom.projectBackgroundMusicUrl) {
            this.dom.projectBackgroundMusicUrl.value = buildBackgroundMusicUrl(game.backgroundMusicVideoId);
        }
        this.syncBackgroundMusicVolumeControls(normalizeBackgroundMusicVolume(game.backgroundMusicVolume));
        if (this.dom.projectDisablePixelFont) {
            this.dom.projectDisablePixelFont.checked = Boolean(game.disablePixelFont);
        }
        bitmapFont.setDisabled(Boolean(game.disablePixelFont));
        setEditorFontDisabled(Boolean(game.disablePixelFont));
        if (this.dom.projectOnlineEnabled) {
            this.dom.projectOnlineEnabled.checked = Boolean(game.online?.enabled);
        }
        if (this.dom.projectOnlineControls) {
            this.dom.projectOnlineControls.style.display = game.online?.enabled ? 'block' : 'none';
        }
        this.syncP2SpawnLabel();
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

    private syncBackgroundMusicVolumeControls(volume: number): void {
        const text = `${volume}%`;
        if (this.dom.projectBackgroundMusicVolume) {
            this.dom.projectBackgroundMusicVolume.value = String(volume);
        }
        if (this.dom.projectBackgroundMusicVolumeValue) {
            this.dom.projectBackgroundMusicVolumeValue.textContent = text;
        }
    }
}

export { EditorUIController };
