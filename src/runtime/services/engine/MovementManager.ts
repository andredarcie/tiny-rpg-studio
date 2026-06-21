import { TextResources } from '../../adapters/TextResources';
import { GameConfig } from '../../../config/GameConfig';
import { soundEngine } from '../SoundEngine';

type PlayerState = {
  roomIndex: number;
  x: number;
  y: number;
  lastX?: number;
  lastRoomChangeTime?: number | null;
};

type GameStateApi = {
  playing: boolean;
  game: { roomSize: number };
  isGameOver: () => boolean;
  isLevelUpCelebrationActive?: () => boolean;
  isLevelUpOverlayActive?: () => boolean;
  isPickupOverlayActive?: () => boolean;
  getDialog: () => { active: boolean; page: number; maxPages: number };
  setDialogPage: (page: number) => void;
  getPlayer: () => PlayerState | null;
  getRoomCoords: (roomIndex: number) => { row: number; col: number };
  getRoomIndex: (row: number, col: number) => number | null;
  getGame: () => { sprites?: NpcState[] };
  getObjectAt: (roomIndex: number, x: number, y: number) => GameObjectState | null;
  setPlayerPosition: (x: number, y: number, roomIndex: number | null) => void;
  consumeKey: () => boolean;
  getKeys: () => number;
  isVariableOn: (id: string) => boolean;
  hasSkill?: (skillId: string) => boolean;
  isInCombat?: () => boolean;
  resetPushBoxesForRoom?: (roomIndex: number) => void;
};

type TileManagerApi = {
  getTileMap: (roomIndex: number) => TileMapState | null;
  getTile: (tileId: string | number) => TileDefinition | null;
};

type RendererApi = {
  draw: () => void;
  captureGameplayFrame: () => unknown;
  startRoomTransition: (payload: Record<string, unknown>) => boolean;
  flashEdge: (direction: string, payload: Record<string, unknown>) => void;
  showCombatIndicator?: (text: string, options?: { duration?: number }) => void;
};

type DialogManagerApi = {
  closeDialog: () => void;
  showDialog: (text: string, meta?: Record<string, unknown>) => void;
};

type InteractionManagerApi = {
  handlePlayerInteractions: () => void;
  getNpcDialogText?: (npc: NpcState) => string;
  getNpcDialogMeta?: (npc: NpcState) => Record<string, unknown> | undefined;
  openNpcDialog?: (npc: NpcState) => boolean;
};

type EnemyManagerApi = {
  collideAt: (roomIndex: number, x: number, y: number) => boolean;
  checkCollisionAt: (x: number, y: number) => void;
  evaluateVision?: (player: PlayerState | null) => void;
  moveChasingEnemies?: (player: PlayerState | null) => void;
  hasEnemyNear?: (roomIndex: number, x: number, y: number) => boolean;
};

type CombatStunManagerApi = {
  isStunned: () => boolean;
};

type MovementManagerOptions = {
  onObjectOpened?: (objectId: string, roomIndex: number) => void;
};

type NpcState = {
  placed?: boolean;
  roomIndex: number;
  x: number;
  y: number;
  text?: string;
};

type RoomState = {
  walls?: boolean[][];
};

type GameObjectState = {
  type?: string;
  roomIndex?: number;
  x?: number;
  y?: number;
  isVariableDoor?: boolean;
  variableId?: string | null;
  isLockedDoor?: boolean;
  opened?: boolean;
};

type TileDefinition = {
  collision?: boolean;
  category?: string;
  name?: string;
};

type TileMapState = {
  ground?: (string | number | null)[][];
  overlay?: (string | number | null)[][];
};

const getMovementText = (key: string, fallback = ''): string => {
  const value = TextResources.get(key, fallback) as string;
  return value || fallback || '';
};

const formatMovementText = (
  key: string,
  params: Record<string, string | number | boolean> = {},
  fallback = '',
): string => {
  const value = TextResources.format(key, params, fallback) as string;
  return value || fallback || '';
};

class MovementManager {
  gameState: GameStateApi;
  tileManager: TileManagerApi;
  renderer: RendererApi;
  dialogManager: DialogManagerApi;
  interactionManager: InteractionManagerApi;
  enemyManager: EnemyManagerApi;
  combatStunManager: CombatStunManagerApi | null;
  options: MovementManagerOptions;
  transitioning: boolean;
  // When true (online guest), push-boxes are host-authoritative: the guest never
  // moves or resets them locally. It only sends a move signal; the host validates,
  // moves the box, and broadcasts the result back (applied via OnlineStateSync).
  guestMode = false;

