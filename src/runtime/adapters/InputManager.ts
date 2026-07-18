import { GameConfig } from '../../config/GameConfig';
import { DebugFlags } from '../debug/DebugFlags';

type DialogState = {
  active: boolean;
  page: number;
  maxPages: number;
};

type GameStateApi = {
  playing?: boolean;
  getDialog: () => DialogState;
  setDialogPage: (page: number) => void;
};

type RendererApi = {
  draw: () => void;
  isRoomTransitionActive?: () => boolean;
};

type GameEngineApi = {
  isDestroyed?: boolean;
  canvas?: HTMLCanvasElement;
  gameState: GameStateApi;
  renderer: RendererApi;
  tryMove: (dx: number, dy: number) => void;
  closeDialog: () => void;
  advanceDialog: () => void;
  moveDialogChoice?: (direction: number) => void;
  handleDialogPointer?: (clientX: number, clientY: number) => void;
  isEditorModeActive?: () => boolean;
  isGameOver?: () => boolean;
  handleGameOverInteraction?: () => void;
  isIntroVisible?: () => boolean;
  dismissIntroScreen?: () => void;
  isLevelUpCelebrationActive?: () => boolean;
  isLevelUpOverlayActive?: () => boolean;
  isPickupOverlayActive?: () => boolean;
  dismissPickupOverlay?: () => void;
  chooseLevelUpSkill?: (index: number) => void;
  moveLevelUpCursor?: (delta: number) => void;
  draw?: () => void;
  confirmLevelUpSelection?: () => void;
  pickLevelUpChoiceFromPointer?: (x: number, y: number) => number | null | undefined;
};

type DirectionName = 'left' | 'right' | 'up' | 'down';

type HeldDirection = {
  direction: DirectionName;
  order: number;
};

type TouchStart = {
  identifier: number;
  x: number;
  y: number;
  prevented: boolean;
  direction: DirectionName | null;
};

type DPadBinding = {
  button: HTMLButtonElement;
  activePointers: Set<number>;
  pointerDown: (ev: PointerEvent) => void;
  pointerEnd: (ev: PointerEvent) => void;
};

