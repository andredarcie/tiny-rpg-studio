import { ITEM_TYPES } from '../../domain/constants/itemTypes';

type DialogMeta = {
  pauseReason?: string;
  setVariableId?: string;
  rewardAllowed?: boolean;
};

type GameStateApi = {
  pauseGame: (reason: string) => void;
  resumeGame: (reason: string) => void;
  setDialog: (active: boolean, text?: string, meta?: DialogMeta | null) => void;
  getDialog: () => { active: boolean };
  setVariableValue?: (id: string, value: boolean) => [boolean, boolean];
};

type RendererApi = {
  draw: () => void;
  setIconOverPlayer: (icon: string) => void;
};

class DialogManager {
  gameState: GameStateApi;
  renderer: RendererApi;
  pendingDialogAction: DialogMeta | null;

  constructor(gameState: GameStateApi, renderer: RendererApi) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.pendingDialogAction = null;
  }

  showDialog(text: string, options: DialogMeta = {}): void {
    const hasOptions = Object.keys(options).length > 0;
    const meta = hasOptions ? { ...options } : null;

    const reason = meta?.pauseReason || 'dialog';
    if (meta) meta.pauseReason = reason;
    this.gameState.pauseGame(reason);

    this.pendingDialogAction = meta;
    this.gameState.setDialog(true, text, meta);
  }

  completeDialog(): void {
    const OT = ITEM_TYPES;
    if (this.pendingDialogAction?.setVariableId && this.pendingDialogAction.rewardAllowed !== false) {
      const [, openedDoor] = this.gameState.setVariableValue?.(this.pendingDialogAction.setVariableId, true) || [];
      if (openedDoor) {
        this.renderer.setIconOverPlayer(OT.DOOR_VARIABLE);
      }
    }
    this.pendingDialogAction = null;
  }

  closeDialog(): void {
    if (!this.gameState.getDialog().active) return;
    const pendingMeta = this.pendingDialogAction;
    this.completeDialog();
    this.gameState.setDialog(false);

    const reason = pendingMeta?.pauseReason || 'dialog';
    this.gameState.resumeGame(reason);

    this.renderer.draw();
  }

  reset(): void {
    const pendingMeta = this.pendingDialogAction;
    this.pendingDialogAction = null;

    const reason = pendingMeta?.pauseReason || 'dialog';
    this.gameState.resumeGame(reason);
  }
}

export type { DialogMeta };
export { DialogManager };