  constructor({
    gameState,
    tileManager,
    renderer,
    dialogManager,
    interactionManager,
    enemyManager,
    combatStunManager,
    options,
  }: {
    gameState: GameStateApi;
    tileManager: TileManagerApi;
    renderer: RendererApi;
    dialogManager: DialogManagerApi;
    interactionManager: InteractionManagerApi;
    enemyManager: EnemyManagerApi;
    combatStunManager?: CombatStunManagerApi | null;
    options?: MovementManagerOptions;
  }) {
    this.gameState = gameState;
    this.tileManager = tileManager;
    this.renderer = renderer;
    this.dialogManager = dialogManager;
    this.interactionManager = interactionManager;
    this.enemyManager = enemyManager;
    this.combatStunManager = combatStunManager ?? null;
    this.options = options ?? {};
    this.transitioning = false;
  }

  tryMove(dx: number, dy: number): void {
    // Check if game is paused (e.g., during player death sequence)
    if (!this.gameState.playing) {
      return;
    }
    if (this.transitioning) {
      return;
    }
    if (this.gameState.isGameOver()) {
      return;
    }
    if (this.gameState.isLevelUpCelebrationActive?.()) {
      return;
    }
    if (this.gameState.isLevelUpOverlayActive?.()) {
      return;
    }
    if (this.gameState.isPickupOverlayActive?.()) {
      return;
    }
    // Check if player is stunned from combat
    if (this.combatStunManager?.isStunned()) {
      // Show stunned indicator (optional - can be silent)
      // Player cannot move while stunned
      return;
    }
    const dialog = this.gameState.getDialog() as {
      active: boolean;
      page: number;
      maxPages: number;
    };
    if (dialog.active) {
      if (dialog.page >= dialog.maxPages) {
        this.dialogManager.closeDialog();
        return;
      }
      this.gameState.setDialogPage(dialog.page + 1);
      this.renderer.draw();
      return;
    }

    const player = this.gameState.getPlayer();
    if (!player) {
      return;
    }
    const direction = this.getDirectionFromDelta(dx, dy);
    const roomIndex = player.roomIndex;
    const previousPosition = {
      x: player.x,
      y: player.y,
      roomIndex,
      lastX: player.lastX ?? player.x,
      facingLeft: player.x < (player.lastX ?? player.x),
    };
    const currentCoords = this.gameState.getRoomCoords(roomIndex);
    const limit = this.gameState.game.roomSize - 1;

    let targetRoomIndex = roomIndex;
    let targetX = player.x + dx;
    let targetY = player.y + dy;

    if (targetX < 0) {
      const nextCol = currentCoords.col - 1;
      const neighbor = this.gameState.getRoomIndex(currentCoords.row, nextCol);
      if (neighbor !== null) {
        targetRoomIndex = neighbor;
        targetX = limit;
      } else {
        targetX = 0;
      }
    } else if (targetX > limit) {
      const nextCol = currentCoords.col + 1;
      const neighbor = this.gameState.getRoomIndex(currentCoords.row, nextCol);
      if (neighbor !== null) {
        targetRoomIndex = neighbor;
        targetX = 0;
      } else {
        targetX = limit;
      }
    }

    if (targetY < 0) {
      const nextRow = currentCoords.row - 1;
      const neighbor = this.gameState.getRoomIndex(nextRow, currentCoords.col);
      if (neighbor !== null) {
        targetRoomIndex = neighbor;
        targetY = limit;
      } else {
        targetY = 0;
      }
    } else if (targetY > limit) {
      const nextRow = currentCoords.row + 1;
      const neighbor = this.gameState.getRoomIndex(nextRow, currentCoords.col);
      if (neighbor !== null) {
        targetRoomIndex = neighbor;
        targetY = 0;
      } else {
        targetY = limit;
      }
    }

    const enteringNewRoom = targetRoomIndex !== roomIndex;

    const game = this.gameState.getGame() as { rooms?: RoomState[] };
    const targetRoom = game.rooms?.[targetRoomIndex] as RoomState | undefined;
    if (!targetRoom) {
      if (enteringNewRoom) {
        this.flashBlockedEdge(direction, { x: targetX, y: targetY });
      }
      return;
    }

    if (targetRoom.walls?.[targetY]?.[targetX]) {
      if (enteringNewRoom) {
        this.flashBlockedEdge(direction, { x: targetX, y: targetY });
      }
      return;
    }

    const objectAtTarget = (this.gameState.getObjectAt(targetRoomIndex, targetX, targetY) as GameObjectState | null) ?? null;
    const isVariableDoor = Boolean(objectAtTarget?.isVariableDoor);
    if (isVariableDoor) {
      const variableId = objectAtTarget?.variableId;
      const doorOpen = variableId ? this.gameState.isVariableOn(variableId) : false;
      if (!doorOpen) {
        this.dialogManager.showDialog(getMovementText('doors.variableLocked'));
        this.renderer.draw();
        return;
      }
    }
    const isLockedDoor = Boolean(objectAtTarget?.isLockedDoor);
    if (isLockedDoor && !objectAtTarget?.opened) {
      const hasSkill = this.gameState.hasSkill?.('keyless-doors');
      let openedWithSkill = false;
      let consumeKey = false;
      if (hasSkill) {
        openedWithSkill = true;
      } else {
        consumeKey = this.gameState.consumeKey();
      }
      if (openedWithSkill || consumeKey) {
        if (objectAtTarget) {
          objectAtTarget.opened = true;
          const objectId = (objectAtTarget as { id?: string }).id ?? `obj-${targetRoomIndex}-${targetX}-${targetY}`;
          this.options.onObjectOpened?.(objectId, targetRoomIndex);
        }
        soundEngine.play('doorUnlock');
        const remainingKeys = Number(this.gameState.getKeys());
        const message = openedWithSkill
          ? getMovementText('doors.unlockedSkill', getMovementText('doors.opened', ''))
          : Number.isFinite(remainingKeys)
            ? formatMovementText('doors.openedRemaining', { value: remainingKeys })
            : getMovementText('doors.opened');
        if (message) {
          this.dialogManager.showDialog(message);
        }
      } else {
        this.dialogManager.showDialog(getMovementText('doors.locked'));
        this.renderer.draw();
        return;
      }
    }

    const tileMap = this.tileManager.getTileMap(targetRoomIndex);
    const overlayId = tileMap?.overlay?.[targetY]?.[targetX] ?? null;
    const groundId = tileMap?.ground?.[targetY]?.[targetX] ?? null;
    const candidateId = overlayId ?? groundId;
    if (candidateId !== null) {
      const tile = this.tileManager.getTile(candidateId);
      if (tile?.collision && !this.canTraverseCollisionTile(tile)) {
        if (enteringNewRoom) {
          this.flashBlockedEdge(direction, { x: targetX, y: targetY });
        }
        return;
      }
    }

    if (objectAtTarget?.type === 'push-box') {
      // Guest predicts the push locally (client-side prediction) so it moves
      // together with the box; the host independently validates the same move and
      // broadcasts the authoritative box position, reconciling any divergence.
      const boxNewX = targetX + dx;
      const boxNewY = targetY + dy;
      if (!this.canPushBoxTo(targetRoomIndex, boxNewX, boxNewY, targetRoom)) {
        return;
      }
      objectAtTarget.x = boxNewX;
      objectAtTarget.y = boxNewY;
    }

    // Prevent passing through NPCs: trigger dialog and stay in place.
    const npcAtTarget = this.findNpcAt(targetRoomIndex, targetX, targetY);
    if (npcAtTarget) {
      if (!this.gameState.isInCombat?.()) {
        let shown = false;
        if (this.interactionManager.openNpcDialog) {
          // Preferred path: dispatches the default dialog then the Yes/No question.
          shown = this.interactionManager.openNpcDialog(npcAtTarget);
        } else {
          const dialogText = this.interactionManager.getNpcDialogText
            ? this.interactionManager.getNpcDialogText(npcAtTarget)
            : npcAtTarget.text || '';
          const dialogMeta = this.interactionManager.getNpcDialogMeta
            ? this.interactionManager.getNpcDialogMeta(npcAtTarget)
            : undefined;
          if (dialogText) {
            this.dialogManager.showDialog(dialogText, dialogMeta);
            shown = true;
          }
        }
        if (shown) {
          this.renderer.draw();
        }
      }
      return;
    }

    // Prevent passing through enemies: resolve collision/combat without moving.
    if (!enteringNewRoom) {
      const enemyHit = this.enemyManager.collideAt(targetRoomIndex, targetX, targetY) || false;
      if (enemyHit) {
        this.renderer.draw();
        return;
      }
    }

    const supportsTransition = enteringNewRoom;
    const fromFrame = supportsTransition ? this.renderer.captureGameplayFrame() : null;

    // Push-box reset on room exit is host-authoritative. The guest must not reset
    // locally — the host detects the guest leaving and broadcasts the reset.
    if (enteringNewRoom && !this.guestMode) {
      this.gameState.resetPushBoxesForRoom?.(roomIndex);
    }

    this.gameState.setPlayerPosition(targetX, targetY, targetRoomIndex !== roomIndex ? targetRoomIndex : null);
    if (enteringNewRoom) {
      soundEngine.play('roomTransition');
      const updatedPlayer = this.gameState.getPlayer();
      if (updatedPlayer) {
        if (dx !== 0) {
          updatedPlayer.lastX = updatedPlayer.x - Math.sign(dx);
        } else {
          updatedPlayer.lastX = previousPosition.lastX;
        }
        updatedPlayer.lastRoomChangeTime = Date.now();
      }
    }
    this.interactionManager.handlePlayerInteractions();
    const currentPlayer = this.gameState.getPlayer();
    if (currentPlayer) {
      this.enemyManager.checkCollisionAt(currentPlayer.x, currentPlayer.y);
      this.enemyManager.evaluateVision?.(currentPlayer);
    }

    if (supportsTransition && fromFrame) {
      this.renderer.draw();
      const toFrame = this.renderer.captureGameplayFrame();
      if (toFrame) {
        const started = this.renderer.startRoomTransition({
          direction,
          fromFrame,
          toFrame,
          playerPath: {
            from: previousPosition,
            to: { x: targetX, y: targetY, roomIndex: targetRoomIndex },
            facingLeft: dx < 0 ? true : dx > 0 ? false : previousPosition.facingLeft,
          },
          onComplete: () => {
            this.transitioning = false;
            this.renderer.draw();
          },
        });
        if (started) {
          this.transitioning = true;
          return;
        }
      }
    }

    this.renderer.draw();
  }

