import { GameConfig } from '../../config/GameConfig';

type DialogState = {
  active: boolean;
  page: number;
  maxPages: number;
};

type GameStateApi = {
  getDialog: () => DialogState;
  setDialogPage: (page: number) => void;
};

type RendererApi = {
  draw: () => void;
};

type GameEngineApi = {
  gameState: GameStateApi;
  renderer: RendererApi;
  tryMove: (dx: number, dy: number) => void;
  closeDialog: () => void;
  isGameOver?: () => boolean;
  handleGameOverInteraction?: () => void;
  isIntroVisible?: () => boolean;
  dismissIntroScreen?: () => void;
  isLevelUpOverlayActive?: () => boolean;
  isPickupOverlayActive?: () => boolean;
  dismissPickupOverlay?: () => void;
  chooseLevelUpSkill?: (index: number) => void;
  moveLevelUpCursor?: (delta: number) => void;
  draw?: () => void;
  confirmLevelUpSelection?: () => void;
  pickLevelUpChoiceFromPointer?: (x: number, y: number) => number | null | undefined;
};

type TouchStart = {
  x: number;
  y: number;
  time: number;
  prevented: boolean;
};

/**
 * InputManager wires keyboard and editor pointer interactions.
 */
class InputManager {
  private gameEngine: GameEngineApi;
  private touchStart: TouchStart | null;

  constructor(gameEngine: GameEngineApi) {
    this.gameEngine = gameEngine;
    this.touchStart = null;
    this.setupEventListeners();
  }

  isGameModeActive(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    return document.body.classList.contains('game-mode');
  }

  setupEventListeners(): void {
    document.addEventListener('keydown', (ev) => this.handleKeyDown(ev));
    document.addEventListener('touchstart', (ev) => this.handleTouchStart(ev), { passive: false });
    document.addEventListener('touchmove', (ev) => this.handleTouchMove(ev), { passive: false });
    document.addEventListener('touchend', (ev) => this.handleTouchEnd(ev), { passive: false });
    document.addEventListener('click', (ev) => this.handleClick(ev));
  }

  handleKeyDown(ev: KeyboardEvent): void {
    if (this.gameEngine.isGameOver?.()) {
      ev.preventDefault();
      this.gameEngine.handleGameOverInteraction?.();
      return;
    }
    if (this.gameEngine.isIntroVisible?.()) {
      ev.preventDefault();
      this.gameEngine.dismissIntroScreen?.();
      return;
    }
    if (this.gameEngine.isLevelUpOverlayActive?.()) {
      ev.preventDefault();
      this.handleLevelUpKey(ev);
      return;
    }
    if (this.gameEngine.isPickupOverlayActive?.()) {
      ev.preventDefault();
      this.gameEngine.dismissPickupOverlay?.();
      return;
    }
    const dialog = this.gameEngine.gameState.getDialog();

    // When a dialog is open, only allow confirmation keys to handle it
    if (dialog.active) {
      switch (ev.key.toLowerCase()) {
        case 'z':
        case 'enter':
        case ' ':
          ev.preventDefault();
          if (dialog.page >= dialog.maxPages) {
            this.gameEngine.closeDialog();
          } else {
            this.gameEngine.gameState.setDialogPage(dialog.page + 1);
            this.gameEngine.renderer.draw();
          }
          break;
      }
      return;
    }

    // Player movement via arrows and WASD (game tab only, avoid typing fields)
    const target = ev.target as HTMLElement | null;
    const targetTag = target?.tagName.toLowerCase() || '';
    const isTypingTarget =
      targetTag === 'input' ||
      targetTag === 'textarea' ||
      targetTag === 'select' ||
      target?.isContentEditable;
    const isGameTabActive = this.isGameModeActive();
    if (!isGameTabActive || isTypingTarget) {
      return;
    }

    const movementKey = ev.key.toLowerCase();
    const movementMap: Record<string, [number, number] | undefined> = {
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
      arrowup: [0, -1],
      w: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
    };
    const delta = movementMap[movementKey];
    if (delta) {
      ev.preventDefault();
      this.gameEngine.tryMove(delta[0], delta[1]);
    }
  }

