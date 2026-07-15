
import { SkillDefinitions } from './definitions/SkillDefinitions';
import { ItemDefinitions } from './definitions/ItemDefinitions';
import type { ItemType } from './constants/itemTypes';
import { GameStateLifecycle } from './state/GameStateLifecycle';
import { GameStateScreenManager } from './state/GameStateScreenManager';
import { GameStateDataFacade } from './state/GameStateDataFacade';
import { GameStateWorldFacade } from './state/GameStateWorldFacade';
import { StateDataManager } from './state/StateDataManager';
import { StateDialogManager } from './state/StateDialogManager';
import { StateEnemyManager } from './state/StateEnemyManager';
import { StateItemManager } from './state/StateItemManager';
import { StateObjectManager } from './state/StateObjectManager';
import { StatePlayerManager } from './state/StatePlayerManager';
import { StateSkillManager } from './state/StateSkillManager';
import { StateVariableManager } from './state/StateVariableManager';
import { StateWorldManager } from './state/StateWorldManager';
import { GameConfig } from '../../config/GameConfig';
import { DEFAULT_BACKGROUND_MUSIC_VOLUME } from '../infra/share/BackgroundMusicVideoId';
import type { TileMap, Tileset } from './definitions/tileTypes';
import type {
    DialogChoicePhase,
    DialogChoiceState,
    DialogMeta,
    DialogState,
    EnemyDefinition,
    GameDefinition,
    LevelUpChoice,
    LevelUpCelebrationHideOptions,
    LevelUpCelebrationOptions,
    LevelUpCelebrationState,
    LevelUpOverlayState,
    LevelUpResult,
    PickupOverlayOptions,
    PickupOverlayState,
    PlayerRuntimeState,
    ReviveSnapshot,
    RoomDefinition,
    RuntimeState,
    TestSettings
} from '../../types/gameState';
/**
 * GameState stores the persistent game definition and runtime state.
 */
class GameState {
    game: GameDefinition;
    state: RuntimeState;
    testSettings: TestSettings;
    worldManager: StateWorldManager;
    variableManager: StateVariableManager;
    objectManager: StateObjectManager;
    enemyManager: StateEnemyManager;
    skillManager: StateSkillManager;
    playerManager: StatePlayerManager;
    dialogManager: StateDialogManager;
    itemManager: StateItemManager;
    worldFacade: GameStateWorldFacade;
    screenManager: GameStateScreenManager;
    dataManager: StateDataManager;
    dataFacade: GameStateDataFacade;
    playing: boolean;
    lifecycle: GameStateLifecycle;
    reviveSnapshot: ReviveSnapshot | null;
    lastKillerEnemyId: string | null;
    onVariableChanged: ((variableId: string, value: unknown) => void) | null = null;
    editorMode: boolean;
    levelUpOverlayPresentationSync: (() => void) | null;

