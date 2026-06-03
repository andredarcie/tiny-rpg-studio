import { DialogManager } from './engine/DialogManager';
import { EnemyManager } from './engine/EnemyManager';
import { soundEngine } from './SoundEngine';
import { InteractionManager } from './engine/InteractionManager';
import { MovementManager } from './engine/MovementManager';
import { CombatStunManager } from './engine/CombatStunManager';
import { GameState } from '../domain/GameState';
import { InputManager } from '../adapters/InputManager';
import { NPCManager } from './NPCManager';
import { Renderer } from '../adapters/Renderer';
import { TextResources } from '../adapters/TextResources';
import { TileManager } from './TileManager';
import type { TileDefinition } from '../domain/definitions/tileTypes';
import { TileDefinitions } from '../domain/definitions/TileDefinitions';
import { SkillDefinitions } from '../domain/definitions/SkillDefinitions';
import { GameConfig } from '../../config/GameConfig';
import type { OnlineConfig, SkillCustomizationMap } from '../../types/gameState';
import type { OnlineMode } from '../../types/onlineMode';
import { BackgroundMusicEngine } from './BackgroundMusicEngine';

type IntroData = { title: string; author: string };

type NpcInput = {
  id?: string;
  type?: string;
  name?: string;
  roomIndex?: number;
  x?: number;
  y?: number;
};

type EnemyInput = {
  id?: string;
  type: string;
  roomIndex?: number;
  x: number;
  y: number;
};

type GameData = {
  title?: string;
  author?: string;
  hideHud?: boolean;
  disableSkills?: boolean;
  disablePixelFont?: boolean;
  backgroundMusicVideoId?: string;
  backgroundMusicVolume?: number;
  skillCustomizations?: SkillCustomizationMap;
  rooms?: unknown[];
  online?: OnlineConfig;
};

export class GameEngine {
  canvas: HTMLCanvasElement;
  gameState: GameState;
  tileManager: TileManager;
  npcManager: NPCManager;
  renderer: Renderer;
  dialogManager: DialogManager;
  interactionManager: InteractionManager;
  enemyManager: EnemyManager;
  movementManager: MovementManager;
  inputManager: InputManager;
  combatStunManager: CombatStunManager;
  backgroundMusicEngine: BackgroundMusicEngine;
  isDestroyed: boolean;
  awaitingRestart: boolean;
  onlineMode: OnlineMode;
  onOnlinePlayerDefeated: (() => void) | null = null;
  onOnlineGameCompletion: (() => void) | null = null;
  onOnlineMove: ((dx: number, dy: number) => void) | null = null;
  onOnlineInteract: (() => void) | null = null;
  onOnlineEnemyDied: ((enemyId: string, roomIndex: number) => void) | null = null;
  onOnlineItemPicked: ((itemId: string, roomIndex: number) => void) | null = null;
  onOnlineObjectTriggered: ((objectId: string, roomIndex: number, newState: boolean) => void) | null = null;
  onOnlineStateChanged: (() => void) | null = null;
  introVisible: boolean;
  introStartTime: number;
  introData: IntroData;
  canDismissIntroScreen: boolean;
  timeToResetAfterIntro: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Boot core subsystems
    this.gameState = new GameState();
    this.tileManager = new TileManager(this.gameState);
    this.npcManager = new NPCManager(this.gameState);
    this.npcManager.ensureDefaultNPCs();
    this.renderer = new Renderer(canvas, this.gameState as never, this.tileManager, this.npcManager as never, this);
    this.dialogManager = new DialogManager(this.gameState as never, this.renderer);
    this.interactionManager = new InteractionManager(this.gameState as never, this.dialogManager, {
      onPlayerVictory: () => this.handleGameCompletion(),
      onTrapKill: () => {
        const trapName = TextResources.get('objects.label.trap', 'Trap') as string;
        this.enemyManager.combatManager.playDeathSequence(trapName);
      },
      onItemCollected: (itemId, roomIndex) => this.onOnlineItemPicked?.(itemId, roomIndex),
      onObjectTriggered: (objectId, roomIndex, newState) => this.onOnlineObjectTriggered?.(objectId, roomIndex, newState),
    });
    this.combatStunManager = new CombatStunManager(this.gameState.state);
    this.enemyManager = new EnemyManager(this.gameState as never, this.renderer, this.tileManager, {
      onPlayerDefeated: () => this.handlePlayerDefeat(),
      onEnemyDefeated: (enemyId: string, enemy: { roomIndex: number }) => {
        this.onOnlineEnemyDied?.(enemyId, enemy.roomIndex);
      },
      dialogManager: this.dialogManager,
      combatStunManager: this.combatStunManager,
      playerManager: this.gameState.playerManager,
      onEnemyStateChanged: () => this.onOnlineStateChanged?.(),
    });
    (this.gameState as unknown as { isInCombat?: () => boolean }).isInCombat =
      () => this.enemyManager.isInCombat();
    this.movementManager = new MovementManager({
      gameState: this.gameState as never,
      tileManager: this.tileManager,
      renderer: this.renderer,
      dialogManager: this.dialogManager,
      interactionManager: this.interactionManager,
      enemyManager: this.enemyManager,
      combatStunManager: this.combatStunManager,
      options: {
        onObjectOpened: (objectId, roomIndex) => this.onOnlineObjectTriggered?.(objectId, roomIndex, true),
      },
    });
    this.inputManager = new InputManager(this);
    this.backgroundMusicEngine = new BackgroundMusicEngine();
    this.isDestroyed = false;
    this.awaitingRestart = false;
    this.onlineMode = 'solo';
    this.introVisible = false;
    this.introStartTime = 0;
    this.introData = { title: 'Tiny RPG Studio', author: '' };
    this.canDismissIntroScreen = false;
    this.timeToResetAfterIntro = GameConfig.timing.resetAfterIntro;
    this.gameState.setLevelUpOverlayPresentationSync(() => this.syncLevelUpOverlayPresentation());
    this.setupIntroScreen();
    this.backgroundMusicEngine.syncFromGame(this.gameState.getGame());