  handleTouchStart(ev: TouchEvent): void {
    if (!this.isGameModeActive()) {
      this.touchStart = null;
      return;
    }
    if (this.gameEngine.isGameOver?.()) {
      ev.preventDefault();
      this.gameEngine.handleGameOverInteraction?.();
      this.touchStart = null;
      return;
    }
    if (this.gameEngine.isIntroVisible?.()) {
      ev.preventDefault();
      this.gameEngine.dismissIntroScreen?.();
      this.touchStart = null;
      return;
    }
    if (this.gameEngine.isLevelUpOverlayActive?.()) {
      ev.preventDefault();
      const touch = ev.changedTouches.item(0);
      if (touch) {
        this.chooseLevelUpByPointer(touch.clientX, touch.clientY);
      }
      this.touchStart = null;
      return;
    }
    if (this.gameEngine.isPickupOverlayActive?.()) {
      ev.preventDefault();
      this.gameEngine.dismissPickupOverlay?.();
      this.touchStart = null;
      return;
    }
    const touch = ev.changedTouches.item(0);
    if (!touch) return;
    this.touchStart = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      prevented: false,
    };
  }

  handleTouchMove(ev: TouchEvent): void {
    if (!this.isGameModeActive()) {
      this.touchStart = null;
      return;
    }
    const start = this.touchStart;
    if (!start) return;
    const touch = ev.changedTouches.item(0);
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const MOVE_THRESHOLD = 12;

    if (distance >= MOVE_THRESHOLD) {
      ev.preventDefault();
      start.prevented = true;
    } else if (start.prevented) {
      ev.preventDefault();
    }
  }

  handleTouchEnd(ev: TouchEvent): void {
    if (!this.isGameModeActive()) {
      this.touchStart = null;
      return;
    }
    if (this.gameEngine.isGameOver?.()) {
      ev.preventDefault();
      this.gameEngine.handleGameOverInteraction?.();
      this.touchStart = null;
      return;
    }
    if (this.gameEngine.isIntroVisible?.()) {
      ev.preventDefault();
      this.gameEngine.dismissIntroScreen?.();
      this.touchStart = null;
      return;
    }
    if (this.gameEngine.isLevelUpOverlayActive?.()) {
      ev.preventDefault();
      const touch = ev.changedTouches.item(0);
      if (touch) {
        this.chooseLevelUpByPointer(touch.clientX, touch.clientY);
      }
      this.touchStart = null;
      return;
    }
    if (this.gameEngine.isPickupOverlayActive?.()) {
      ev.preventDefault();
      this.gameEngine.dismissPickupOverlay?.();
      this.touchStart = null;
      return;
    }
    const start = this.touchStart;
    if (!start) return;

    const touch = ev.changedTouches.item(0);
    if (!touch) {
      this.touchStart = null;
      return;
    }

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - start.time;

    this.touchStart = null;

    const MIN_DISTANCE = 24;
    const MAX_DURATION = GameConfig.input.maxDuration;
    if (distance < MIN_DISTANCE || duration > MAX_DURATION) {
      return;
    }

    ev.preventDefault();

    if (absX > absY) {
      if (dx > 0) {
        this.gameEngine.tryMove(1, 0);
      } else {
        this.gameEngine.tryMove(-1, 0);
      }
    } else {
      if (dy > 0) {
        this.gameEngine.tryMove(0, 1);
      } else {
        this.gameEngine.tryMove(0, -1);
      }
    }
  }

  handleClick(ev: MouseEvent): void {
    if (!this.isGameModeActive()) return;
    if (this.gameEngine.isLevelUpOverlayActive?.()) {
      ev.preventDefault();
      this.chooseLevelUpByPointer(ev.clientX, ev.clientY);
    }
  }

  handleLevelUpKey(ev: KeyboardEvent): void {
    const key = ev.key.toLowerCase();
    if (key === '1') {
      this.gameEngine.chooseLevelUpSkill?.(0);
      return;
    }
    if (key === '2') {
      this.gameEngine.chooseLevelUpSkill?.(1);
      return;
    }
    if (key === 'arrowup' || key === 'w') {
      this.gameEngine.moveLevelUpCursor?.(-1);
      this.gameEngine.draw?.();
      return;
    }
    if (key === 'arrowdown' || key === 's') {
      this.gameEngine.moveLevelUpCursor?.(1);
      this.gameEngine.draw?.();
      return;
    }
    if (key === 'enter' || key === ' ' || key === 'z') {
      this.gameEngine.confirmLevelUpSelection?.();
    }
  }

  chooseLevelUpByPointer(clientX: number, clientY: number): void {
    const index = this.gameEngine.pickLevelUpChoiceFromPointer?.(clientX, clientY);
    if (index === null || index === undefined) return;
    this.gameEngine.chooseLevelUpSkill?.(index);
  }

  // Map editor canvas interactions
  setupEditorInputs(editorCanvas: HTMLCanvasElement, paintCallback: (event: MouseEvent) => void): void {
    let painting = false;

    editorCanvas.addEventListener('mousedown', (e) => {
      painting = true;
      paintCallback(e);
    });

    editorCanvas.addEventListener('mousemove', (e) => {
      if (painting) paintCallback(e);
    });

    document.addEventListener('mouseup', () => {
      if (painting) {
        painting = false;
        // Hook to finalize painting (for example, push to history)
      }
    });
  }

  // Tile editor canvas interactions
  setupTileEditorInputs(tileCanvas: HTMLCanvasElement, paintCallback: (event: MouseEvent) => void): void {
    let tilePainting = false;

    tileCanvas.addEventListener('mousedown', (e) => {
      tilePainting = true;
      paintCallback(e);
    });

    tileCanvas.addEventListener('mousemove', (e) => {
      if (tilePainting) paintCallback(e);
    });

    document.addEventListener('mouseup', () => {
      tilePainting = false;
    });
  }
}

export { InputManager };