    constructor() {
        const worldRows = GameConfig.world.rows;
        const worldCols = GameConfig.world.cols;
        const roomSize = GameConfig.world.roomSize;
        const totalRooms = worldRows * worldCols;

        const tileMaps: TileMap[] = Array.from({ length: totalRooms }, () =>
            StateWorldManager.createEmptyTileMap(roomSize) as TileMap
        );
        const tileset: Tileset = {
            tiles: [],
            maps: tileMaps,
            map: tileMaps[0] || StateWorldManager.createEmptyTileMap(roomSize)
        };

        this.game = {
            title: "My Tiny RPG Game",
            author: "",
            palette: ['#000000', '#1D2B53', '#FFF1E8'],
            backgroundMusicVolume: DEFAULT_BACKGROUND_MUSIC_VOLUME,
            hideHud: false,
            spriteOutline: true,
            spriteOutlineColor: 1,
            disableSkills: false,
            roomSize,
            world: {
                rows: worldRows,
                cols: worldCols
            },
            rooms: StateWorldManager.createWorldRooms(worldRows, worldCols, roomSize),
            start: {
                x: GameConfig.player.startX,
                y: GameConfig.player.startY,
                roomIndex: GameConfig.player.startRoomIndex
            },
            sprites: [],
            enemies: [],
            items: [],
            objects: [],
            variables: [],
            exits: [],
            tileset
        } as GameDefinition;

        this.state = {
            player: {
                x: GameConfig.player.startX,
                y: GameConfig.player.startY,
                lastX: GameConfig.player.startX,
                roomIndex: GameConfig.player.startRoomIndex,
                level: GameConfig.player.startLevel,
                maxLives: GameConfig.player.baseMaxLives,
                currentLives: GameConfig.player.startLives,
                lives: GameConfig.player.startLives,
                keys: 0,
                experience: 0,
                damageShield: 0,
                damageShieldMax: 0,
                swordType: null,
                swordDurability: 0,
                lastDamageReduction: 0,
                godMode: false,
                lastAttackTime: 0,
                stunUntil: 0
            },
            dialog: { active: false, text: "", page: 1, maxPages: 1, meta: null, choice: null },
            npcDialogReadState: {},
            npcChoiceAnswered: {},
            enemies: [],
            variables: [],
            gameOver: false,
            gameOverReason: null,
            pickupOverlay: {
                active: false,
                name: '',
                spriteGroup: null,
                spriteType: null,
                effect: null
            },
            levelUpOverlay: {
                active: false,
                choices: [],
                cursor: 0
            },
            levelUpCelebration: {
                active: false,
                level: null,
                startTime: 0,
                timeoutId: null,
                durationMs: GameConfig.timing.levelUpCelebration
            },
            skillRuntime: null
        } as RuntimeState;
        this.testSettings = this.createDefaultTestSettings();
        this.lastKillerEnemyId = null;

        this.worldManager = new StateWorldManager(this.game, roomSize);
        this.variableManager = new StateVariableManager(this.game, this.state);
        this.objectManager = new StateObjectManager(this.game, this.worldManager, this.variableManager);
        this.enemyManager = new StateEnemyManager(this.game, this.state, this.worldManager);
        this.skillManager = new StateSkillManager(this.state);
        this.playerManager = new StatePlayerManager(this.state, this.worldManager, this.skillManager);
        this.playerManager.setSkillManager(this.skillManager);
        this.dialogManager = new StateDialogManager(this.state);
        this.itemManager = new StateItemManager(this.game);
        this.worldFacade = new GameStateWorldFacade(this, this.worldManager);
        this.screenManager = new GameStateScreenManager(this);
        this.dataManager = new StateDataManager({
            game: this.game,
            worldManager: this.worldManager,
            objectManager: this.objectManager,
            variableManager: this.variableManager
        });
        this.dataFacade = new GameStateDataFacade(this, this.dataManager);
        this.playing = false;
        this.lifecycle = new GameStateLifecycle(this, this.screenManager, {
            timeToResetAfterGameOver: GameConfig.timing.resetAfterGameOver
        });
        this.levelUpOverlayPresentationSync = null;
        this.ensureDefaultVariables();
        this.resetGame();
        this.reviveSnapshot = null;

        this.editorMode = false;
        document.addEventListener('game-tab-activated', () => {
            this.setEditorMode(false);
        });
        document.addEventListener('editor-tab-activated', () => {
            this.setEditorMode(true);
        });
    }

    setLevelUpOverlayPresentationSync(callback: (() => void) | null): void {
        this.levelUpOverlayPresentationSync = typeof callback === 'function' ? callback : null;
    }

    private syncLevelUpOverlayPresentation(): void {
        this.levelUpOverlayPresentationSync?.();
    }

    createEmptyRoom(size: number, index = 0, cols = 1): RoomDefinition {
        return this.worldFacade.createEmptyRoom(size, index, cols);
    }

    createWorldRooms(rows: number, cols: number, size: number): RoomDefinition[] {
        return this.worldFacade.createWorldRooms(rows, cols, size);
    }

    createEmptyTileMap(size: number): TileMap {
        return this.worldFacade.createEmptyTileMap(size);
    }

    getGame(): GameDefinition {
        return this.game;
    }

    getState(): RuntimeState {
        return this.state;
    }

    getCurrentRoom(): RoomDefinition {
        const index = this.worldManager.clampRoomIndex(this.state.player.roomIndex);
        this.state.player.roomIndex = index;
        return this.game.rooms[index];
    }

    getPlayer(): PlayerRuntimeState | null {
        return this.playerManager.getPlayer() as PlayerRuntimeState | null;
    }

    getSkills(): string[] {
        if (this.areSkillsDisabled()) {
            return [];
        }
        return this.skillManager.getOwnedSkills();
    }

    hasSkill(skillId: string): boolean {
        if (this.areSkillsDisabled()) {
            return false;
        }
        return this.skillManager.hasSkill(skillId);
    }

    getPendingLevelUpChoices(): number {
        if (this.areSkillsDisabled()) {
            return 0;
        }
        return this.skillManager.getPendingSelections();
    }

    getMaxPlayerLevel(): number {
        return this.playerManager.maxLevel;
    }

