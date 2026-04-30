import { bitmapFont } from './BitmapFont';
import { resolveNpcDialog } from '../../services/engine/resolveNpcDialog';

type NpcState = {
  id?: string;
  text?: string;
  conditionText?: string;
  conditionVariableId?: string | null;
  rewardVariableId?: string | null;
  conditionalRewardVariableId?: string | null;
};

type GameStateApi = {
  normalizeVariableId?: (id: string | null) => string | null;
  isVariableOn?: (id: string) => boolean;
  hasSkill?: (skillId: string) => boolean;
  hasUnreadNpcDialog?: (npcId: string, variantKey: string | null) => boolean;
};

type PaletteManagerApi = {
  getColor: (index: number) => string;
};

const shouldDrawUnreadNpcDialogMarker = (gameState: GameStateApi, npc: NpcState): boolean => {
  if (!npc.id || !gameState.hasUnreadNpcDialog) {
    return false;
  }
  const resolved = resolveNpcDialog(npc, gameState);
  if (!resolved.hasDialog) {
    return false;
  }
  return gameState.hasUnreadNpcDialog(npc.id, resolved.variantKey);
};

const drawUnreadNpcDialogMarker = (
  ctx: CanvasRenderingContext2D,
  paletteManager: PaletteManagerApi,
  px: number,
  py: number,
  tileSize: number,
): void => {
  const iconX = Math.round(px + tileSize * 0.75);
  const iconY = Math.round(py + tileSize * 0.1);
  const iconColor = paletteManager.getColor(9) || '#FFD600';
  bitmapFont.drawText(ctx, '!', iconX, iconY, Math.max(8, Math.round(tileSize * 0.8)), iconColor);
};

export { drawUnreadNpcDialogMarker, shouldDrawUnreadNpcDialogMarker };
