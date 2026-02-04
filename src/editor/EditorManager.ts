
import { EnemyDefinitions } from '../runtime/domain/definitions/EnemyDefinitions';
import type { GameEngine } from '../runtime/services/GameEngine';
import type { TileDefinition } from '../runtime/domain/definitions/tileTypes';
import { EditorConstants } from './modules/EditorConstants';
import { EditorDomCache } from './modules/EditorDomCache';
import { EditorEnemyService } from './modules/EditorEnemyService';
import { EditorHistoryManager } from './modules/EditorHistoryManager';
import { EditorNpcService } from './modules/EditorNpcService';
import { EditorObjectService } from './modules/EditorObjectService';
import { EditorPaletteService } from './modules/EditorPaletteService';
import { EditorRenderService } from './modules/EditorRenderService';
import { EditorShareService } from './modules/EditorShareService';
import { EditorState } from './modules/EditorState';
import { EditorTileService } from './modules/EditorTileService';
import { EditorVariableService } from './modules/EditorVariableService';
import { EditorWorldService } from './modules/EditorWorldService';
import { EditorEventBinder } from './manager/EditorEventBinder';
import { EditorInteractionController } from './manager/EditorInteractionController';
import { EditorUIController } from './manager/EditorUIController';

class EditorManager {
    gameEngine: GameEngine;
    state: EditorState;
    domCache: EditorDomCache;
    editorCanvas: HTMLCanvasElement | null;
    ectx: CanvasRenderingContext2D | null;
    history: EditorHistoryManager;
    renderService: EditorRenderService;
    tileService: EditorTileService;
    shareService: EditorShareService;
    npcService: EditorNpcService;
    enemyService: EditorEnemyService;
    objectService: EditorObjectService;
    variableService: EditorVariableService;
    paletteService: EditorPaletteService;
    worldService: EditorWorldService;
    uiController: EditorUIController;
    eventBinder: EditorEventBinder;
    interactionController: EditorInteractionController;

    constructor(gameEngine: GameEngine) {
        this.gameEngine = gameEngine;
        this.state = new EditorState();
        this.domCache = new EditorDomCache(typeof document !== 'undefined' ? document : null);

        this.editorCanvas = this.domCache.editorCanvas || null;
        this.ectx = this.editorCanvas?.getContext('2d') ?? null;
        if (this.ectx) {
            this.ectx.imageSmoothingEnabled = false;
        }

        this.history = new EditorHistoryManager(this);
        this.renderService = new EditorRenderService(this);
        this.tileService = new EditorTileService(this);
        this.shareService = new EditorShareService(this);
        this.npcService = new EditorNpcService(this);
        this.enemyService = new EditorEnemyService(this);
        this.objectService = new EditorObjectService(this);
        this.variableService = new EditorVariableService(this);
        this.paletteService = new EditorPaletteService(this);
        this.worldService = new EditorWorldService(this);
        this.uiController = new EditorUIController(this);
        this.eventBinder = new EditorEventBinder(this);
        this.interactionController = new EditorInteractionController(this);

        this.bindEvents();
        this.initialize();
        if (typeof document !== 'undefined') {
            document.addEventListener('language-changed', () => this.handleLanguageChange());
        }
    }

    // State accessors to keep compatibility with legacy references
    get dom() {
        return this.domCache;
    }

    get historyManager() {
        return this.history;
    }

    get selectedTileId() {
        return this.state.selectedTileId;
    }
    set selectedTileId(value: string | number | null) {
        this.state.selectedTileId = value;
    }

    get selectedNpcId() {
        return this.state.selectedNpcId;
    }
    set selectedNpcId(value: string | null) {
        this.state.selectedNpcId = value;
    }

    get selectedNpcType() {
        return this.state.selectedNpcType;
    }
    set selectedNpcType(value: string | null) {
        this.state.selectedNpcType = value;
    }

    get activeRoomIndex() {
        return this.state.activeRoomIndex;
    }
    set activeRoomIndex(value: number) {
        this.state.activeRoomIndex = value;
    }

    get placingNpc() {
        return this.state.placingNpc;
    }
    set placingNpc(value: boolean) {
        this.state.placingNpc = value;
    }

    get placingEnemy() {
        return this.state.placingEnemy;
    }
    set placingEnemy(value: boolean) {
        this.state.placingEnemy = value;
    }

    get placingObjectType() {
        return this.state.placingObjectType;
    }
    set placingObjectType(value: string | null) {
        this.state.placingObjectType = value;
    }

    get selectedObjectType() {
        return this.state.selectedObjectType;
    }
    set selectedObjectType(value: string | null) {
        this.state.selectedObjectType = value;
    }

    get selectedEnemyType() {
        return this.state.selectedEnemyType;
    }
    set selectedEnemyType(value: string | null) {
        this.state.selectedEnemyType = value;
    }