    isLevelUpOverlayActive(): boolean {
        if (this.areSkillsDisabled()) {
            return false;
        }
        return this.skillManager.isOverlayActive();
    }

    getLevelUpOverlay(): LevelUpOverlayState {
        if (this.areSkillsDisabled()) {
            return {
                active: false,
                choices: [],
                cursor: 0
            };
        }
        return this.skillManager.getOverlay();
    }

    startLevelUpSelectionIfNeeded(): void {
        if (this.areSkillsDisabled()) {
            return;
        }
        if (this.isLevelUpCelebrationActive()) {
            return;
        }
        if (this.skillManager.hasPendingSelections() && !this.skillManager.isOverlayActive()) {
            const started = this.skillManager.startLevelSelection();
            if (started) {
                this.syncLevelUpOverlayPresentation();
                this.pauseGame('level-up');
            }
        }
    }

    queueLevelUpChoices(count = 1, latestLevel: number | null = null): number {
        if (this.areSkillsDisabled()) {
            return 0;
        }
        this.skillManager.queueLevelUps(count, latestLevel);
        this.startLevelUpSelectionIfNeeded();
        return this.skillManager.getPendingSelections();
    }

    moveLevelUpCursor(delta = 0): number {
        if (this.areSkillsDisabled()) {
            return 0;
        }
        const cursor = this.skillManager.moveCursor(delta);
        return cursor;
    }

    selectLevelUpSkill(index: number | null = null): LevelUpChoice | null {
        if (this.areSkillsDisabled()) {
            return null;
        }
        if (!this.skillManager.isOverlayActive()) {
            return null;
        }
        const choice = this.skillManager.completeSelection(index);
        if (choice?.id === 'max-life') {
            this.playerManager.healToFull();
        }
        if (choice?.id === 'xp-boost') {
            // XP boost applies passively; no extra action needed.
        }
        if (this.skillManager.hasPendingSelections()) {
            const started = this.skillManager.startLevelSelection();
            if (started) {
                this.syncLevelUpOverlayPresentation();
                this.pauseGame('level-up');
            }
        } else {
            this.resumeGame('level-up');
        }
        return choice;
    }

    consumeRecentReviveFlag(): boolean {
        return this.skillManager.consumeRecentReviveFlag();
    }

    getDialog(): DialogState {
        return this.dialogManager.getDialog();
    }

    setPlayerPosition(x: number, y: number, roomIndex: number | null = null) {
        this.playerManager.setPosition(x, y, roomIndex);
    }

    setDialog(active: boolean, text: string = "", meta: DialogMeta | null = null): void {
        this.dialogManager.setDialog(active, text, meta);
    }

    setDialogPage(page: number): void {
        this.dialogManager.setPage(page);
    }

    setDialogChoice(choice: DialogChoiceState | null): void {
        this.dialogManager.setDialogChoice(choice);
    }

    setChoicePhase(phase: DialogChoicePhase): void {
        this.dialogManager.setChoicePhase(phase);
    }

    setChoiceSelection(index: number): void {
        this.dialogManager.setChoiceSelection(index);
    }

    markNpcDialogAsRead(npcId: string, variantKey: string | null): void {
        this.dialogManager.markNpcDialogAsRead(npcId, variantKey);
    }

    hasUnreadNpcDialog(npcId: string, variantKey: string | null): boolean {
        return this.dialogManager.hasUnreadNpcDialog(npcId, variantKey);
    }

    markNpcChoiceAnswered(npcId: string | null | undefined): void {
        this.dialogManager.markNpcChoiceAnswered(npcId);
    }

    hasAnsweredChoice(npcId: string | null | undefined): boolean {
        return this.dialogManager.hasNpcChoiceAnswered(npcId);
    }

    setEditorMode(active = false): void {
        this.editorMode = Boolean(active);
    }

    isEditorModeActive(): boolean {
        return Boolean(this.editorMode);
    }

    createDefaultTestSettings(): TestSettings {
        return {
            startLevel: 1,
            skills: [],
            godMode: false
        };
    }

    getTestSettings(): TestSettings {
        return {
            startLevel: Number.isFinite(this.testSettings.startLevel)
                ? Math.floor(this.testSettings.startLevel)
                : 1,
            skills: this.areSkillsDisabled()
                ? []
                : (Array.isArray(this.testSettings.skills) ? this.testSettings.skills.slice() : []),
            godMode: Boolean(this.testSettings.godMode)
        };
    }

