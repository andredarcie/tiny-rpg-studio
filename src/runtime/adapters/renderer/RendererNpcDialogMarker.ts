import { bitmapFont } from './BitmapFont';
import { resolveNpcDialog } from '../../services/engine/resolveNpcDialog';

type NpcState = {
  id?: string;
  text?: string;
  conditionText?: string;
  conditionVariableId?: string | null;
  rewardVariableId?: string | null;
  conditionalRewardVariableId?: string | null;
  choiceEnabled?: boolean;
  choicePrompt?: string;
  choiceYesText?: string;
  choiceNoText?: string;
  choiceYesVariableId?: string | null;
  choiceNoVariableId?: string | null;
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

type PixelMatrix = (number | null)[][];

const LockMarkerMatrix: PixelMatrix = [
  [ null,  6,  6, null, null, null, null, null ],
        [  6, null, null,  6, null, null, null, null ],
        [  6,  6,  6,  6, null, null, null, null ],
        [  6,  6,  0,  6, null, null, null, null ],
        [  6,  6,  6,  6, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ]
];

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

const drawExclamationMarker = (
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

const drawLockMarker = (
  ctx: CanvasRenderingContext2D,
  paletteManager: PaletteManagerApi,
  px: number,
  py: number,
  tileSize: number,
): void => {
  const pixel = Math.max(1, Math.round(tileSize / 8));
  const iconX = Math.round(px + tileSize * 0.75);
  const iconY = Math.round(py + tileSize * 0.1);
  const colors = new Map<number, string>();

  LockMarkerMatrix.forEach((row, y) => {
    row.forEach((colorIndex, x) => {
      if (colorIndex === null) return;
      const color = colors.get(colorIndex) ?? (paletteManager.getColor(colorIndex) || '#C2C3C7');
      colors.set(colorIndex, color);
      ctx.fillStyle = color;
      ctx.fillRect(iconX + x * pixel, iconY + y * pixel, pixel, pixel);
    });
  });
};

export { LockMarkerMatrix, drawExclamationMarker, drawLockMarker, shouldDrawUnreadNpcDialogMarker };