    get mapPainting() {
        return this.state.mapPainting;
    }
    set mapPainting(value: boolean) {
        this.state.mapPainting = value;
    }

    bindEvents() {
        this.eventBinder.bind();
    }

    initialize() {
        this.gameEngine.tileManager.ensureDefaultTiles();
        const tiles = this.gameEngine.getTiles() as TileDefinition[];
        if (tiles.length > 0) {
            this.selectedTileId = tiles[0].id ?? null;
        }

        this.syncUI();
        const game = this.gameEngine.getGame() as { start?: { roomIndex?: number }; rooms?: unknown[] };
        const startRoomIndex = game.start?.roomIndex ?? 0;
        const totalRooms = game.rooms?.length || 1;
        this.activeRoomIndex = Math.max(0, Math.min(totalRooms - 1, startRoomIndex));
        this.gameEngine.npcManager.ensureDefaultNPCs();
        this.paletteService.initialize();

        this.renderAll();
        this.updateMobilePanels();
        this.handleCanvasResize(true);
        this.history.pushCurrentState();
    }

    desselectAllAndRender() {
        const tileCleared = Boolean(this.tileService.clearSelection({ render: false }));
        const npcCleared = Boolean(this.npcService.clearSelection({ render: false }));
        const enemyCleared = Boolean(this.enemyService.clearSelection({ render: false }));
        const objectCleared = Boolean(this.objectService.clearSelection({ render: false }));

        if (tileCleared) {
            this.renderService.renderTileList();
            this.renderService.updateSelectedTilePreview();
        }
        if (npcCleared) {
            this.renderService.renderNpcs();
        }
        if (enemyCleared) {
            this.renderService.renderEnemyCatalog();
        }
        if (objectCleared) {
            this.renderService.renderObjectCatalog();
        }

        return tileCleared || npcCleared || enemyCleared || objectCleared;
    }

    renderAll() {
        this.renderService.renderTileList();
        this.renderService.renderWorldGrid();
        this.renderService.renderNpcs();
        this.renderService.renderEnemyCatalog();
        this.renderService.renderEnemies();
        this.renderService.renderObjectCatalog();
        this.renderService.renderObjects();
        this.renderService.renderEditor();
        this.renderService.updateSelectedTilePreview();
    }

    // Delegated rendering APIs for backward compatibility
    renderEditor() {
        this.renderService.renderEditor();
    }

    renderTileList() {
        this.renderService.renderTileList();
    }

    updateSelectedTilePreview() {
        this.renderService.updateSelectedTilePreview();
    }

    renderNpcs() {
        this.renderService.renderNpcs();
    }

    renderEnemies() {
        this.renderService.renderEnemies();
    }

    renderEnemyCatalog() {
        this.renderService.renderEnemyCatalog();
    }

    renderObjectCatalog() {
        this.renderService.renderObjectCatalog();
    }

    renderObjects() {
        this.renderService.renderObjects();
    }

    renderWorldGrid() {
        this.renderService.renderWorldGrid();
    }

    toggleVariablePanel() {
        this.uiController.toggleVariablePanel();
    }

    toggleSkillPanel() {
        this.uiController.toggleSkillPanel();
    }

    toggleTestPanel() {
        this.uiController.toggleTestPanel();
    }

    setTestStartLevel(level: number) {
        this.uiController.setTestStartLevel(level);
    }

    setTestSkills(skills: string[]) {
        this.uiController.setTestSkills(skills);
    }

    setGodMode(active: boolean) {
        this.uiController.setGodMode(active);
    }

    setActiveMobilePanel(panel: string) {
        this.uiController.setActiveMobilePanel(panel);
    }

    updateMobilePanels() {
        this.uiController.updateMobilePanels();
    }

    // Tile painting delegation
    startMapPaint(ev: PointerEvent) {
        this.tileService.startPaint(ev);
    }

    continueMapPaint(ev: PointerEvent) {
        this.tileService.continuePaint(ev);
    }

    finishMapPaint(ev: PointerEvent) {
        this.tileService.finishPaint(ev);
    }

    // NPC delegation
    addNPC() {
        this.npcService.addNpc();
    }

    removeSelectedNpc() {
        this.npcService.removeSelectedNpc();
    }

    updateNpcSelection() {
        this.npcService.updateNpcSelection(this.selectedNpcType, this.selectedNpcId);
    }

    updateNpcText() {
        if (!this.dom.npcText) return;
        this.npcService.updateNpcText(this.dom.npcText.value);
    }

    updateNpcConditionalText() {
        if (!this.dom.npcConditionalText) return;
        this.npcService.updateNpcConditionalText(this.dom.npcConditionalText.value);
    }