    setTestSettings(settings: Partial<TestSettings> = {}): TestSettings {
        const current = this.getTestSettings();
        const maxLevel = this.playerManager.maxLevel;
        const requestedStart = settings.startLevel;
        const startLevel = typeof requestedStart === 'number' && Number.isFinite(requestedStart)
            ? Math.max(1, Math.min(maxLevel, Math.floor(requestedStart)))
            : current.startLevel;

        const allSkills = SkillDefinitions.getAll() as Array<{ id: string }>;
        const validSkillIds = new Set(
            allSkills.map((skill) => skill.id).filter((id): id is string => typeof id === 'string')
        );
        const requestedSkills: string[] = Array.isArray(settings.skills)
            ? settings.skills
                .map((id) => (typeof id === 'string' ? id : null))
                .filter((id): id is string => typeof id === 'string' && validSkillIds.has(id))
            : current.skills;
        const skills = this.areSkillsDisabled()
            ? []
            : Array.from(new Set<string>(requestedSkills));
        const godMode = settings.godMode !== undefined ? Boolean(settings.godMode) : current.godMode;

        this.testSettings = { startLevel, skills, godMode };
        return this.getTestSettings();
    }

    applyTestSettingsRuntime(): void {
        const settings = this.getTestSettings();
        const startLevel = Number.isFinite(settings.startLevel) ? settings.startLevel : 1;
        this.playerManager.setLevel(startLevel);
        if (!this.areSkillsDisabled() && Array.isArray(settings.skills) && settings.skills.length) {
            settings.skills.forEach((id) => this.skillManager.addSkill(id));
        }
        this.playerManager.ensurePlayerStats();
        this.playerManager.setGodMode(settings.godMode);
    }

    resetGame(): void {
        this.screenManager.reset();
        this.skillManager.resetRuntime();
        this.playerManager.reset(this.game.start);
        this.dialogManager.reset();
        this.enemyManager.resetRuntime();
        this.variableManager.resetRuntime();
        this.itemManager.resetItems();
        this.objectManager.resetRuntime();
        this.objectManager.ensurePlayerStartObject();
        this.applyTestSettingsRuntime();
        this.setGameOver(false);
        this.hidePickupOverlay();
        this.clearNecromancerRevive();
        this.lastKillerEnemyId = null;
        this.hideLevelUpCelebration({ skipResume: true });
        // Clear ALL pause reasons (not just 'game-over') to prevent freeze
        // when resetting mid-combat or mid-level-up where multiple pause reasons accumulate
        this.lifecycle.resumeGame(null);
        // Compute initial logic gate state (and sync switches/variable-doors)
        this.evaluateLogicGatesAndSyncSideEffects();
    }

    exportGameData(): unknown {
        return this.dataFacade.exportGameData();
    }

    importGameData(data: unknown): void {
        this.dataFacade.importGameData(data);
    }

    normalizeRooms(rooms: unknown, totalRooms: number, cols: number): unknown {
        return this.worldFacade.normalizeRooms(rooms, totalRooms, cols);
    }

    normalizeTileMaps(source: unknown, totalRooms: number): unknown {
        return this.worldFacade.normalizeTileMaps(source, totalRooms);
    }

    normalizeObjects(objects: unknown): unknown {
        return this.objectManager.normalizeObjects(objects as unknown[] | null | undefined);
    }

    cloneEnemies(enemies: unknown): unknown {
        return this.enemyManager.cloneEnemies(enemies as EnemyDefinition[] | null | undefined);
    }

    generateObjectId(type: string, roomIndex: number): string {
        return this.objectManager.generateObjectId(type as Parameters<typeof this.objectManager.generateObjectId>[0], roomIndex);
    }

    getObjects(): unknown {
        return this.objectManager.getObjects();
    }

    getObjectsForRoom(roomIndex: number): unknown {
        return this.objectManager.getObjectsForRoom(roomIndex);
    }

    getObjectAt(roomIndex: number, x: number, y: number): unknown {
        return this.objectManager.getObjectAt(roomIndex, x, y);
    }

    setObjectPosition(type: string, roomIndex: number, x: number, y: number): unknown {
        return this.objectManager.setObjectPosition(type as Parameters<typeof this.objectManager.setObjectPosition>[0], roomIndex, x, y);
    }

    removeObject(type: string, roomIndex: number): void {
        this.objectManager.removeObject(type as Parameters<typeof this.objectManager.removeObject>[0], roomIndex);
    }

    removeObjectById(id: string): void {
        this.objectManager.removeObjectById(id);
    }