  getDirectionFromDelta(dx: number, dy: number): string {
    if (dx < 0) return 'left';
    if (dx > 0) return 'right';
    if (dy < 0) return 'up';
    if (dy > 0) return 'down';
    return '';
  }

  canTraverseCollisionTile(tile: { collision?: boolean; category?: string; name?: string } | null = null): boolean {
    if (!tile?.collision) return true;
    const normalize = (value = '') =>
      value
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const category = normalize(tile.category || '');
    const name = normalize(tile.name || '');
    const isWater = category === 'agua' || name.includes('agua');
    const isLava = category === 'perigo' || name.includes('lava');
    if (isWater && this.gameState.hasSkill?.('water-walker')) {
      return true;
    }
    if (isLava && this.gameState.hasSkill?.('lava-walker')) {
      return true;
    }
    return false;
  }

  flashBlockedEdge(direction: string, coords: { x?: number; y?: number } | null = null): void {
    if (!direction) return;
    this.renderer.flashEdge(direction, {
      duration: GameConfig.transitions.blockedMovementDuration,
      tileX: coords?.x,
      tileY: coords?.y,
    });
    this.renderer.draw();
  }

  tryPushBoxForGuest(guestX: number, guestY: number, roomIndex: number, dx: number, dy: number): void {
    const targetX = guestX + dx;
    const targetY = guestY + dy;
    const obj = this.gameState.getObjectAt(roomIndex, targetX, targetY) as { type?: string; x?: number; y?: number } | null;
    if (obj?.type !== 'push-box') return;
    const boxNewX = targetX + dx;
    const boxNewY = targetY + dy;
    const room = ((this.gameState.getGame() as { rooms?: RoomState[] }).rooms ?? [])[roomIndex];
    if (!this.canPushBoxTo(roomIndex, boxNewX, boxNewY, room)) return;
    obj.x = boxNewX;
    obj.y = boxNewY;
  }