    // Ensure there is at least a ground layer
    this.tileManager.ensureDefaultTiles();

    // Draw the first frame
    this.syncDocumentTitle();
    this.renderer.draw();
    this.showIntroScreen();
    this.startEnemyLoop();
  }

  // Movement and interaction handling
  tryMove(dx: number, dy: number): void {
    this.movementManager.tryMove(dx, dy);
    this.onOnlineMove?.(dx, dy);
  }

  checkInteractions(): void {
    this.interactionManager.handlePlayerInteractions();
    this.onOnlineInteract?.();
    this.onOnlineStateChanged?.();
  }

  showDialog(text: string, options: Record<string, unknown> = {}): void {
    this.dialogManager.showDialog(text, options);
  }

  completeDialog(): void {
    this.dialogManager.completeDialog();
  }

  closeDialog(): void {
    this.dialogManager.closeDialog();
  }

  isPickupOverlayActive(): boolean {
    return Boolean(this.gameState.isPickupOverlayActive());
  }

  dismissPickupOverlay(): void {
    if (!this.gameState.isPickupOverlayActive()) return;
    this.gameState.hidePickupOverlay();
    this.renderer.draw();
  }

  isLevelUpCelebrationActive(): boolean {
    return Boolean(this.gameState.isLevelUpCelebrationActive());
  }

  dismissLevelUpCelebration(): void {
    if (!this.gameState.isLevelUpCelebrationActive()) return;
    this.gameState.hideLevelUpCelebration();
    this.renderer.draw();
  }

  isLevelUpOverlayActive(): boolean {
    return Boolean(this.gameState.isLevelUpOverlayActive());
  }

  moveLevelUpCursor(delta = 0): void {
    if (!this.isLevelUpOverlayActive()) return;
    this.gameState.moveLevelUpCursor(delta);
    this.renderer.draw();
  }

    confirmLevelUpSelection(): void {
        if (!this.isLevelUpOverlayActive()) return;
        const overlay = this.gameState.getLevelUpOverlay();
        const selection = Number.isFinite(overlay.cursor) ? overlay.cursor : 0;
        this.chooseLevelUpSkill(selection);
    }

  chooseLevelUpSkill(index: number | null = null): void {
    if (!this.isLevelUpOverlayActive()) return;
    const choice = this.gameState.selectLevelUpSkill(index);
    if (choice) {
      soundEngine.play('skillPick');
      const name = this.getSkillDisplayName(choice);
      const message =
        (TextResources.format('skills.pickupMessage', { name }, '') as string) ||
        `Você aprendeu ${name}`;
      this.dialogManager.showDialog(message);
    }
    this.renderer.draw();
  }

  getSkillDisplayName(choice: { resolvedName?: string; nameKey?: string; id?: string } | null = null): string {
    if (!choice) return 'skill';
    if (choice.resolvedName) return choice.resolvedName;
    if (choice.nameKey) {
      const localized = TextResources.get(choice.nameKey, choice.id || 'skill') as string;
      if (localized) return localized;
    }
    if (choice.id) return choice.id;
    return 'skill';
  }

  pickLevelUpChoiceFromPointer(clientX: number, clientY: number): number | null {
        const overlay = this.gameState.getLevelUpOverlay();
        if (!overlay.active) return null;
    const choices = Array.isArray(overlay.choices) ? overlay.choices : [];
    if (!choices.length) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return typeof overlay.cursor === 'number' && Number.isFinite(overlay.cursor) ? overlay.cursor : 0;
    }
    const scaleX = this.canvas.width / (rect.width || 1);
    const scaleY = this.canvas.height / (rect.height || 1);
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    const pending = Math.max(0, this.gameState.getPendingLevelUpChoices() || 0);
        const layout = this.renderer.overlayRenderer.getLevelUpCardLayout({
            width: this.canvas.width,
            height: this.canvas.height,
            choicesLength: choices.length,
            hasPendingText: pending > 0,
        });
        const rects = layout.rects;
    const hitIndex = rects.findIndex(
      (r: { x: number; y: number; width: number; height: number }) =>
        canvasX >= r.x &&
        canvasX <= r.x + r.width &&
        canvasY >= r.y &&
        canvasY <= r.y + r.height,
    );
    if (hitIndex >= 0) {
      return hitIndex;
    }
    if (rects.length) {
      let bestIndex = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      rects.forEach((r: { x: number; y: number; width: number; height: number }, idx: number) => {
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const dx = canvasX - cx;
        const dy = canvasY - cy;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = idx;
        }
      });
      return bestIndex;
    }
    return typeof overlay.cursor === 'number' && Number.isFinite(overlay.cursor) ? overlay.cursor : 0;
  }

  resetGame(): void {
    this.awaitingRestart = false;
    this.backgroundMusicEngine.stop();
    this.gameState.setGameOver(false);
    this.gameState.resumeGame('game-over');
    this.gameState.resetGame();
    this.startEnemyLoop();
    this.dialogManager.reset();
    this.renderer.draw();
    this.showIntroScreen();
  }

  // Data helpers
  exportGameData(): unknown {
    return this.gameState.exportGameData();
  }

  importGameData(data: unknown): void {
    this.gameState.importGameData(data);
    this.npcManager.ensureDefaultNPCs();
    this.tileManager.ensureDefaultTiles();
    const game = this.gameState.getGame();
    if (Array.isArray(game.customPalette) && game.customPalette.length === 16) {
      this.setCustomPalette(game.customPalette);
    } else {
      this.resetPaletteToDefault();
    }
    this.backgroundMusicEngine.syncFromGame(game);
    this.syncDocumentTitle();
    this.gameState.recomputeLogicGates();
    this.startEnemyLoop();
    this.dialogManager.reset();
    this.renderer.draw();
    this.showIntroScreen();
  }

  getTestSettings(): { startLevel: number; skills: unknown[]; godMode: boolean } {
        return this.gameState.getTestSettings();
  }

  updateTestSettings(settings: Record<string, unknown> = {}): void {
    this.gameState.setTestSettings(settings);
    this.resetGame();
  }

  getMaxPlayerLevel(): number {
    return this.gameState.getMaxPlayerLevel() || 1;
  }

  // Compatibility accessors
  getState(): unknown {
    return this.gameState.getState();
  }

  getGame(): GameData {
    return this.gameState.getGame();
  }

  // Custom Palette Management
  setCustomPalette(colors: string[] | null): void {
    const game = this.gameState.getGame();
    game.customPalette = colors || undefined;

    // Regenerate tiles with new palette colors
    const activePalette = colors || (TileDefinitions.PICO8_COLORS as string[]);
    this.tileManager.regenerateTilesWithPalette(activePalette);

    // Invalidate sprite caches - they will be lazily rebuilt on next access via getters
    this.renderer.spriteFactory.invalidate();

    // Force complete re-render (triggers lazy rebuilding of sprites via getters)
    this.draw();
  }

  setHideHud(active = false): void {
    const game = this.gameState.getGame();
    game.hideHud = Boolean(active);
    this.draw();
  }

  setDisableSkills(active = false): void {
    const game = this.gameState.getGame();
    game.disableSkills = Boolean(active);
    this.gameState.resetGame();
    this.draw();
  }

  setDisablePixelFont(active = false): void {
    const game = this.gameState.getGame();
    game.disablePixelFont = Boolean(active);
    this.draw();
  }

  setSkillCustomizations(customizations: SkillCustomizationMap | undefined): void {
    const game = this.gameState.getGame();
    game.skillCustomizations = SkillDefinitions.sanitizeCustomizationMap(customizations);
    this.draw();
  }

  private syncLevelUpOverlayPresentation(): void {
    if (!this.gameState.isLevelUpOverlayActive()) return;
    this.enrichLevelUpChoices();
  }

  private enrichLevelUpChoices(): void {
    const overlay = this.gameState.getLevelUpOverlay();
    if (!overlay.choices.length) return;
    const customizations = this.gameState.getGame().skillCustomizations;

    overlay.choices = overlay.choices.map((choice) => {
      const skill = SkillDefinitions.getById(choice.id);
      if (!skill) return choice;
      return {
        ...choice,
        resolvedName: SkillDefinitions.getDisplayName(
          skill,
          customizations,
          (key) => TextResources.get(key, '') as string,
        ),
        resolvedDescription: SkillDefinitions.getDisplayDescription(
          skill,
          customizations,
          (key) => TextResources.get(key, '') as string,
        ),
        icon: SkillDefinitions.getDisplayIcon(skill, customizations),
      };
    });
  }

  setSkillOrder(order: string[] | undefined): void {
    const game = this.gameState.getGame();
    game.skillOrder = Array.isArray(order) && order.length ? order : undefined;
    this.gameState.skillManager.setSkillOrder(game.skillOrder);
  }

  getCustomPalette(): string[] | undefined {
    const game = this.gameState.getGame();
    return game.customPalette;
  }

  resetPaletteToDefault(): void {
    this.setCustomPalette(null);
  }

  get rendererPalette() {
    return this.renderer.paletteManager;
  }

  draw(): void {
    this.renderer.draw();
  }

  // Utility helpers
  clamp(v: number, a: number, b: number): number {
    return Math.max(a, Math.min(b, v));
  }

  syncDocumentTitle(): void {
    const game = this.gameState.getGame();
    document.title = game.title || 'Tiny RPG Studio';
  }

  setupIntroScreen(): void {
    if (typeof document === 'undefined') return;
    this.refreshIntroScreen();
  }

  showIntroScreen(): void {
    this.canDismissIntroScreen = true;
    this.refreshIntroScreen();
    this.introVisible = true;
        this.introStartTime = this.gameState.getNow();
    this.gameState.pauseGame('intro-screen');
    this.renderer.draw();
  }

  dismissIntroScreen(): boolean {
    if (!this.introVisible || !this.canDismissIntroScreen) return false;
    // In the editor the intro is rendered as a static preview of the title
    // screen. Dismissing it would resume gameplay and start the background
    // music, so it must be inert while editing.
    if (this.isEditorModeActive()) return false;
    this.introVisible = false;
    this.gameState.resumeGame('intro-screen');
    this.resumeBackgroundMusic();
    this.renderer.draw();
    return true;
  }

  resumeBackgroundMusic(): void {
    // Background music is strictly a play-mode concern; never start it while
    // the project is being edited regardless of how this path is reached.
    if (this.isEditorModeActive()) return;
    this.backgroundMusicEngine.play();
  }

  // Single source of truth for "is the project being edited rather than played".
  isEditorModeActive(): boolean {
    return this.gameState.isEditorModeActive();
  }

  isIntroVisible(): boolean {
    return Boolean(this.introVisible);
  }

  refreshIntroScreen(): void {
    const game = this.getGame();
    this.introData = {
      title: game.title || 'Tiny RPG Studio',
      author: (game.author || '').trim(),
    };
    this.renderer.setIntroData(this.introData);
  }

  getIntroData(): IntroData {
    return this.introData;
  }

  // Editor-facing helpers
  getTiles(): unknown {
    return this.tileManager.getTiles();
  }

  getTileMap(roomIndex: number | null = null): unknown {
    const playerRoom = this.gameState.getPlayer()?.roomIndex ?? 0;
        const targetRoom = roomIndex ?? playerRoom;
    return this.tileManager.getTileMap(targetRoom);
  }

  getTilePresetNames(): string[] {
    return this.tileManager.getPresetTileNames();
  }

  getVariableDefinitions(): unknown {
    return this.gameState.getVariableDefinitions();
  }

  getRuntimeVariables(): unknown {
    return this.gameState.getVariables();
  }

  setVariableDefault(variableId: string | number, value: unknown): boolean {
    const [changed] = this.gameState.setVariableValue(variableId, value, true);
    if (changed) {
      this.renderer.draw();
    }
    return changed;
  }

  isVariableOn(variableId: string | number): boolean {
    return this.gameState.isVariableOn(variableId);
  }

  getObjects(): unknown {
    return this.gameState.getObjects();
  }

  getObjectsForRoom(roomIndex: number | null = null): unknown {
    const playerRoom = this.gameState.getPlayer()?.roomIndex ?? 0;
        const targetRoom = roomIndex ?? playerRoom;
    return this.gameState.getObjectsForRoom(targetRoom);
  }

  setObjectPosition(type: string, roomIndex: number, x: number, y: number): unknown {
    const entry = this.gameState.setObjectPosition(type, roomIndex, x, y);
    this.renderer.draw();
    return entry;
  }

  setObjectVariable(type: string, roomIndex: number, variableId: string | number): unknown {
    const normalizedVariableId = typeof variableId === 'string' ? variableId : null;
    const updated = this.gameState.setObjectVariable(type, roomIndex, normalizedVariableId);
    this.renderer.draw();
    return updated;
  }

  setGateInputVariable(type: string, roomIndex: number, variableId: string | null, slot: 1 | 2): string | null {
    const result = this.gameState.setGateInputVariable(type, roomIndex, variableId, slot);
    this.gameState.recomputeLogicGates();
    this.renderer.draw();
    return result;
  }

  setGateOutputVariable(type: string, roomIndex: number, variableId: string | null): string | null {
    const result = this.gameState.setGateOutputVariable(type, roomIndex, variableId);
    this.gameState.recomputeLogicGates();
    this.renderer.draw();
    return result;
  }

  setObjectVariableById(id: string, variableId: string | null): string | null {
    const result = this.gameState.setObjectVariableById(id, variableId);
    this.renderer.draw();
    return result;
  }

  setObjectContainsItemById(id: string, containsItemType: string | null): void {
    this.gameState.setObjectContainsItemById(id, containsItemType);
    this.renderer.draw();
  }

  setObjectRandomItemById(id: string, randomItem: boolean): void {
    this.gameState.setObjectRandomItemById(id, randomItem);
    this.renderer.draw();
  }

  setGateInputVariableById(id: string, variableId: string | null, slot: 1 | 2): string | null {
    const result = this.gameState.setGateInputVariableById(id, variableId, slot);
    this.gameState.recomputeLogicGates();
    this.renderer.draw();
    return result;
  }

  setGateOutputVariableById(id: string, variableId: string | null): string | null {
    const result = this.gameState.setGateOutputVariableById(id, variableId);
    this.gameState.recomputeLogicGates();
    this.renderer.draw();
    return result;
  }

  setObjectHiddenInGameById(id: string, hidden: boolean): boolean {
    const result = this.gameState.setObjectHiddenInGameById(id, hidden);
    this.renderer.draw();
    return result;
  }

  setPlayerEndText(roomIndex: number, text: string): string {
    const normalized = this.gameState.setPlayerEndText(roomIndex, text);
    this.renderer.draw();
    return normalized;
  }

  getPlayerEndText(roomIndex: number | null = null): string {
    return this.gameState.getPlayerEndText(roomIndex);
  }

  removeObject(type: string, roomIndex: number): void {
    this.gameState.removeObject(type, roomIndex);
    this.renderer.draw();
  }

  removeObjectById(id: string): void {
    this.gameState.removeObjectById(id);
    this.renderer.draw();
  }

  moveObjectById(id: string, x: number, y: number): boolean {
    return this.gameState.moveObjectById(id, x, y);
  }

  getKeyCount(): number {
    return this.gameState.getKeys();
  }

  getSprites(): unknown {
    this.npcManager.ensureDefaultNPCs();
    return this.npcManager.getNPCs();
  }

  updateTile(tileId: string | number, data: Partial<TileDefinition>): void {
    this.tileManager.updateTile(tileId, data);
  }

  setMapTile(x: number, y: number, tileId: string | number, roomIndex: number | null = null): void {
    const playerRoom = this.gameState.getPlayer()?.roomIndex ?? 0;
    const targetRoom = roomIndex ?? playerRoom;
    this.tileManager.setMapTile(x, y, tileId, targetRoom);
  }

  addSprite(npc: unknown): unknown {
    return this.npcManager.addNPC(npc as NpcInput);
  }

  // Enemy helpers
  getEnemyDefinitions(): unknown {
    return this.enemyManager.getEnemyDefinitions();
  }

  getActiveEnemies(): unknown {
    return this.enemyManager.getActiveEnemies();
  }

  addEnemy(enemy: unknown): unknown {
    return this.enemyManager.addEnemy(enemy as EnemyInput);
  }

  removeEnemy(enemyId: string | number): void {
    this.enemyManager.removeEnemy(String(enemyId));
  }

  generateEnemyId(): string {
    return this.enemyManager.generateEnemyId();
  }

  setEnemyVariable(enemyId: string | number, variableId: string | number | null = null): boolean {
    if (typeof this.gameState.setEnemyVariable !== 'function') {
      return false;
    }
    const normalizedVariableId = typeof variableId === 'string' ? variableId : null;
    const changed = this.gameState.setEnemyVariable(enemyId, normalizedVariableId);
    if (changed) {
      this.renderer.draw();
    }
    return changed;
  }

  setOnlineMode(mode: OnlineMode): void {
    this.onlineMode = mode;
  }

  setOnlineActiveRooms(rooms: ReadonlySet<number> | null): void {
    this.enemyManager.setActiveRooms(rooms);
  }

  setRemotePlayersForEnemyAI(players: Array<{ id: string; x: number; y: number; roomIndex: number; alive?: boolean }>): void {
    this.enemyManager.setRemotePlayers(players);
  }

  processGuestMove(guestX: number, guestY: number, guestRoomIndex: number, dx: number, dy: number): void {
    this.movementManager.tryPushBoxForGuest(guestX, guestY, guestRoomIndex, dx, dy);
    // Evaluate pressure plates for the guest's new position without clobbering
    // the local player's activation state (handled by _evaluatePressurePlates).
    this.interactionManager.checkPressurePlatesAt({ x: guestX, y: guestY, roomIndex: guestRoomIndex });
    this.onOnlineStateChanged?.();
  }

  processGuestInteract(guestX: number, guestY: number, guestRoomIndex: number): void {
    // Only process switch toggles on behalf of the Guest.
    // Items, NPCs, traps, chests and exits must NOT run here — they have
    // local side-effects (inventory, dialog, room transition) that belong
    // to the player who actually triggered them, not the Host.
    const triggered = this.interactionManager.handleSwitchInteractAt(guestX, guestY, guestRoomIndex);
    if (triggered) {
      this.renderer.draw();
      this.onOnlineStateChanged?.();
    }
  }

  processGuestAttack(enemyId: string): void {
    this.processGuestAttackDamage(enemyId, 1);
  }

  processGuestAttackDamage(enemyId: string, damage = 1): void {
    const enemies = this.gameState.getEnemies();
    const enemy = enemies.find((e) => e.id === enemyId);
    if (!enemy || typeof (enemy as { deathStartTime?: number | null }).deathStartTime === 'number') return;
    const lives = typeof enemy.lives === 'number' ? enemy.lives : 1;
    const normalizedDamage = Number.isFinite(damage) ? Math.max(1, Math.floor(damage)) : 1;
    enemy.lives = Math.max(0, lives - normalizedDamage);
    if (enemy.lives <= 0) {
      (enemy as { deathStartTime?: number | null }).deathStartTime = performance.now();
      // Cancel any pending windup timers targeting this enemy to prevent ghost damage
      this.enemyManager.cancelWindupTimersForEnemy(enemyId);
      // Clear the attack telegraph so the indicator doesn't persist
      this.renderer.attackTelegraph.deactivateTelegraph(enemyId);
      this.onOnlineEnemyDied?.(enemyId, enemy.roomIndex);
      setTimeout(() => {
        const idx = this.gameState.getEnemies().findIndex((e) => e.id === enemyId);
        if (idx >= 0) this.gameState.getEnemies().splice(idx, 1);
      }, 1000);
    }
    this.onOnlineStateChanged?.();
    this.renderer.draw();
  }

  prepareOnlineGuestAttack(enemyId: string): number | null {
    const player = this.gameState.getPlayer();
    if (!player) return null;
    const now = performance.now();
    if (now - player.lastAttackTime < GameConfig.combat.attackCooldown) {
      return null;
    }
    const enemy = this.gameState.getEnemies().find((entry) => entry.id === enemyId);
    if (!enemy || typeof enemy.deathStartTime === 'number') return null;

    player.lastAttackTime = now;
    const baseDamage = this.gameState.getPlayerDamage();
    const backstabDamage = this.isOnlineBackstab(player, enemy) ? 1 : 0;
    this.gameState.consumeSwordDurability();
    this.renderer.draw();
    return baseDamage + backstabDamage;
  }

  private isOnlineBackstab(player: { x: number; y: number; roomIndex: number }, enemy: { x: number; y: number; roomIndex: number; lastX?: number; lastY?: number }): boolean {
    if (player.roomIndex !== enemy.roomIndex) return false;
    const dx = enemy.x - (enemy.lastX ?? enemy.x);
    const dy = enemy.y - (enemy.lastY ?? enemy.y);
    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
      return dx > 0 ? player.x < enemy.x : player.x > enemy.x;
    }
    if (dy !== 0) {
      return dy > 0 ? player.y < enemy.y : player.y > enemy.y;
    }
    return false;
  }

  isGuestMode(): boolean {
    return this.onlineMode === 'online-guest';
  }

  startEnemyLoop(): void {
    // Do not run the enemy simulation while editing. Halt the timer entirely
    // instead of relying on a per-tick no-op so nothing ticks in the background.
    if (this.isEditorModeActive()) {
      this.enemyManager.stop();
      return;
    }
    // Guests do not run the enemy simulation — they receive world state from the Host.
    if (this.isGuestMode()) {
      this.enemyManager.stop();
      return;
    }
    this.enemyManager.start();
  }

  destroy(): void {
    this.isDestroyed = true;
    this.enemyManager.stop();
    this.backgroundMusicEngine.destroy();
    if (this.renderer.tileAnimationTimer) {
      clearInterval(this.renderer.tileAnimationTimer);
      this.renderer.tileAnimationTimer = null;
    }
  }

  tickEnemies(): void {
    this.enemyManager.tick();
  }

  handleEnemyCollision(enemyIndex: number): void {
    this.enemyManager.handleEnemyCollision(enemyIndex);
  }

  checkEnemyCollisionAt(x: number, y: number): void {
    this.enemyManager.checkCollisionAt(x, y);
  }

  handlePlayerDefeat(): void {
    this.onOnlinePlayerDefeated?.();
    this.gameState.prepareNecromancerRevive();
    this.enemyManager.stop();
    this.gameState.pauseGame('game-over');
    this.gameState.setGameOver(true, 'defeat');
    this.awaitingRestart = true;
    this.renderer.draw();
  }

  handleGameCompletion(): void {
    if (this.isGameOver()) return;
    // Guests don't auto-trigger victory — the Host sends a game-over event.
    if (this.isGuestMode()) return;
    this.onOnlineGameCompletion?.();
    soundEngine.play('victory');
    this.enemyManager.stop();
    this.gameState.pauseGame('game-over');
    this.gameState.setGameOver(true, 'victory');
    this.awaitingRestart = true;
    this.renderer.draw();
  }

  isGameOver(): boolean {
    return this.gameState.isGameOver();
  }

  handleGameOverInteraction(): void {
    if (!this.isGameOver() || !this.gameState.canResetAfterGameOver) return;
    if (this.gameState.hasNecromancerReviveReady()) {
      const revived = this.gameState.reviveFromNecromancer();
      if (revived) {
        this.awaitingRestart = false;
        this.enemyManager.start();
        this.renderer.draw();
        return;
      }
    }
    this.resetGame();
  }
}