    moveObjectById(id: string, x: number, y: number): boolean {
        return this.objectManager.moveObjectById(id, x, y);
    }

    setObjectVariable(type: string, roomIndex: number, variableId: string | null) {
        return this.objectManager.setObjectVariable(type as Parameters<typeof this.objectManager.setObjectVariable>[0], roomIndex, variableId);
    }

    setObjectVariableById(id: string, variableId: string | null): string | null {
        return this.objectManager.setObjectVariableById(id, variableId);
    }

    setObjectContainsItemById(id: string, containsItemType: string | null): void {
        this.objectManager.setObjectContainsItemById(id, containsItemType);
    }

    setObjectRandomItemById(id: string, randomItem: boolean): void {
        this.objectManager.setObjectRandomItemById(id, randomItem);
    }

    getAllObjects() {
        return this.objectManager.getAllObjects();
    }

    setGateInputVariableById(id: string, variableId: string | null, slot: 1 | 2): string | null {
        return this.objectManager.setGateInputVariableById(id, variableId, slot);
    }

    setGateOutputVariableById(id: string, variableId: string | null): string | null {
        return this.objectManager.setGateOutputVariableById(id, variableId);
    }

    setObjectHiddenInGameById(id: string, hidden: boolean): boolean {
        return this.objectManager.setObjectHiddenInGameById(id, hidden);
    }

    setGateInputVariable(type: string, roomIndex: number, variableId: string | null, slot: 1 | 2): string | null {
        return this.objectManager.setGateInputVariable(type as ItemType, roomIndex, variableId, slot);
    }

    setGateOutputVariable(type: string, roomIndex: number, variableId: string | null): string | null {
        return this.objectManager.setGateOutputVariable(type as ItemType, roomIndex, variableId);
    }

    setPlayerEndText(roomIndex: number, text: string): string {
        return this.objectManager.setPlayerEndText(roomIndex, text);
    }

    getPlayerEndText(roomIndex: number | null = null): string {
        return this.objectManager.getPlayerEndText(roomIndex);
    }

    setActiveEndingText(text = ''): string {
        return this.screenManager.setActiveEndingText(text);
    }

    getActiveEndingText(): string {
        return this.screenManager.getActiveEndingText();
    }

    addKeys(amount = 1) {
        return this.playerManager.addKeys(amount);
    }

    addLife(amount = 1) {
        return this.playerManager.gainLives(amount);
    }

    addBonusMaxLife(amount = 1) {
        const bonus = this.skillManager.addBonusMaxLife(amount);
        this.healPlayerToFull();
        return bonus;
    }

    addDamageShield(amount = 1, type = null) {
        return this.playerManager.addDamageShield(amount, type);
    }

    setArmorEquipped() {
        this.playerManager.setArmorEquipped();
    }

    setBootsEquipped() {
        this.playerManager.setBootsEquipped();
    }

    hasBoots() {
        return this.playerManager.hasBoots();
    }

    resetPushBoxesForRoom(roomIndex: number): void {
        this.objectManager.resetPushBoxesForRoom(roomIndex);
    }

    hasArmor() {
        return this.playerManager.hasArmor();
    }

    getDamageShield() {
        return this.playerManager.getDamageShield();
    }

    getDamageShieldMax() {
        return this.playerManager.getDamageShieldMax();
    }

    getSwordType() {
        return this.playerManager.getSwordType();
    }

    setSwordType(swordType: string | null) {
        this.playerManager.setSwordType(swordType);
    }

    getSwordDurability() {
        return this.playerManager.getSwordDurability();
    }

    setSwordDurability(durability: number) {
        this.playerManager.setSwordDurability(durability);
    }

    consumeSwordDurability(): boolean {
        return this.playerManager.consumeSwordDurability();
    }

    getPlayerDamage(): number {
        const swordType = this.playerManager.getSwordType();
        if (!swordType) return 1; // Base damage without sword

        const itemDef = ItemDefinitions.getItemDefinition(swordType as ItemType);
        if (!itemDef) return 1;

        const damage = itemDef.getSwordDamage();
        return damage !== null ? damage : 1;
    }

    consumeKey() {
        return this.playerManager.consumeKey();
    }

    getKeys() {
        return this.playerManager.getKeys();
    }

    getMaxKeys() {
        return this.playerManager.getMaxKeys();
    }

    consumeLastDamageReduction() {
        return this.playerManager.consumeLastDamageReduction();
    }

    ensureDefaultVariables(): unknown {
        return this.variableManager.ensureDefaultVariables();
    }

