import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { soundEngine } from '../SoundEngine';
import type { DialogChoiceOption, DialogChoicePhase, DialogChoiceState } from '../../../types/gameState';

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
  getDialog: () => { active: boolean; choice?: DialogChoiceState | null };
  setVariableValue?: (id: string, value: boolean) => [boolean, boolean];
  markNpcDialogAsRead?: (npcId: string, variantKey: string | null) => void;
  setDialogChoice?: (choice: DialogChoiceState | null) => void;
  setChoicePhase?: (phase: DialogChoicePhase) => void;
  setChoiceSelection?: (index: number) => void;
  markNpcChoiceAnswered?: (npcId: string | null | undefined) => void;
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
  /**
   * Optional dialog to open right after the current one fully closes. Used to
   * chain the NPC's default dialog into its Yes/No choice question.
   */
  private pendingNext: (() => void) | null = null;

  constructor(gameState: GameStateApi, renderer: RendererApi) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.pendingDialogAction = null;
  }

  /** Queues a dialog to open immediately after the current one closes. */
  setNextDialog(open: (() => void) | null): void {
    this.pendingNext = open;
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

  /**
   * Opens a choice dialog: the prompt is shown first; once revealed and on its
   * last page, the Yes/No options become selectable (handled by GameEngine).
   * The branch reward is applied only when the player closes the branch message,
   * reusing completeDialog() (so online-guest forwarding via onNpcReward still works).
   */
  showChoiceDialog(prompt: string, options: DialogChoiceOption[], meta: DialogMeta = {}): void {
    const metaCopy: DialogMeta = { ...meta };
    soundEngine.play('dialog');
    const reason = metaCopy.pauseReason || 'dialog';
    metaCopy.pauseReason = reason;
    this.gameState.pauseGame(reason);
    if (metaCopy.npcId && metaCopy.npcDialogVariantKey) {
      this.gameState.markNpcDialogAsRead?.(metaCopy.npcId, metaCopy.npcDialogVariantKey);
    }

    this.pendingDialogAction = metaCopy;
    this.gameState.setDialog(true, prompt, metaCopy);
    this.gameState.setDialogChoice?.({ phase: 'prompt', selectedIndex: 0, options });
  }

  /**
   * Confirms the currently highlighted Yes/No option: stores the branch reward as
   * the pending action and switches to the branch message (or closes immediately
   * when the branch has no message).
   */
  confirmChoiceSelection(): void {
    const dialog = this.gameState.getDialog();
    const choice = dialog.choice;
    if (!choice) return;
    const option = choice.options.at(choice.selectedIndex);
    if (!option) return;

    const meta: DialogMeta = this.pendingDialogAction ?? {};
    // Lock the choice for the rest of the playthrough (definitive choice).
    this.gameState.markNpcChoiceAnswered?.(meta.npcId);
    if (option.rewardVariableId) {
      meta.setVariableId = option.rewardVariableId;
      meta.rewardAllowed = true;
    } else {
      delete meta.setVariableId;
    }
    this.pendingDialogAction = meta;

    const branchText = typeof option.text === 'string' ? option.text : '';
    if (branchText.trim().length > 0) {
      this.gameState.setDialog(true, branchText, meta);
      this.gameState.setChoicePhase?.('branch');
    } else {
      this.closeDialog();
    }
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

    // Chain into a follow-up dialog (e.g. the Yes/No question after the default
    // dialog). Captured and cleared first so the follow-up can queue its own.
    const next = this.pendingNext;
    this.pendingNext = null;
    if (next) {
      next();
      this.renderer.draw();
    }
  }

  reset(): void {
    const pendingMeta = this.pendingDialogAction;
    this.pendingDialogAction = null;
    this.pendingNext = null;

    const reason = pendingMeta?.pauseReason || 'dialog';
    this.gameState.resumeGame(reason);
  }
}

export type { DialogMeta };
export { DialogManager };
