import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { soundEngine } from '../SoundEngine';

type DialogMeta = {
  pauseReason?: string;
  setVariableId?: string;
  rewardAllowed?: boolean;
  npcId?: string;
  npcDialogVariantKey?: string;
};

type GameStateApi = {
  pauseGame: (reason: string) => void;
  resumeGame: (reason: string) => void;
  setDialog: (active: boolean, text?: string, meta?: DialogMeta | null) => void;
  getDialog: () => { active: boolean };
  setVariableValue?: (id: string, value: boolean) => [boolean, boolean];
  markNpcDialogAsRead?: (npcId: string, variantKey: string | null) => void;
};

type RendererApi = {
  draw: () => void;
  setIconOverPlayer: (icon: string) => void;
};

class DialogManager {
  gameState: GameStateApi;
  renderer: RendererApi;
  pendingDialogAction: DialogMeta | null;
  /**
   * Optional callback invoked when an NPC reward variable should be set.
   * When present, it is called INSTEAD of setVariableValue so that callers
   * (e.g. online-guest mode) can forward the signal to an authority (the host)
   * without applying the change locally first.
   */
  onNpcReward: ((variableId: string, value: boolean) => void) | null = null;

  constructor(gameState: GameStateApi, renderer: RendererApi) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.pendingDialogAction = null;
  }

  showDialog(text: string, options: DialogMeta = {}): void {
    const hasOptions = Object.keys(options).length > 0;
    const meta = hasOptions ? { ...options } : null;

    soundEngine.play('dialog');
    const reason = meta?.pauseReason || 'dialog';
    if (meta) meta.pauseReason = reason;
    this.gameState.pauseGame(reason);
    if (meta?.npcId && meta.npcDialogVariantKey) {
      this.gameState.markNpcDialogAsRead?.(meta.npcId, meta.npcDialogVariantKey);
    }

    this.pendingDialogAction = meta;
    this.gameState.setDialog(true, text, meta);
  }

  completeDialog(): void {
    const OT = ITEM_TYPES;
    if (this.pendingDialogAction?.setVariableId && this.pendingDialogAction.rewardAllowed !== false) {
      const varId = this.pendingDialogAction.setVariableId;
      if (this.onNpcReward) {
        // In online-guest mode the reward must be forwarded to the host as a
        // signal. The guest must NOT apply the variable locally — the host will
        // apply it and broadcast the authoritative state back via world-state-diff.
        this.onNpcReward(varId, true);
      } else {
        const [, openedDoor] = this.gameState.setVariableValue?.(varId, true) || [];
        if (openedDoor) {
          this.renderer.setIconOverPlayer(OT.DOOR_VARIABLE);
        }
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