    cloneVariables(list: unknown[]): unknown {
        return this.variableManager.cloneVariables(list as Parameters<typeof this.variableManager.cloneVariables>[0]);
    }

    normalizeVariables(source: unknown): unknown {
        return this.variableManager.normalizeVariables(source);
    }

    getVariableDefinitions(): unknown {
        return this.variableManager.getVariableDefinitions();
    }

    getVariables(): unknown {
        return this.variableManager.getVariables();
    }

    normalizeVariableId(variableId: string | number | null | undefined): string | null {
        return this.variableManager.normalizeVariableId(variableId);
    }

    getVariable(variableId: string | number | null | undefined): unknown {
        return this.variableManager.getVariable(variableId);
    }

    isVariableOn(variableId: string | number | null | undefined): boolean {
        return this.variableManager.isVariableOn(variableId);
    }

    setVariableValue(variableId: string | number, value: unknown, persist = false): [boolean, boolean] {
        const normalizedId = typeof variableId === 'string' ? variableId : String(variableId);
        const success = this.variableManager.setVariableValue(normalizedId, value, persist);
        let openedMagicDoor = false;
        if (success) {
            openedMagicDoor = this.objectManager.checkOpenedMagicDoor(normalizedId, value);
            this.objectManager.syncSwitchState(normalizedId, value);
            // Evaluate logic gates + sync side-effects for the variables they changed
            if (this.evaluateLogicGatesAndSyncSideEffects()) {
                openedMagicDoor = true;
            }
            this.onVariableChanged?.(normalizedId, value);
        }
        return [success, openedMagicDoor];
    }

    /**
     * Evaluates the logic gate network and synchronizes side-effects (switches,
     * variable-doors) for every variable the gates changed. Returns true if any
     * gate change opened a variable-door. Used by setVariableValue(), resetGame()
     * and after importGameData().
     */
    private evaluateLogicGatesAndSyncSideEffects(): boolean {
        const gateChanges = this.variableManager.evaluateLogicGates(this.objectManager.getObjects());
        let openedMagicDoor = false;
        for (const [changedId, changedValue] of gateChanges) {
            this.objectManager.syncSwitchState(changedId, changedValue);
            if (this.objectManager.checkOpenedMagicDoor(changedId, changedValue)) {
                openedMagicDoor = true;
            }
        }
        return openedMagicDoor;
    }

    recomputeLogicGates(): void {
        this.evaluateLogicGatesAndSyncSideEffects();
    }

    isLogicGateOutput(variableId: string): boolean {
        return this.objectManager.isLogicGateOutput(variableId);
    }

    getEnemies(): EnemyDefinition[] {
        return this.enemyManager.getEnemies();
    }

    getEnemyDefinitions(): EnemyDefinition[] {
        return this.enemyManager.getEnemyDefinitions();
    }

    clampRoomIndex(value: number): number {
        return this.worldManager.clampRoomIndex(value);
    }

    clampCoordinate(value: number): number {
        return this.worldManager.clampCoordinate(value);
    }

    getWorldRows(): number {
        return this.worldManager.getWorldRows();
    }

    getWorldCols(): number {
        return this.worldManager.getWorldCols();
    }

    getRoomCoords(index: number): { row: number; col: number } {
        return this.worldManager.getRoomCoords(index);
    }

    getRoomIndex(row: number, col: number): number | null {
        return this.worldManager.getRoomIndex(row, col);
    }

    addEnemy(enemy: EnemyDefinition): string | null {
        return this.enemyManager.addEnemy(enemy);
    }

    removeEnemy(enemyId: string | number): void {
        const id = typeof enemyId === 'string' ? enemyId : String(enemyId);
        this.enemyManager.removeEnemy(id);
    }

    setEnemyPosition(enemyId: string | number, x: number, y: number, roomIndex: number | null = null): void {
        this.enemyManager.setEnemyPosition(enemyId, x, y, roomIndex);
    }

    moveEnemyById(enemyId: string | number, x: number, y: number): boolean {
        return this.enemyManager.moveEnemyById(enemyId, x, y);
    }

    setEnemyVariable(enemyId: string | number, variableId: string | null = null): boolean {
        const normalized = this.normalizeVariableId(variableId);
        const normalizedEnemyId = typeof enemyId === 'string' ? enemyId : String(enemyId);
        return this.enemyManager.setEnemyVariable(normalizedEnemyId, normalized);
    }