const DIRECTION_DELTAS: Record<DirectionName, readonly [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

const MOVEMENT_KEYS: Record<string, DirectionName | undefined> = {
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
};

const SCROLL_LOCK_DISTANCE = 12;
const MOVEMENT_START_DISTANCE = 24;
const DIRECTION_SWITCH_MARGIN = 8;

/**
 * InputManager owns playable keyboard, D-pad, and touch input.
 */
class InputManager {
  private gameEngine: GameEngineApi;
  private touchStart: TouchStart | null = null;
  private heldDirections = new Map<string, HeldDirection>();
  private pressOrder = 0;
  private lastMovementTime = 0;
  private frameHandle: number | null = null;
  private frameUsesTimeout = false;
  private destroyed = false;
  private dPadBindings: DPadBinding[] = [];

  private readonly keyDownListener = (ev: KeyboardEvent) => {
    if (!this.gameEngine.isDestroyed) this.handleKeyDown(ev);
  };

  private readonly keyUpListener = (ev: KeyboardEvent) => {
    if (!this.gameEngine.isDestroyed) this.handleKeyUp(ev);
  };

  private readonly touchStartListener = (ev: TouchEvent) => {
    if (!this.gameEngine.isDestroyed) this.handleTouchStart(ev);
  };

  private readonly touchMoveListener = (ev: TouchEvent) => {
    if (!this.gameEngine.isDestroyed) this.handleTouchMove(ev);
  };

  private readonly touchEndListener = (ev: TouchEvent) => {
    if (!this.gameEngine.isDestroyed) this.handleTouchEnd(ev);
  };

  private readonly touchCancelListener = (ev: TouchEvent) => {
    if (!this.gameEngine.isDestroyed) this.handleTouchCancel(ev);
  };

  private readonly clickListener = (ev: MouseEvent) => {
    if (!this.gameEngine.isDestroyed) this.handleClick(ev);
  };

  private readonly blurListener = () => this.cancelHeldMovement();

  private readonly visibilityListener = () => {
    if (document.hidden) this.cancelHeldMovement();
  };

  private readonly focusInListener = (ev: FocusEvent) => {
    if (this.isEditableTarget(ev.target)) this.cancelHeldMovement();
  };

  private readonly editorActivatedListener = () => this.cancelHeldMovement();

  constructor(gameEngine: GameEngineApi) {
    this.gameEngine = gameEngine;
    this.setupEventListeners();
    this.setupDPadListeners();
  }

  isGameModeActive(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    return document.body.classList.contains('game-mode');
  }

  setupEventListeners(): void {
    document.addEventListener('keydown', this.keyDownListener);
    document.addEventListener('keyup', this.keyUpListener);
    document.addEventListener('touchstart', this.touchStartListener, { passive: false });
    document.addEventListener('touchmove', this.touchMoveListener, { passive: false });
    document.addEventListener('touchend', this.touchEndListener, { passive: false });
    document.addEventListener('touchcancel', this.touchCancelListener, { passive: false });
    document.addEventListener('click', this.clickListener);
    document.addEventListener('visibilitychange', this.visibilityListener);
    document.addEventListener('focusin', this.focusInListener);
    document.addEventListener('editor-tab-activated', this.editorActivatedListener);
    globalThis.addEventListener('blur', this.blurListener);
  }

  private setupDPadListeners(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      '.game-touch-pad .pad-button[data-direction]',
    );

    buttons.forEach((button) => {
      const activePointers = new Set<number>();
      const pointerDown = (ev: PointerEvent) => {
        if (this.destroyed || this.gameEngine.isDestroyed || ev.button !== 0) return;
        const direction = button.dataset.direction as DirectionName | undefined;
        if (!direction) return;

        ev.preventDefault();
        const pointerId = this.getPointerId(ev);
        activePointers.add(pointerId);
        button.classList.add('is-pressed');
        try {
          const capturePointer = (button as unknown as {
            setPointerCapture?: (id: number) => void;
          }).setPointerCapture;
          capturePointer?.call(button, pointerId);
        } catch {
          // Pointer capture may be unavailable for synthetic or already-ended pointers.
        }

        if (this.gameEngine.gameState.getDialog().active) {
          this.cancelHeldMovement();
          activePointers.add(pointerId);
          button.classList.add('is-pressed');
          this.gameEngine.advanceDialog();
          return;
        }

        this.beginHeldDirection(`pointer:${pointerId}`, direction);
      };
      const pointerEnd = (ev: PointerEvent) => {
        const pointerId = this.getPointerId(ev);
        if (!activePointers.delete(pointerId)) return;
        this.endHeldDirection(`pointer:${pointerId}`);
        if (activePointers.size === 0) button.classList.remove('is-pressed');
      };

      button.addEventListener('pointerdown', pointerDown);
      button.addEventListener('pointerup', pointerEnd);
      button.addEventListener('pointercancel', pointerEnd);
      button.addEventListener('lostpointercapture', pointerEnd);
      this.dPadBindings.push({ button, activePointers, pointerDown, pointerEnd });
    });
  }

  private getPointerId(ev: PointerEvent): number {
    return Number.isFinite(ev.pointerId) ? ev.pointerId : 1;
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  private keyboardSource(ev: KeyboardEvent): string {
    const key = ev.key.toLowerCase();
    return `keyboard:${ev.code || key}`;
  }

  private getEffectiveDirection(): DirectionName | null {
    let effectiveDirection: DirectionName | null = null;
    let effectiveOrder = -1;
    for (const held of this.heldDirections.values()) {
      if (held.order > effectiveOrder) {
        effectiveDirection = held.direction;
        effectiveOrder = held.order;
      }
    }
    return effectiveDirection;
  }

  private canAcceptHeldMovement(): boolean {
    if (this.destroyed || this.gameEngine.isDestroyed) return false;
    if (!this.isGameModeActive() || this.gameEngine.isEditorModeActive?.()) return false;
    if (this.isEditableTarget(document.activeElement)) return false;
    const transitionActive = this.gameEngine.renderer.isRoomTransitionActive?.() ?? false;
    if (this.gameEngine.gameState.playing === false && !transitionActive) return false;
    if (this.gameEngine.isIntroVisible?.() || this.gameEngine.isGameOver?.()) return false;
    if (this.gameEngine.isPickupOverlayActive?.()) return false;
    if (this.gameEngine.isLevelUpCelebrationActive?.()) return false;
    if (this.gameEngine.isLevelUpOverlayActive?.()) return false;
    return !this.gameEngine.gameState.getDialog().active;
  }

  beginHeldDirection(sourceId: string, direction: DirectionName): void {
    if (this.destroyed) return;
    const previousDirection = this.getEffectiveDirection();
    const existing = this.heldDirections.get(sourceId);
    if (existing?.direction === direction) return;

    this.heldDirections.set(sourceId, { direction, order: ++this.pressOrder });
    const nextDirection = this.getEffectiveDirection();
    if (!this.canAcceptHeldMovement()) {
      this.cancelHeldMovement();
      return;
    }

    if (previousDirection !== nextDirection) {
      this.moveEffectiveDirection(this.now());
    }
    if (this.heldDirections.size > 0) this.scheduleFrame();
  }

  endHeldDirection(sourceId: string): void {
    const previousDirection = this.getEffectiveDirection();
    if (!this.heldDirections.delete(sourceId)) return;
    const nextDirection = this.getEffectiveDirection();

    if (!nextDirection) {
      this.stopFrame();
      return;
    }
    if (previousDirection !== nextDirection) {
      if (!this.canAcceptHeldMovement()) {
        this.cancelHeldMovement();
        return;
      }
      this.moveEffectiveDirection(this.now());
    }
    if (this.heldDirections.size > 0) this.scheduleFrame();
  }

  cancelHeldMovement(): void {
    this.heldDirections.clear();
    this.touchStart = null;
    this.stopFrame();
    this.dPadBindings.forEach(({ button, activePointers }) => {
      activePointers.clear();
      button.classList.remove('is-pressed');
    });
  }

  private moveEffectiveDirection(timestamp: number): void {
    const direction = this.getEffectiveDirection();
    if (!direction) return;
    const [dx, dy] = DIRECTION_DELTAS[direction];
    this.gameEngine.tryMove(dx, dy);
    this.lastMovementTime = timestamp;
    if (!this.canAcceptHeldMovement()) this.cancelHeldMovement();
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private scheduleFrame(): void {
    if (this.frameHandle !== null || this.heldDirections.size === 0 || this.destroyed) return;
    if (typeof globalThis.requestAnimationFrame === 'function') {
      this.frameUsesTimeout = false;
      this.frameHandle = globalThis.requestAnimationFrame((timestamp) => this.handleFrame(timestamp));
      return;
    }
    this.frameUsesTimeout = true;
    this.frameHandle = globalThis.setTimeout(
      () => this.handleFrame(this.now()),
      GameConfig.input.heldMoveIntervalMs,
    );
  }

  private handleFrame(timestamp: number): void {
    this.frameHandle = null;
    if (!this.canAcceptHeldMovement()) {
      this.cancelHeldMovement();
      return;
    }
    if (timestamp - this.lastMovementTime >= GameConfig.input.heldMoveIntervalMs) {
      this.moveEffectiveDirection(timestamp);
    }
    if (this.heldDirections.size > 0) this.scheduleFrame();
  }

  private stopFrame(): void {
    if (this.frameHandle === null) return;
    if (this.frameUsesTimeout) {
      globalThis.clearTimeout(this.frameHandle);
    } else if (typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.frameHandle);
    }
    this.frameHandle = null;
  }

  handleKeyDown(ev: KeyboardEvent): void {
    if (this.gameEngine.isEditorModeActive?.()) return;

    if (ev.key.toLowerCase() === 'v' && ev.shiftKey && ev.ctrlKey) {
      ev.preventDefault();
      this.toggleEnemyVisionDebug();
      return;
    }

    if (this.gameEngine.isGameOver?.()) {
      this.cancelHeldMovement();
      ev.preventDefault();
      this.gameEngine.handleGameOverInteraction?.();
      return;
    }
    if (this.gameEngine.isIntroVisible?.()) {
      this.cancelHeldMovement();
      ev.preventDefault();
      this.gameEngine.dismissIntroScreen?.();
      return;
    }
    if (this.gameEngine.isLevelUpOverlayActive?.()) {
      this.cancelHeldMovement();
      ev.preventDefault();
      this.handleLevelUpKey(ev);
      return;
    }
    if (this.gameEngine.isPickupOverlayActive?.()) {
      this.cancelHeldMovement();
      ev.preventDefault();
      this.gameEngine.dismissPickupOverlay?.();
      return;
    }
    const dialog = this.gameEngine.gameState.getDialog();

    if (dialog.active) {
      this.cancelHeldMovement();
      switch (ev.key.toLowerCase()) {
        case 'z':
        case 'enter':
        case ' ':
          ev.preventDefault();
          this.gameEngine.advanceDialog();
          break;
        case 'arrowup':
        case 'w':
        case 'arrowleft':
        case 'a':
          ev.preventDefault();
          this.gameEngine.moveDialogChoice?.(-1);
          break;
        case 'arrowdown':
        case 's':
        case 'arrowright':
        case 'd':
          ev.preventDefault();
          this.gameEngine.moveDialogChoice?.(1);
          break;
      }
      return;
    }

    if (!this.isGameModeActive() || this.isEditableTarget(ev.target)) return;
    const direction = MOVEMENT_KEYS[ev.key.toLowerCase()];
    if (!direction) return;

    ev.preventDefault();
    if (ev.repeat) return;
    this.beginHeldDirection(this.keyboardSource(ev), direction);
  }

  handleKeyUp(ev: KeyboardEvent): void {
    const direction = MOVEMENT_KEYS[ev.key.toLowerCase()];
    if (!direction) return;
    if (this.isGameModeActive()) ev.preventDefault();
    this.endHeldDirection(this.keyboardSource(ev));
  }

  handleTouchStart(ev: TouchEvent): void {
    if (!this.isGameModeActive()) {
      this.cancelHeldMovement();
      return;
    }
    const target = ev.target as HTMLElement | null;
    if (target?.closest('.pad-button[data-direction]')) return;
    if (this.gameEngine.isGameOver?.()) {
      this.cancelHeldMovement();
      ev.preventDefault();
      this.gameEngine.handleGameOverInteraction?.();
      return;
    }
    if (this.gameEngine.isIntroVisible?.()) {
      this.cancelHeldMovement();
      ev.preventDefault();
      this.gameEngine.dismissIntroScreen?.();
      return;
    }
    if (this.gameEngine.isLevelUpOverlayActive?.()) {
      this.cancelHeldMovement();
      ev.preventDefault();
      const touch = ev.changedTouches.item(0);
      if (touch) this.chooseLevelUpByPointer(touch.clientX, touch.clientY);
      return;
    }
    if (this.gameEngine.isPickupOverlayActive?.()) {
      this.cancelHeldMovement();
      ev.preventDefault();
      this.gameEngine.dismissPickupOverlay?.();
      return;
    }
    const dialog = this.gameEngine.gameState.getDialog();
    if (dialog.active) {
      this.cancelHeldMovement();
      ev.preventDefault();
      const dialogTouch = ev.changedTouches.item(0);
      if (dialogTouch && this.gameEngine.handleDialogPointer) {
        this.gameEngine.handleDialogPointer(dialogTouch.clientX, dialogTouch.clientY);
      } else {
        this.gameEngine.advanceDialog();
      }
      return;
    }
    if (this.touchStart || ev.target !== this.gameEngine.canvas) return;

    const touch = ev.changedTouches.item(0);
    if (!touch) return;
    this.touchStart = {
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      prevented: false,
      direction: null,
    };
  }

  handleTouchMove(ev: TouchEvent): void {
    if (!this.isGameModeActive()) {
      this.cancelHeldMovement();
      return;
    }
    const start = this.touchStart;
    if (!start) return;
    const touch = this.findTouch(ev.changedTouches, start.identifier);
    if (!touch) return;
    this.updateTouchGesture(ev, start, touch);
  }

  handleTouchEnd(ev: TouchEvent): void {
    const start = this.touchStart;
    if (!start) return;
    const touch = this.findTouch(ev.changedTouches, start.identifier);
    if (!touch) return;

    this.updateTouchGesture(ev, start, touch);
    if (start.prevented || start.direction) ev.preventDefault();
    this.touchStart = null;
    this.endHeldDirection(`touch:${start.identifier}`);
  }

  handleTouchCancel(ev: TouchEvent): void {
    const start = this.touchStart;
    if (!start || !this.findTouch(ev.changedTouches, start.identifier)) return;
    this.touchStart = null;
    this.endHeldDirection(`touch:${start.identifier}`);
  }

  private findTouch(touches: TouchList, identifier: number): Touch | null {
    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches.item(index);
      if (touch?.identifier === identifier) return touch;
    }
    return null;
  }

  private updateTouchGesture(ev: TouchEvent, start: TouchStart, touch: Touch): void {
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= SCROLL_LOCK_DISTANCE || start.prevented) {
      ev.preventDefault();
      start.prevented = true;
    }
    if (distance < MOVEMENT_START_DISTANCE) return;

    const direction = this.resolveTouchDirection(dx, dy, absX, absY, start.direction);
    if (direction === start.direction) return;
    start.direction = direction;
    this.beginHeldDirection(`touch:${start.identifier}`, direction);
  }

  private resolveTouchDirection(
    dx: number,
    dy: number,
    absX: number,
    absY: number,
    current: DirectionName | null,
  ): DirectionName {
    const currentIsHorizontal = current === 'left' || current === 'right';
    const currentIsVertical = current === 'up' || current === 'down';
    let horizontal = absX > absY;
    if (currentIsHorizontal && absY <= absX + DIRECTION_SWITCH_MARGIN) horizontal = true;
    if (currentIsVertical && absX <= absY + DIRECTION_SWITCH_MARGIN) horizontal = false;
    if (horizontal) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'down' : 'up';
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
      if (painting) painting = false;
    });
  }

  toggleEnemyVisionDebug(): void {
    DebugFlags.toggleEnemyVision();
    this.gameEngine.draw?.();
  }

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

  destroy(): void {
    if (this.destroyed) return;
    this.cancelHeldMovement();
    this.destroyed = true;
    document.removeEventListener('keydown', this.keyDownListener);
    document.removeEventListener('keyup', this.keyUpListener);
    document.removeEventListener('touchstart', this.touchStartListener);
    document.removeEventListener('touchmove', this.touchMoveListener);
    document.removeEventListener('touchend', this.touchEndListener);
    document.removeEventListener('touchcancel', this.touchCancelListener);
    document.removeEventListener('click', this.clickListener);
    document.removeEventListener('visibilitychange', this.visibilityListener);
    document.removeEventListener('focusin', this.focusInListener);
    document.removeEventListener('editor-tab-activated', this.editorActivatedListener);
    globalThis.removeEventListener('blur', this.blurListener);
    this.dPadBindings.forEach(({ button, pointerDown, pointerEnd }) => {
      button.removeEventListener('pointerdown', pointerDown);
      button.removeEventListener('pointerup', pointerEnd);
      button.removeEventListener('pointercancel', pointerEnd);
      button.removeEventListener('lostpointercapture', pointerEnd);
    });
    this.dPadBindings = [];
  }
}

export { InputManager };