  canPushBoxTo(roomIndex: number, x: number, y: number, room: RoomState | undefined): boolean {
    const limit = this.gameState.game.roomSize - 1;
    if (x < 0 || x > limit || y < 0 || y > limit) return false;
    if (room?.walls?.[y]?.[x]) return false;
    const objectThere = this.gameState.getObjectAt(roomIndex, x, y);
    if (objectThere) {
      const t = objectThere.type;
      if (t === 'push-box' || objectThere.isLockedDoor || objectThere.isVariableDoor) return false;
    }
    const tileMap = this.tileManager.getTileMap(roomIndex);
    const overlayId = tileMap?.overlay?.[y]?.[x] ?? null;
    const groundId = tileMap?.ground?.[y]?.[x] ?? null;
    const candidateId = overlayId ?? groundId;
    if (candidateId !== null) {
      const tile = this.tileManager.getTile(candidateId);
      if (tile?.collision && !this.canTraverseCollisionTile(tile)) return false;
    }
    return true;
  }

  findNpcAt(roomIndex: number, x: number, y: number): NpcState | null {
    const sprites = (this.gameState.getGame().sprites || []) as NpcState[];
    return (
      sprites.find((npc) => npc.placed && npc.roomIndex === roomIndex && npc.x === x && npc.y === y) ||
      null
    );
  }
}

export { MovementManager };