    damagePlayer(amount = 1, options: { autoGameOver?: boolean } = {}) {
        const lives = this.playerManager.damage(amount);
        // Reaching 0 lives (with no revive) is a defeat. By default we mark
        // game-over here so paths that bypass combat — e.g. the online
        // 'player-took-damage' handler — still trigger defeat instead of leaving
        // the player as an "immortal ghost" at 0 HP. Combat opts out
        // (autoGameOver: false) because it plays its own death sequence first.
        const autoGameOver = options.autoGameOver !== false;
        if (autoGameOver && lives <= 0 && !this.isGameOver()) {
            this.setGameOver(true, 'defeat');
        }
        return lives;
    }

    isPlayerOnDamageCooldown() {
        return this.playerManager.isOnDamageCooldown();
    }

    getLives() {
        return this.playerManager.getLives();
    }

    getMaxLives() {
        return this.playerManager.getMaxLives();
    }

    getLevel() {
        return this.playerManager.getLevel();
    }

    healPlayerToFull() {
        return this.playerManager.healToFull();
    }

    getExperience() {
        return this.playerManager.getExperience();
    }

    getExperienceToNext() {
        return this.playerManager.getExperienceToNext();
    }

    addExperience(amount = 0): LevelUpResult | null {
        const result = this.playerManager.addExperience(amount);
        return this.processLevelUpResult(result);
    }

    handleEnemyDefeated(experienceReward = 0): LevelUpResult | null {
        const result = this.playerManager.handleEnemyDefeated(experienceReward);
        return this.processLevelUpResult(result);
    }

    processLevelUpResult(result: LevelUpResult | null = null): LevelUpResult | null {
        if (result?.leveledUp) {
            this.showLevelUpCelebration(result.level ?? null);
            if (!this.areSkillsDisabled()) {
                const levelCount =
                    typeof result.levelsGained === 'number' && Number.isFinite(result.levelsGained)
                        ? Math.max(1, Math.floor(result.levelsGained))
                        : 1;
                this.queueLevelUpChoices(levelCount, result.level ?? null);
            }
        }
        return result;
    }

    areSkillsDisabled(): boolean {
        return Boolean(this.game.disableSkills);
    }

    getPickupOverlay(): PickupOverlayState {
        return this.state.pickupOverlay;
    }

    runPickupOverlayEffect(effect: (() => void) | null): void {
        if (typeof effect !== 'function') return;
        try {
            effect();
        } catch (err) {
            console.error('Pickup overlay effect error:', err);
        }
    }

    showPickupOverlay(options: PickupOverlayOptions = {}): void {
        const overlay = this.getPickupOverlay();
        const pendingEffect = overlay.active ? overlay.effect : null;
        overlay.effect = null;
        this.runPickupOverlayEffect(pendingEffect);
        overlay.active = true;
        overlay.name = options.name || options.title || '';
        overlay.spriteGroup = options.spriteGroup || null;
        overlay.spriteType = options.spriteType || null;
        overlay.effect = typeof options.effect === 'function' ? options.effect : null;
        this.pauseGame('pickup-overlay');
    }

    hidePickupOverlay(): void {
        const overlay = this.getPickupOverlay();
        if (!overlay.active) return;
        overlay.active = false;
        const effect = overlay.effect;
        overlay.effect = null;
        overlay.name = '';
        overlay.spriteGroup = null;
        overlay.spriteType = null;
        this.runPickupOverlayEffect(effect);
        this.resumeGame('pickup-overlay');
    }

    isPickupOverlayActive(): boolean {
        return Boolean(this.getPickupOverlay().active);
    }

    getLevelUpCelebration(): LevelUpCelebrationState {
        return this.state.levelUpCelebration;
    }

    showLevelUpCelebration(level: number | null = null, options: LevelUpCelebrationOptions = {}): void {
        const overlay = this.getLevelUpCelebration();
        const numericLevel =
            typeof level === 'number' && Number.isFinite(level) ? Math.max(1, Math.floor(level)) : this.getLevel();
        overlay.active = true;
        overlay.level = numericLevel;
        overlay.startTime = this.getNow();
        const durationSetting = options.durationMs;
        overlay.durationMs =
            typeof durationSetting === 'number' && Number.isFinite(durationSetting)
                ? Math.max(300, Math.floor(durationSetting))
                : overlay.durationMs || 3000;
        if (overlay.timeoutId !== null) {
            clearTimeout(overlay.timeoutId);
            overlay.timeoutId = null;
        }
        const duration = overlay.durationMs || 3000;
        overlay.timeoutId = setTimeout(() => this.hideLevelUpCelebration(), duration);
        this.pauseGame('level-up-celebration');
    }

