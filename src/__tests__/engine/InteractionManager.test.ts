import { beforeEach, describe, expect, it, vi } from 'vitest';
import { itemCatalog } from '../../runtime/domain/services/ItemCatalog';
import { InteractionManager } from '../../runtime/services/engine/InteractionManager';
import { TextResources } from '../../runtime/adapters/TextResources';
import type { ItemType } from '../../runtime/domain/constants/itemTypes';
import { GameState } from '../../runtime/domain/GameState';
import { createInteractionGameState } from '../helpers/createInteractionGameState';

describe('InteractionManager', () => {
  const getDefinitionSpy = vi.spyOn(itemCatalog, 'getItemDefinition');
  const getDurabilitySpy = vi.spyOn(itemCatalog, 'getSwordDurability');
  const getSpy = vi.spyOn(TextResources, 'get');
  const formatSpy = vi.spyOn(TextResources, 'format');
  const dialogManager = { showDialog: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    getDefinitionSpy.mockImplementation((...args: unknown[]) => {
      const type = args[0] as ItemType;
      const behavior: { order: number; tags: string[]; swordDurability?: number } = { order: 0, tags: [] };
      return {
        type,
        id: `${type}-id`,
        name: `Name:${type}`,
        nameKey: `objects.${type}`,
        behavior,
        sprite: [],
        getTags: () => behavior.tags,
        hasTag: (tag: string) => behavior.tags.includes(tag),
        getOrder: (fallbackOrder: number) => behavior.order || fallbackOrder,
        getSwordDurability: () => behavior.swordDurability ?? null,
      } as never;
    });
    getDurabilitySpy.mockImplementation(() => 2);
    getSpy.mockImplementation((...args: unknown[]) => {
      const fallback = args[1] as string | undefined;
      return fallback || 'fallback';
    });
    formatSpy.mockImplementation((...args: unknown[]) => {
      const fallback = args[2] as string | undefined;
      return fallback || 'formatted';
    });
  });

  it('collects keys and triggers pickup overlay', () => {
    const gameState = createInteractionGameState();
    const manager = new InteractionManager(gameState, dialogManager);
    const key: { type: string; collected: boolean; roomIndex: number; x: number; y: number } = { type: 'key', collected: false, roomIndex: 0, x: 0, y: 0 };

    const handled = manager.handleCollectibleObject(key as never);
    expect(handled).toBe(true);
    expect(key.collected).toBe(true);
    expect(gameState.showPickupOverlay).toHaveBeenCalled();

    const mockFn = gameState.showPickupOverlay as ReturnType<typeof vi.fn>;
    const effect = (mockFn.mock.calls[0][0] as { effect?: () => void }).effect;
    effect?.();
    expect(gameState.addKeys).toHaveBeenCalledWith(1);
  });

  it('toggles switches without showing dialog', () => {
    const gameState = createInteractionGameState();
    const manager = new InteractionManager(gameState, dialogManager);
    const object: { type: string; on: boolean; variableId: string; roomIndex: number; x: number; y: number } = { type: 'switch', on: false, variableId: 'var-1', roomIndex: 0, x: 0, y: 0 };

    const handled = manager.handleSwitch(object as never);

    expect(handled).toBe(true);
    expect(object.on).toBe(true);
    expect(gameState.setVariableValue).toHaveBeenCalledWith('var-1', true);
    expect(dialogManager.showDialog).not.toHaveBeenCalled();
  });

  it('uses conditional NPC dialog when variable is active', () => {
    const gameState = createInteractionGameState();
    (gameState.isVariableOn as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const manager = new InteractionManager(gameState, dialogManager);

    const text = manager.getNpcDialogText({
      conditionVariableId: 'var-1',
      conditionText: 'Conditional',
      text: 'Default',
      roomIndex: 0,
      x: 0,
      y: 0,
    });

    expect(text).toBe('Conditional');
  });

  it('passes npc dialog variant metadata when opening dialog', () => {
    const gameState = createInteractionGameState();
    (gameState.getPlayer as ReturnType<typeof vi.fn>).mockReturnValue({ roomIndex: 0, x: 2, y: 3 });
    (gameState.getGame as ReturnType<typeof vi.fn>).mockReturnValue({
      items: [],
      exits: [],
      rooms: [],
      sprites: [{ id: 'npc-1', placed: true, roomIndex: 0, x: 2, y: 3, text: 'Fala comigo!' }],
    });
    const manager = new InteractionManager(gameState, dialogManager);

    manager.handlePlayerInteractions();

    expect(dialogManager.showDialog).toHaveBeenCalledWith('Fala comigo!', {
      npcId: 'npc-1',
      npcDialogVariantKey: 'default:Fala comigo!',
    });
  });

  it('uses bard condition as the effective unread dialog variant', () => {
    const gameState = createInteractionGameState();
    (gameState.hasSkill as ReturnType<typeof vi.fn>).mockImplementation((skillId: string) => skillId === 'charisma');
    const manager = new InteractionManager(gameState, dialogManager);

    const text = manager.getNpcDialogText({
      id: 'bard-npc',
      conditionVariableId: 'skill:bard',
      conditionText: 'Segredo do bardo',
      text: 'Ola',
      roomIndex: 0,
      x: 0,
      y: 0,
    } as never);

    const meta = manager.getNpcDialogMeta({
      id: 'bard-npc',
      conditionVariableId: 'skill:bard',
      conditionText: 'Segredo do bardo',
      text: 'Ola',
      roomIndex: 0,
      x: 0,
      y: 0,
    } as never);

    expect(text).toBe('Segredo do bardo');
    expect(meta).toEqual({
      npcId: 'bard-npc',
      npcDialogVariantKey: 'conditional:skill:bard:Segredo do bardo',
    });
  });

  it('does not open npc dialog when the effective dialog is empty', () => {
    const gameState = createInteractionGameState();
    (gameState.getPlayer as ReturnType<typeof vi.fn>).mockReturnValue({ roomIndex: 0, x: 2, y: 3 });
    (gameState.getGame as ReturnType<typeof vi.fn>).mockReturnValue({
      items: [],
      exits: [],
      rooms: [],
      sprites: [{ id: 'npc-empty', placed: true, roomIndex: 0, x: 2, y: 3, text: '   ' }],
    });
    const manager = new InteractionManager(gameState, dialogManager);

    manager.handlePlayerInteractions();

    expect(dialogManager.showDialog).not.toHaveBeenCalled();
  });

  it('keeps dialog flow stable for npc without a valid id', () => {
    const gameState = createInteractionGameState();
    (gameState.getPlayer as ReturnType<typeof vi.fn>).mockReturnValue({ roomIndex: 0, x: 2, y: 3 });
    (gameState.getGame as ReturnType<typeof vi.fn>).mockReturnValue({
      items: [],
      exits: [],
      rooms: [],
      sprites: [{ placed: true, roomIndex: 0, x: 2, y: 3, text: 'Sem id' }],
    });
    const manager = new InteractionManager(gameState, dialogManager);

    manager.handlePlayerInteractions();

    expect(dialogManager.showDialog).toHaveBeenCalledWith('Sem id', {
      npcDialogVariantKey: 'default:Sem id',
    });
  });

  it('does not show NPC dialog when combat is active', () => {
    const gameState = createInteractionGameState();
    (gameState.isInCombat as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (gameState.getPlayer as ReturnType<typeof vi.fn>).mockReturnValue({ roomIndex: 0, x: 2, y: 3 });
    (gameState.getGame as ReturnType<typeof vi.fn>).mockReturnValue({
      items: [],
      exits: [],
      rooms: [],
      sprites: [{ placed: true, roomIndex: 0, x: 2, y: 3, text: 'Fala comigo!' }],
    });
    const manager = new InteractionManager(gameState, dialogManager);

    manager.handlePlayerInteractions();

    expect(dialogManager.showDialog).not.toHaveBeenCalled();
  });

  it('moves player through room exits', () => {
    const gameState = createInteractionGameState();
    (gameState.getRoomIndex as ReturnType<typeof vi.fn>).mockReturnValue(0);
    const manager = new InteractionManager(gameState, dialogManager);
    const player = { roomIndex: 0, x: 1, y: 1 };
    const exits = [{ roomIndex: 0, x: 1, y: 1, targetRoomIndex: 0, targetX: 2, targetY: 3 }];
    const rooms = [{}];

    manager.checkRoomExits(exits, rooms, player);

    expect(gameState.setPlayerPosition).toHaveBeenCalledWith(2, 3, 0);
  });

  // --- Armor ---
  it('armor pickup sets armorEquipped via overlay effect', () => {
    const gameState = createInteractionGameState();
    const manager = new InteractionManager(gameState, dialogManager);
    const object = { type: 'armor', collected: false, roomIndex: 0, x: 0, y: 0 };

    const handled = manager.handleCollectibleObject(object as never);
    expect(handled).toBe(true);
    expect(object.collected).toBe(true);

    const effect = (gameState.showPickupOverlay as ReturnType<typeof vi.fn>).mock.calls[0][0] as { effect?: () => void };
    effect.effect?.();
    expect(gameState.setArmorEquipped).toHaveBeenCalled();
  });

  // --- Boots ---
  it('boots pickup sets bootsEquipped via overlay effect', () => {
    const gameState = createInteractionGameState();
    const manager = new InteractionManager(gameState, dialogManager);
    const object = { type: 'boots', collected: false, roomIndex: 0, x: 0, y: 0 };

    const handled = manager.handleCollectibleObject(object as never);
    expect(handled).toBe(true);
    expect(object.collected).toBe(true);

    const effect = (gameState.showPickupOverlay as ReturnType<typeof vi.fn>).mock.calls[0][0] as { effect?: () => void };
    effect.effect?.();
    expect(gameState.setBootsEquipped).toHaveBeenCalled();
  });

  // --- Trap ---
  it('trap damages player on contact', () => {
    const gameState = createInteractionGameState();
    const manager = new InteractionManager(gameState, dialogManager);
    const trap = { type: 'trap', roomIndex: 0, x: 0, y: 0 };

    const handled = manager.handleTrap(trap as never);
    expect(handled).toBe(true);
    expect(gameState.damagePlayer).toHaveBeenCalledWith(1);
  });

  it('trap does not damage player when boots are equipped', () => {
    const gameState = createInteractionGameState({ hasBoots: vi.fn(() => true) } as never);
    const manager = new InteractionManager(gameState, dialogManager);
    const trap = { type: 'trap', roomIndex: 0, x: 0, y: 0 };

    const handled = manager.handleTrap(trap as never);
    expect(handled).toBe(true);
    expect(gameState.damagePlayer).not.toHaveBeenCalled();
  });

  it('handleTrap returns false for non-trap objects', () => {
    const gameState = createInteractionGameState();
    const manager = new InteractionManager(gameState, dialogManager);
    const key = { type: 'key', collected: false, roomIndex: 0, x: 0, y: 0 };

    expect(manager.handleTrap(key as never)).toBe(false);
  });

  it('trap does not damage player when variable is ON (trap deactivated)', () => {
    const gameState = createInteractionGameState();
    (gameState.normalizeVariableId as ReturnType<typeof vi.fn>).mockReturnValue('var-1');
    (gameState.isVariableOn as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const manager = new InteractionManager(gameState, dialogManager);
    const trap = { type: 'trap', variableId: 'var-1', roomIndex: 0, x: 0, y: 0 };

    const handled = manager.handleTrap(trap as never);

    expect(handled).toBe(true);
    expect(gameState.damagePlayer).not.toHaveBeenCalled();
  });

  it('trap damages player when variable is OFF (trap active)', () => {
    const gameState = createInteractionGameState();
    (gameState.normalizeVariableId as ReturnType<typeof vi.fn>).mockReturnValue('var-1');
    (gameState.isVariableOn as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const manager = new InteractionManager(gameState, dialogManager);
    const trap = { type: 'trap', variableId: 'var-1', roomIndex: 0, x: 0, y: 0 };

    manager.handleTrap(trap as never);

    expect(gameState.damagePlayer).toHaveBeenCalledWith(1);
  });

  // --- Chest ---
  it('chest opens and gives contained item via overlay effect', () => {
    const gameState = createInteractionGameState();
    const manager = new InteractionManager(gameState, dialogManager);
    const chest = { type: 'chest', opened: false, containsItemType: 'key', roomIndex: 0, x: 0, y: 0 };

    const handled = manager.handleChest(chest as never);
    expect(handled).toBe(true);
    expect(chest.opened).toBe(true);
    expect(gameState.showPickupOverlay).toHaveBeenCalled();

    const effect = (gameState.showPickupOverlay as ReturnType<typeof vi.fn>).mock.calls[0][0] as { effect?: () => void };
    effect.effect?.();
    expect(gameState.addKeys).toHaveBeenCalledWith(1);
  });

  it('chest does not open if already opened', () => {
    const gameState = createInteractionGameState();
    const manager = new InteractionManager(gameState, dialogManager);
    const chest = { type: 'chest', opened: true, containsItemType: 'key', roomIndex: 0, x: 0, y: 0 };

    expect(manager.handleChest(chest as never)).toBe(false);
    expect(gameState.showPickupOverlay).not.toHaveBeenCalled();
  });

  it('unconfigured chest returns false without opening', () => {
    const gameState = createInteractionGameState();
    const manager = new InteractionManager(gameState, dialogManager);
    const chest = { type: 'chest', opened: false, containsItemType: null, roomIndex: 0, x: 0, y: 0 };

    expect(manager.handleChest(chest as never)).toBe(false);
  });

  it('does not lose a collected sword when an XP pickup replaces the pending pickup overlay', () => {
    const gameState = new GameState();
    const manager = new InteractionManager(
      gameState as unknown as ConstructorParameters<typeof InteractionManager>[0],
      dialogManager
    );
    const sword = { type: 'sword', collected: false, roomIndex: 0, x: 0, y: 0 };
    const xpScroll = { type: 'xp-scroll', collected: false, roomIndex: 0, x: 1, y: 0 };

    expect(manager.handleCollectibleObject(sword as never)).toBe(true);
    expect(sword.collected).toBe(true);
    expect(gameState.getSwordType()).toBeNull();

    expect(manager.handleCollectibleObject(xpScroll as never)).toBe(true);
    gameState.hidePickupOverlay();

    expect(gameState.getSwordType()).toBe('sword');
    expect(gameState.getSwordDurability()).toBe(2);
    expect(gameState.getPlayerDamage()).toBe(4);
  });

  // --- Pressure Plate ---
  it('pressure plate activates variable when player steps on it', () => {
    const gameState = createInteractionGameState();
    (gameState.normalizeVariableId as ReturnType<typeof vi.fn>).mockReturnValue('var-1');
    const plate = { type: 'pressure-plate', variableId: 'var-1', activated: false, roomIndex: 0, x: 2, y: 3 };
    (gameState.getAllObjects as ReturnType<typeof vi.fn>).mockReturnValue([plate]);
    const manager = new InteractionManager(gameState, dialogManager);
    const player = { roomIndex: 0, x: 2, y: 3 };

    manager.checkPressurePlates(player);

    expect(plate.activated).toBe(true);
    expect(gameState.setVariableValue).toHaveBeenCalledWith('var-1', true);
  });

  it('pressure plate deactivates variable when player moves off', () => {
    const gameState = createInteractionGameState();
    (gameState.normalizeVariableId as ReturnType<typeof vi.fn>).mockReturnValue('var-1');
    const plate = { type: 'pressure-plate', variableId: 'var-1', activated: true, roomIndex: 0, x: 2, y: 3 };
    (gameState.getAllObjects as ReturnType<typeof vi.fn>).mockReturnValue([plate]);
    const manager = new InteractionManager(gameState, dialogManager);
    const player = { roomIndex: 0, x: 5, y: 5 };

    manager.checkPressurePlates(player);

    expect(plate.activated).toBe(false);
    expect(gameState.setVariableValue).toHaveBeenCalledWith('var-1', false);
  });

  it('pressure plate deactivates when player leaves the room', () => {
    const gameState = createInteractionGameState();
    (gameState.normalizeVariableId as ReturnType<typeof vi.fn>).mockReturnValue('var-1');
    const plate = { type: 'pressure-plate', variableId: 'var-1', activated: true, roomIndex: 0, x: 2, y: 3 };
    (gameState.getAllObjects as ReturnType<typeof vi.fn>).mockReturnValue([plate]);
    const manager = new InteractionManager(gameState, dialogManager);
    const player = { roomIndex: 1, x: 2, y: 3 };

    manager.checkPressurePlates(player);

    expect(plate.activated).toBe(false);
    expect(gameState.setVariableValue).toHaveBeenCalledWith('var-1', false);
  });
});
