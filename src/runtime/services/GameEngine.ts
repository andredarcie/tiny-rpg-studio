import { DialogManager } from './engine/DialogManager';
import { EnemyManager } from './engine/EnemyManager';
import { InteractionManager } from './engine/InteractionManager';
import { MovementManager } from './engine/MovementManager';
import { GameState } from '../domain/GameState';
import { InputManager } from '../adapters/InputManager';
import { NPCManager } from './NPCManager';
import { Renderer } from '../adapters/Renderer';
import { TextResources } from '../adapters/TextResources';
import { TileManager } from './TileManager';
import type { TileDefinition } from '../domain/definitions/tileTypes';
import { TileDefinitions } from '../domain/definitions/TileDefinitions';
import { GameConfig } from '../../config/GameConfig';

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
  rooms?: unknown[];
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
  awaitingRestart: boolean;
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
    });
    this.enemyManager = new EnemyManager(this.gameState as never, this.renderer, this.tileManager, {
      onPlayerDefeated: () => this.handlePlayerDefeat(),
      dialogManager: this.dialogManager,
    });
    this.movementManager = new MovementManager({
      gameState: this.gameState as never,
      tileManager: this.tileManager,
      renderer: this.renderer,
      dialogManager: this.dialogManager,
      interactionManager: this.interactionManager,
      enemyManager: this.enemyManager,
    });
    this.inputManager = new InputManager(this);
    this.awaitingRestart = false;
    this.introVisible = false;
    this.introStartTime = 0;
    this.introData = { title: 'Tiny RPG Studio', author: '' };
    this.canDismissIntroScreen = false;
    this.timeToResetAfterIntro = GameConfig.timing.resetAfterIntro;
    this.setupIntroScreen();

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
  }

  checkInteractions(): void {
    this.interactionManager.handlePlayerInteractions();
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
      const name = this.getSkillDisplayName(choice);
      const message =
        (TextResources.format('skills.pickupMessage', { name }, '') as string) ||
        `Você aprendeu ${name}`;
      this.dialogManager.showDialog(message);
    }
    this.renderer.draw();
  }

  getSkillDisplayName(choice: { nameKey?: string; id?: string } | null = null): string {
    if (!choice) return 'skill';
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
    this.syncDocumentTitle();
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
    this.introVisible = false;
    this.gameState.resumeGame('intro-screen');
    this.renderer.draw();
    return true;
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

  startEnemyLoop(): void {
    this.enemyManager.start();
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
    this.gameState.prepareNecromancerRevive();
    this.enemyManager.stop();
    this.gameState.pauseGame('game-over');
    this.gameState.setGameOver(true, 'defeat');
    this.awaitingRestart = true;
    this.renderer.draw();
  }

  handleGameCompletion(): void {
    if (this.isGameOver()) return;
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
