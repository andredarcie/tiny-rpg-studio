import { describe, expect, it } from 'vitest';
import { StatePlayerManager } from '../../runtime/domain/state/StatePlayerManager';

const createWorldManager = () => ({
  clampRoomIndex: (value: number) => {
    const numeric = Number.isFinite(value) ? Math.floor(value) : 0;
    return Math.max(0, Math.min(8, numeric));
  },
  clampCoordinate: (value: number) => {
    const numeric = Number.isFinite(value) ? Math.floor(value) : 0;
    return Math.max(0, Math.min(7, numeric));
  },
});

describe('StatePlayerManager', () => {
  it('clamps keys and respects god mode', () => {
    const state: {
      player: {
        x: number;
        y: number;
        lastX: number;
        roomIndex: number;
        level: number;
        maxLives: number;
        currentLives: number;
        lives: number;
        keys: number;
        experience: number;
        damageShield: number;
        damageShieldMax: number;
        swordType: null;
        lastDamageReduction: number;
        godMode: boolean;
      };
    } = {
      player: {
        x: 1,
        y: 1,
        lastX: 1,
        roomIndex: 0,
        level: 1,
        maxLives: 3,
        currentLives: 3,
        lives: 3,
        keys: 0,
        experience: 0,
        damageShield: 0,
        damageShieldMax: 0,
        swordType: null,
        lastDamageReduction: 0,
        godMode: false,
      },
    };
    const manager = new StatePlayerManager(state as never, createWorldManager() as never);

    expect(manager.addKeys(20)).toBe(manager.getMaxKeys());
    expect(manager.consumeKey()).toBe(true);
    expect(manager.getKeys()).toBe(manager.getMaxKeys() - 1);

    manager.setGodMode(true);
    state.player.currentLives = 1;
    manager.damage(5);
    expect(state.player.currentLives).toBe(state.player.maxLives);
  });

  it('armor reduces incoming damage by 1', () => {
    const state = {
      player: {
        x: 1, y: 1, lastX: 1, roomIndex: 0, level: 1,
        maxLives: 3, currentLives: 3, lives: 3,
        keys: 0, experience: 0, damageShield: 0, damageShieldMax: 0,
        swordType: null, lastDamageReduction: 0, godMode: false,
        swordDurability: 0, stunUntil: 0, lastAttackTime: 0,
        armorEquipped: false, bootsEquipped: false,
      },
    };
    const manager = new StatePlayerManager(state as never, createWorldManager() as never);

    manager.damage(2);
    expect(state.player.currentLives).toBe(1);

    state.player.currentLives = 3;
    manager.setArmorEquipped();
    expect(state.player.armorEquipped).toBe(true);

    manager.damage(2);
    expect(state.player.currentLives).toBe(2);
  });

  it('armor absorbs 1-damage hits entirely', () => {
    const state = {
      player: {
        x: 1, y: 1, lastX: 1, roomIndex: 0, level: 1,
        maxLives: 3, currentLives: 3, lives: 3,
        keys: 0, experience: 0, damageShield: 0, damageShieldMax: 0,
        swordType: null, lastDamageReduction: 0, godMode: false,
        swordDurability: 0, stunUntil: 0, lastAttackTime: 0,
        armorEquipped: true, bootsEquipped: false,
      },
    };
    const manager = new StatePlayerManager(state as never, createWorldManager() as never);

    manager.damage(1);
    expect(state.player.currentLives).toBe(3);
  });

  it('hasBoots returns false without boots, true after setBootsEquipped', () => {
    const state = {
      player: {
        x: 1, y: 1, lastX: 1, roomIndex: 0, level: 1,
        maxLives: 3, currentLives: 3, lives: 3,
        keys: 0, experience: 0, damageShield: 0, damageShieldMax: 0,
        swordType: null, lastDamageReduction: 0, godMode: false,
        swordDurability: 0, stunUntil: 0, lastAttackTime: 0,
      },
    };
    const manager = new StatePlayerManager(state as never, createWorldManager() as never);

    expect(manager.hasBoots()).toBe(false);
    manager.setBootsEquipped();
    expect(manager.hasBoots()).toBe(true);
  });

  it('hasArmor returns false without armor, true after setArmorEquipped', () => {
    const state = {
      player: {
        x: 1, y: 1, lastX: 1, roomIndex: 0, level: 1,
        maxLives: 3, currentLives: 3, lives: 3,
        keys: 0, experience: 0, damageShield: 0, damageShieldMax: 0,
        swordType: null, lastDamageReduction: 0, godMode: false,
        swordDurability: 0, stunUntil: 0, lastAttackTime: 0,
      },
    };
    const manager = new StatePlayerManager(state as never, createWorldManager() as never);

    expect(manager.hasArmor()).toBe(false);
    manager.setArmorEquipped();
    expect(manager.hasArmor()).toBe(true);
  });

  it('reset clears armor and boots equipped state', () => {
    const state = {
      player: {
        x: 1, y: 1, lastX: 1, roomIndex: 0, level: 1,
        maxLives: 3, currentLives: 3, lives: 3,
        keys: 0, experience: 0, damageShield: 0, damageShieldMax: 0,
        swordType: null, lastDamageReduction: 0, godMode: false,
        swordDurability: 0, stunUntil: 0, lastAttackTime: 0,
        armorEquipped: true, bootsEquipped: true,
      },
    };
    const manager = new StatePlayerManager(state as never, createWorldManager() as never);

    manager.reset({ x: 1, y: 1, roomIndex: 0 });

    expect(manager.hasArmor()).toBe(false);
    expect(manager.hasBoots()).toBe(false);
  });
});