    hideLevelUpCelebration({ skipResume = false }: LevelUpCelebrationHideOptions = {}): void {
        const overlay = this.getLevelUpCelebration();
        if (overlay.timeoutId !== null) {
            clearTimeout(overlay.timeoutId);
            overlay.timeoutId = null;
        }
        const wasActive = overlay.active;
        overlay.active = false;
        overlay.level = null;
        overlay.startTime = 0;
        overlay.durationMs = overlay.durationMs || 3000;
        if (wasActive && !skipResume) {
            this.resumeGame('level-up-celebration');
            this.startLevelUpSelectionIfNeeded();
        }
    }

    isLevelUpCelebrationActive(): boolean {
        return Boolean(this.getLevelUpCelebration().active);
    }

    getNow(): number {
        const perf = (globalThis as Partial<typeof globalThis>).performance;
        if (perf) {
            return perf.now();
        }
        return Date.now();
    }

    enableGameOverInteraction(): void {
        this.screenManager.clearGameOverCooldown();
        this.screenManager.canResetAfterGameOver = true;
    }

    prepareNecromancerRevive(): boolean {
        if (!this.skillManager.hasPendingManualRevive()) {
            return false;
        }
        this.reviveSnapshot = this.captureReviveSnapshot();
        return Boolean(this.reviveSnapshot);
    }

    hasNecromancerReviveReady(): boolean {
        return Boolean(this.skillManager.hasPendingManualRevive() && this.reviveSnapshot);
    }

    setLastKillerEnemy(enemyId: string | null): void {
        this.lastKillerEnemyId = enemyId;
    }

    getLastKillerEnemyId(): string | null {
        return this.lastKillerEnemyId;
    }

    reviveFromNecromancer(): boolean {
        if (!this.hasNecromancerReviveReady()) return false;
        const restored = this.restoreReviveSnapshot(this.reviveSnapshot);
        this.reviveSnapshot = null;
        if (!restored) {
            return false;
        }
        const consumed = this.skillManager.consumeManualRevive();
        if (!consumed) {
            return false;
        }
        const maxLives = Number.isFinite(this.state.player.maxLives)
            ? Math.max(1, Math.floor(this.state.player.maxLives))
            : 1;
        this.state.player.currentLives = maxLives;
        this.state.player.lives = maxLives;

        this.lastKillerEnemyId = null;

        this.lifecycle.setGameOver(false);
        this.lifecycle.resumeGame('game-over');
        this.screenManager.clearGameOverCooldown();
        return true;
    }

    clearNecromancerRevive(): void {
        this.reviveSnapshot = null;
        this.skillManager.clearManualReviveFlag();
    }

    captureReviveSnapshot(): ReviveSnapshot | null {
        try {
            const gameCopy = this.safeClone(this.game);
            const stateCopy = this.safeClone(this.state);
            return { game: gameCopy, state: stateCopy };
        } catch (err) {
            console.error('Failed to capture revive snapshot', err);
            return null;
        }
    }

    restoreReviveSnapshot(snapshot: ReviveSnapshot | null = null): boolean {
        if (!snapshot) return false;
        try {
            this.assignData(this.game, snapshot.game);
            this.assignData(this.state, snapshot.state);
            this.worldManager.setGame(this.game);
            this.objectManager.setGame(this.game);
            this.variableManager.setGame(this.game);
            this.itemManager.setGame(this.game);
            return true;
        } catch (err) {
            console.error('Failed to restore revive snapshot', err);
            return false;
        }
    }

    assignData(target: Record<string, unknown> | null | undefined, source: Record<string, unknown> | null | undefined): void {
        if (!target || !source) return;
        Object.keys(target).forEach((key) => {
            delete target[key];
        });
        Object.keys(source).forEach((key) => {
            target[key] = this.safeClone(source[key]);
        });
    }

    safeClone<T>(value: T): T {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value)) as T;
    }

    pauseGame(reason = 'manual'): void {
        this.lifecycle.pauseGame(reason);
    }

    resumeGame(reason = 'manual'): void {
        this.lifecycle.resumeGame(reason);
    }

    setGameOver(active = true, reason = 'defeat'): void {
        this.lifecycle.setGameOver(active, reason);
    }

    isGameOver(): boolean {
        return this.lifecycle.isGameOver();
    }

    getGameOverReason(): string | null {
        return this.lifecycle.getGameOverReason();
    }

    get canResetAfterGameOver(): boolean {
        return this.screenManager.canResetAfterGameOver;
    }
}

export { GameState };