    handleNpcConditionVariableChange() {
        const select = this.dom.npcConditionalVariable;
        if (!select) return;
        this.npcService.handleConditionVariableChange(select.value);
    }

    handleNpcRewardVariableChange() {
        const select = this.dom.npcRewardVariable;
        if (!select) return;
        this.npcService.handleRewardVariableChange(select.value);
    }

    handleNpcConditionalRewardVariableChange() {
        const select = this.dom.npcConditionalRewardVariable;
        if (!select) return;
        this.npcService.handleConditionalRewardVariableChange(select.value);
    }

    removeEnemy(enemyId: string) {
        this.enemyService.removeEnemy(enemyId);
    }

    removeObject(type: string, roomIndex: number) {
        this.objectService.removeObject(type, roomIndex);
    }

    toggleVariableDefault(variableId: string, nextValue: boolean | null = null) {
        this.variableService.toggle(variableId, nextValue);
    }

    // World delegation
    setActiveRoom(index: number) {
        this.worldService.setActiveRoom(index);
    }

    // Sharing & persistence
    generateShareableUrl() {
        return this.shareService.generateShareableUrl();
    }

    saveGame() {
        this.shareService.saveGame();
    }

    loadGameFile(ev: Event) {
        this.shareService.loadGameFile(ev);
    }

    // History
    pushHistory() {
        this.history.pushCurrentState();
    }

    undo() {
        this.history.undo();
    }

    redo() {
        this.history.redo();
    }

    // Game title & JSON sync
    updateGameMetadata() {
        this.uiController.updateGameMetadata();
    }

    updateJSON() {
        this.uiController.updateJSON();
    }

    syncUI() {
        this.uiController.syncUI();
    }

    // Restore & import logic
    restore(data: Record<string, unknown>, options: { skipHistory?: boolean } = {}) {
        const { skipHistory = false } = options;
        this.gameEngine.importGameData(data);
        this.gameEngine.tileManager.ensureDefaultTiles();

        // Apply custom palette if present
        const customPalette = (data as { customPalette?: string[] }).customPalette;
        if (customPalette) {
            this.gameEngine.setCustomPalette(customPalette);
        } else {
            this.gameEngine.resetPaletteToDefault();
        }

        // Re-render palette grid
        this.paletteService.renderPaletteGrid();

        const tiles = this.gameEngine.getTiles() as TileDefinition[];
        if (tiles.length && !tiles.find((t: TileDefinition) => t.id === this.selectedTileId)) {
            this.selectedTileId = tiles[0].id ?? null;
        }

        const npcs = this.gameEngine.getSprites() as { id: string; type: string }[];
        if (!npcs.find((npc: { id: string }) => npc.id === this.selectedNpcId)) {
            this.selectedNpcId = null;
            this.selectedNpcType = null;
            this.placingNpc = false;
        }

        const definitions = EditorConstants.ENEMY_DEFINITIONS;
        const normalizedType = EnemyDefinitions.normalizeType(this.selectedEnemyType);
        if (normalizedType !== this.selectedEnemyType) {
            this.selectedEnemyType = normalizedType;
        } else if (!definitions.some((entry: { type: string }) => entry.type === this.selectedEnemyType)) {
            this.selectedEnemyType = definitions[0]?.type || 'giant-rat';
        }

        this.renderAll();
        this.gameEngine.draw();
        this.syncUI();
        if (!skipHistory) {
            this.history.pushCurrentState();
        }
    }

    // Canvas & keyboard handling
    handleCanvasResize(force: boolean = false) {
        this.interactionController.handleCanvasResize(force);
    }

    handleLanguageChange() {
        this.uiController.handleLanguageChange();
        this.paletteService.syncPaletteState();
    }

    refreshNpcLocalizedText() {
        this.uiController.refreshNpcLocalizedText();
    }

    handleKey(ev: KeyboardEvent) {
        this.interactionController.handleKey(ev);
    }

    createNewGame() {
        const emptyLayer = () => Array.from({ length: 8 }, () => Array(8).fill(null) as null[]);
        const data = {
            title: 'Novo Jogo',
            palette: ['#0e0f13', '#2e3140', '#f4f4f8'],
            roomSize: 8,
            rooms: [
                {
                    size: 8,
                    bg: 0,
                    tiles: Array.from({ length: 8 }, () => Array(8).fill(0) as number[]),
                    walls: Array.from({ length: 8 }, () => Array(8).fill(false) as boolean[])
                }
            ],
            start: { x: 1, y: 1, roomIndex: 0 },
            sprites: [],
            items: [],
            exits: [],
            objects: [],
            enemies: [],
            variables: [],
            tileset: {
                tiles: [],
                map: {
                    ground: emptyLayer(),
                    overlay: emptyLayer()
                }
            }
        };
        this.restore(data);
    }
}

export { EditorManager };
