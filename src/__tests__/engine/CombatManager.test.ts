import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatManager } from '../../runtime/services/engine/CombatManager';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { TextResources } from '../../runtime/adapters/TextResources';
import { createCombatGameState } from '../helpers/createCombatGameState';
import type { EnemyState } from '../../types/managerTypes';

describe('CombatManager', () => {
  const getSpy = vi.spyOn(TextResources, 'get');
  const formatSpy = vi.spyOn(TextResources, 'format');
  const getDefinitionSpy = vi.spyOn(EnemyDefinitions, 'getEnemyDefinition');
  const getMissChanceSpy = vi.spyOn(EnemyDefinitions, 'getMissChance');

  const createRenderer = () => {
    const startLungeAttackMock = vi.fn();
    startLungeAttackMock.mockImplementation((_attacker: unknown, _target: unknown, onComplete?: () => void) => {
      if (onComplete) onComplete();
    });

    const startKnockbackMock = vi.fn();
    startKnockbackMock.mockImplementation((_entity: unknown, _direction: unknown, onComplete?: () => void) => {
      if (onComplete) onComplete();
    });

    return {
      draw: vi.fn(),
      flashScreen: vi.fn(),
      showCombatIndicator: vi.fn(),
      spawnEnemyLifeLoss: vi.fn(),
      applyGrayscaleFilter: vi.fn(),
      removeGrayscaleFilter: vi.fn(),
      combatAnimator: {
        startLungeAttack: startLungeAttackMock,
        startKnockback: startKnockbackMock,
        freezeFrame: vi.fn(),
      },
      cameraShake: {
        triggerFromDamage: vi.fn(),
      },
      floatingText: {
        spawnDamageNumber: vi.fn(),
      },
      particleSystem: {
        spawnImpactAtTile: vi.fn(),
        spawnCriticalImpact: vi.fn(),
        spawnDeath: vi.fn(),
      },
      entityRenderer: {
        flashEntity: vi.fn(),
      },
    };
  };

  const baseEnemyDefinition = {
    type: 'test-enemy',
    id: 'enemy-test',
    name: 'Test Enemy',
    nameKey: 'enemies.names.test',
    description: 'test',
    damage: 1,
    lives: 3,
    missChance: 0,
    experience: 1,
    hasEyes: true,
    sprite: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    getSpy.mockImplementation((key: string | null | undefined, fallback?: string) => {
      if (key === 'combat.cooldown') return 'Cooldown!';
      if (key === 'combat.stealthKill') return 'Stealth Kill!';
      if (key === 'combat.stealthMiss') return 'Stealth Miss!';
      if (key === 'combat.backstab') return 'Backstab!';
      if (key === 'combat.block.full') return 'Blocked!';
      return fallback || 'text';
    });

    formatSpy.mockImplementation((key: string | null | undefined, params?: Record<string, string | number | boolean>, fallback?: string) => {
      if (key === 'combat.killedBy' && params) return `Killed by ${params.enemy}`;
      if (key === 'combat.block.partial' && params) return `Blocked ${params.value}`;
      return fallback || 'text';
    });

    getDefinitionSpy.mockImplementation(() => baseEnemyDefinition as never);
    getMissChanceSpy.mockImplementation(() => null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Stats and Calculations', () => {
    it('normalizes miss chance to 0-1 range', () => {
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      expect(manager.normalizeMissChance(2)).toBe(1);
      expect(manager.normalizeMissChance(-1)).toBe(0);
      expect(manager.normalizeMissChance(0.5)).toBe(0.5);
      expect(manager.normalizeMissChance(NaN)).toBe(0.25);
    });

    it('returns true when miss chance is 1', () => {
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      expect(manager.attackMissed(1)).toBe(true);
      expect(manager.attackMissed(0)).toBe(false);
    });

    it('gets enemy damage from definition', () => {
      getDefinitionSpy.mockImplementation(() => ({ ...baseEnemyDefinition, damage: 3 } as never));
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      expect(manager.getEnemyDamage('dragon')).toBe(3);
    });

    it('returns minimum 1 damage if definition is invalid', () => {
      getDefinitionSpy.mockImplementation(() => ({ ...baseEnemyDefinition, damage: -5 } as never));
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      expect(manager.getEnemyDamage('invalid')).toBe(1);
    });

    it('gets enemy miss chance from definition', () => {
      getMissChanceSpy.mockImplementation(() => 0.3);
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      expect(manager.getEnemyMissChance('rat')).toBe(0.3);
    });

    it('uses fallback miss chance when definition has none', () => {
      getMissChanceSpy.mockImplementation(() => null);
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer, { fallbackMissChance: 0.25 });

      expect(manager.getEnemyMissChance('rat')).toBe(0.25);
    });

    it('ensures enemy has lives initialized', () => {
      getDefinitionSpy.mockImplementation(() => ({ ...baseEnemyDefinition, lives: 5 } as never));
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      const enemy: EnemyState = { id: 'e1', type: 'rat', roomIndex: 0, x: 0, y: 0, lastX: 0 };
      manager.ensureEnemyLives(enemy);

      expect(enemy.lives).toBe(5);
    });

    it('does not reset lives if already set', () => {
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      const enemy: EnemyState = { id: 'e1', type: 'rat', roomIndex: 0, x: 0, y: 0, lastX: 0, lives: 2 };
      manager.ensureEnemyLives(enemy);

      expect(enemy.lives).toBe(2); // Preserved
    });
  });

  describe('Combat Cooldowns', () => {
    it('blocks combat when attack cooldown is active (no message)', () => {
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
      });
      const renderer = createRenderer();
      const playerManager = {
        isOnAttackCooldown: vi.fn(() => true),
        player: { lastAttackTime: 0 },
      };
      const manager = new CombatManager(gameState, renderer, { playerManager });

      manager.handleEnemyCollision(0);

      // No message shown, but combat is blocked
      expect(renderer.showCombatIndicator).not.toHaveBeenCalled();
      expect(gameState.damagePlayer).not.toHaveBeenCalled();
    });

    it('shows cooldown message when damage cooldown is active', () => {
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        isPlayerOnDamageCooldown: vi.fn(() => true),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Cooldown!', { duration: 700 });
    });
  });

  describe('Assassin Skill - Combat Initiative', () => {
    it('player attacks first with stealth against enemy with 1 life', () => {
      const gameState = createCombatGameState({
        hasSkill: vi.fn((skillId: string) => skillId === 'stealth'),
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 1 }]),
        getPlayer: vi.fn(() => ({ x: 1, y: 1, roomIndex: 0, lives: 3, level: 1 })),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      // Enemy initiates, but stealth skill forces player to attack first
      manager.handleEnemyCollision(0, { initiator: 'enemy' });

      // Player's lunge attack should be called (player attacks first)
      expect(renderer.combatAnimator.startLungeAttack).toHaveBeenCalledWith(
        'player',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('player attacks first with stealth against enemy with 3 lives', () => {
      const gameState = createCombatGameState({
        hasSkill: vi.fn((skillId: string) => skillId === 'stealth'),
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'skeleton', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getPlayer: vi.fn(() => ({ x: 1, y: 1, roomIndex: 0, lives: 3, level: 1 })),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      // Enemy initiates, but stealth skill forces player to attack first
      manager.handleEnemyCollision(0, { initiator: 'enemy' });

      // Player's lunge attack should be called (player attacks first)
      expect(renderer.combatAnimator.startLungeAttack).toHaveBeenCalledWith(
        'player',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('enemy can attack first against enemy with 4+ lives even with stealth', () => {
      const gameState = createCombatGameState({
        hasSkill: vi.fn((skillId: string) => skillId === 'stealth'),
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'dark-knight', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 4 }]),
        getPlayer: vi.fn(() => ({ x: 1, y: 1, roomIndex: 0, lives: 3, level: 1 })),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      // Enemy initiates combat
      manager.handleEnemyCollision(0, { initiator: 'enemy' });

      // Player's knockback should be called first (enemy attacks first)
      expect(renderer.combatAnimator.startKnockback).toHaveBeenCalledWith(
        'player',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('player does not get first strike without stealth skill', () => {
      const gameState = createCombatGameState({
        hasSkill: vi.fn(() => false),
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 1 }]),
        getPlayer: vi.fn(() => ({ x: 1, y: 1, roomIndex: 0, lives: 3, level: 1 })),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      // Enemy initiates combat
      manager.handleEnemyCollision(0, { initiator: 'enemy' });

      // Player's knockback should be called first (enemy attacks first)
      expect(renderer.combatAnimator.startKnockback).toHaveBeenCalledWith(
        'player',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Backstab/Flanking Mechanic', () => {
    it('deals +1 damage when attacking enemy from behind (enemy moved right)', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 5, y: 3, lastX: 4, lives: 3 };
      const player = { x: 4, y: 3, roomIndex: 0, lives: 3, level: 1 };

      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => player),
        getPlayerDamage: vi.fn(() => 1),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'player' });

      // Enemy should have lost 2 lives (1 base damage + 1 backstab)
      expect(enemy.lives).toBe(1);
      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Backstab!', expect.any(Object));
    });

    it('deals +1 damage when attacking enemy from behind (enemy moved left)', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 3, y: 3, lastX: 4, lives: 3 };
      const player = { x: 4, y: 3, roomIndex: 0, lives: 3, level: 1 };

      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => player),
        getPlayerDamage: vi.fn(() => 1),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'player' });

      // Enemy should have lost 2 lives (1 base damage + 1 backstab)
      expect(enemy.lives).toBe(1);
      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Backstab!', expect.any(Object));
    });

    it('does NOT deal backstab damage when attacking from front', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 5, y: 3, lastX: 4, lives: 3 };
      const player = { x: 6, y: 3, roomIndex: 0, lives: 3, level: 1 };

      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => player),
        getPlayerDamage: vi.fn(() => 1),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'player' });

      // Enemy should have lost only 1 life (no backstab)
      expect(enemy.lives).toBe(2);
      expect(renderer.showCombatIndicator).not.toHaveBeenCalledWith('Backstab!', expect.any(Object));
    });

    it('does NOT deal backstab damage when enemy has not moved', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 5, y: 3, lastX: 5, lives: 3 };
      const player = { x: 4, y: 3, roomIndex: 0, lives: 3, level: 1 };

      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => player),
        getPlayerDamage: vi.fn(() => 1),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'player' });

      // Enemy should have lost only 1 life (no backstab, enemy didn't move)
      expect(enemy.lives).toBe(2);
      expect(renderer.showCombatIndicator).not.toHaveBeenCalledWith('Backstab!', expect.any(Object));
    });

    it('deals +1 damage when attacking enemy from behind (enemy moved DOWN)', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 5, y: 4, lastX: 5, lastY: 3, lives: 3 };
      const player = { x: 5, y: 3, roomIndex: 0, lives: 3, level: 1 };

      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => player),
        getPlayerDamage: vi.fn(() => 1),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'player' });

      // Enemy should have lost 2 lives (1 base damage + 1 backstab)
      expect(enemy.lives).toBe(1);
      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Backstab!', expect.any(Object));
    });

    it('deals +1 damage when attacking enemy from behind (enemy moved UP)', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 5, y: 3, lastX: 5, lastY: 4, lives: 3 };
      const player = { x: 5, y: 4, roomIndex: 0, lives: 3, level: 1 };

      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => player),
        getPlayerDamage: vi.fn(() => 1),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'player' });

      // Enemy should have lost 2 lives (1 base damage + 1 backstab)
      expect(enemy.lives).toBe(1);
      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Backstab!', expect.any(Object));
    });

    it('prioritizes vertical backstab when enemy moved UP but has stale lastX', () => {
      // Scenario: Enemy moved up (y: 4 -> 3) but lastX is different from x
      // This can happen if lastX wasn't properly updated
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 5, y: 3, lastX: 4, lastY: 4, lives: 3 };
      const player = { x: 5, y: 4, roomIndex: 0, lives: 3, level: 1 };

      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => player),
        getPlayerDamage: vi.fn(() => 1),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'player' });

      // This test will FAIL with current implementation because horizontal check happens first
      // Enemy should have lost 2 lives (1 base damage + 1 backstab for attacking from behind vertically)
      expect(enemy.lives).toBe(1);
      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Backstab!', expect.any(Object));
    });
  });

  describe('Legacy Combat', () => {
    it('damages player when enemy attack hits', () => {
      getMissChanceSpy.mockImplementation(() => 0); // 0% miss - guaranteed hit
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        damagePlayer: vi.fn(() => 2), // Player survives with 2 lives
        getLives: vi.fn(() => 3),
      });
      const renderer = { ...createRenderer(), combatAnimator: undefined }; // Force legacy mode
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      expect(gameState.damagePlayer).toHaveBeenCalledWith(1);
      expect(renderer.spawnEnemyLifeLoss).toHaveBeenCalledWith(1, 1, 2); // Enemy loses 1 life
    });

    it('shows miss feedback when enemy attack misses', () => {
      getMissChanceSpy.mockImplementation(() => 1); // 100% miss
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getLives: vi.fn(() => 3),
      });
      const renderer = { ...createRenderer(), combatAnimator: undefined }; // Force legacy mode
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Miss', { duration: 500 });
      expect(gameState.damagePlayer).not.toHaveBeenCalled();
    });

    it('triggers death sequence when player dies in legacy combat', () => {
      getMissChanceSpy.mockImplementation(() => 0); // 0% miss - guaranteed hit
      getDefinitionSpy.mockImplementation(() => ({ ...baseEnemyDefinition, nameKey: 'enemies.names.rat' } as never));
      const setLastKillerEnemy = vi.fn();
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        damagePlayer: vi.fn(() => 0), // Player dies
        getLives: vi.fn(() => 1),
        setLastKillerEnemy,
      });
      const renderer = { ...createRenderer(), combatAnimator: undefined }; // Force legacy mode
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      expect(renderer.applyGrayscaleFilter).toHaveBeenCalled();
      expect(gameState.pauseGame).toHaveBeenCalledWith('player-death');
      expect(setLastKillerEnemy).toHaveBeenCalledWith('e1');
    });

    it('removes enemy when defeated in legacy combat', () => {
      const onEnemyDefeated = vi.fn();
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 1 }]),
        damagePlayer: vi.fn(() => 2),
        getLives: vi.fn(() => 3),
      });
      const renderer = { ...createRenderer(), combatAnimator: undefined };
      const manager = new CombatManager(gameState, renderer, { onEnemyDefeated });

      manager.handleEnemyCollision(0);

      expect(onEnemyDefeated).toHaveBeenCalledWith('e1', expect.any(Object));
      expect(renderer.flashScreen).toHaveBeenCalledWith({ intensity: 0.8, duration: 160 });
    });
  });

  describe('Animated Combat - Player Initiated', () => {
    it('player attacks and defeats enemy', () => {
      getMissChanceSpy.mockImplementation(() => 0); // 0% miss - guaranteed hit
      const onEnemyDefeated = vi.fn();
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 1 }]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer, { onEnemyDefeated });

      manager.handleEnemyCollision(0, { initiator: 'player' });

      // Advance timers to complete death animation (rotation + fade = 1000ms)
      vi.advanceTimersByTime(1000);

      expect(renderer.combatAnimator.startLungeAttack).toHaveBeenCalled();
      expect(renderer.entityRenderer.flashEntity).toHaveBeenCalled();
      expect(onEnemyDefeated).toHaveBeenCalledWith('e1', expect.any(Object));
    });

    it('player attacks but enemy survives and counter-attacks', () => {
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getPlayerDamage: vi.fn(() => 1),
        damagePlayer: vi.fn(() => 2),
      });
      const renderer = createRenderer();
      // Set fallbackMissChance to 0 so attacks always hit
      const manager = new CombatManager(gameState, renderer, { fallbackMissChance: 0 });

      manager.handleEnemyCollision(0, { initiator: 'player' });

      expect(renderer.combatAnimator.startKnockback).toHaveBeenCalled();
      expect(gameState.damagePlayer).toHaveBeenCalledWith(1);
    });

    it('enemy misses counter-attack in animated combat', () => {
      getMissChanceSpy.mockImplementation(() => 1); // 100% miss
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'player' });

      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Miss', { duration: 500 });
      expect(gameState.damagePlayer).not.toHaveBeenCalled();
    });
  });

  describe('Animated Combat - Enemy Initiated', () => {
    it('enemy attacks and player counter-attacks', () => {
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getPlayerDamage: vi.fn(() => 1),
        damagePlayer: vi.fn(() => 2),
        getLives: vi.fn(() => 3),
      });
      const renderer = createRenderer();
      // Set fallbackMissChance to 0 so attacks always hit
      const manager = new CombatManager(gameState, renderer, { fallbackMissChance: 0 });

      manager.handleEnemyCollision(0, { initiator: 'enemy' });

      expect(renderer.combatAnimator.startKnockback).toHaveBeenCalled();
      expect(gameState.damagePlayer).toHaveBeenCalledWith(1);
      expect(renderer.combatAnimator.startLungeAttack).toHaveBeenCalled();
    });

    it('enemy misses initial attack in animated combat', () => {
      getMissChanceSpy.mockImplementation(() => 1); // 100% miss
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getLives: vi.fn(() => 3),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'enemy' });

      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Miss', { duration: 500 });
      expect(gameState.damagePlayer).not.toHaveBeenCalled();
      expect(renderer.combatAnimator.startLungeAttack).toHaveBeenCalled(); // Player still counter-attacks
    });

    it('player dies to enemy attack', () => {
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getPlayerDamage: vi.fn(() => 1),
        damagePlayer: vi.fn(() => 0), // Player dies
        getLives: vi.fn(() => 1),
      });
      const renderer = createRenderer();
      // Set fallbackMissChance to 0 so attacks always hit
      const manager = new CombatManager(gameState, renderer, { fallbackMissChance: 0 });

      manager.handleEnemyCollision(0, { initiator: 'enemy' });

      expect(renderer.applyGrayscaleFilter).toHaveBeenCalled();
      expect(gameState.pauseGame).toHaveBeenCalledWith('player-death');
      expect(renderer.combatAnimator.startLungeAttack).not.toHaveBeenCalled(); // No counter-attack
    });
  });

  describe('Death Sequence', () => {
    it('cancels death sequence timer', () => {
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.cancelDeathSequence();

      expect(renderer.removeGrayscaleFilter).toHaveBeenCalled();
      expect(gameState.resumeGame).toHaveBeenCalledWith('player-death');
    });

    it('triggers game over after death sequence completes', () => {
      const onPlayerDefeated = vi.fn();
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 1 }]),
        getPlayerDamage: vi.fn(() => 1),
        damagePlayer: vi.fn(() => 0),
        getLives: vi.fn(() => 1),
      });
      const renderer = { ...createRenderer(), combatAnimator: undefined };
      // Set fallbackMissChance to 0 so attacks always hit
      const manager = new CombatManager(gameState, renderer, { onPlayerDefeated, fallbackMissChance: 0 });

      manager.handleEnemyCollision(0);

      // Fast-forward timers
      vi.advanceTimersByTime(2500);

      expect(onPlayerDefeated).toHaveBeenCalled();
      expect(renderer.removeGrayscaleFilter).toHaveBeenCalled();
      expect(gameState.resumeGame).toHaveBeenCalledWith('player-death');
    });

    it('cleans up animation timers on death sequence cancel', () => {
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      // Simulate animation timers being created
      const timer1 = setTimeout(() => {}, 1000);
      const timer2 = setTimeout(() => {}, 2000);
      manager['animationTimers'].add(timer1);
      manager['animationTimers'].add(timer2);

      manager.cancelDeathSequence();

      expect(manager['animationTimers'].size).toBe(0);
    });

    it('resets combatActive to false when cancelDeathSequence is called (freeze bug fix)', () => {
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      // Simulate combat being active (as set by handleAnimatedCombat during combat)
      manager.combatActive = true;
      expect(manager.isInCombat()).toBe(true);

      manager.cancelDeathSequence();

      // After reset/stop, combat must be inactive so game is not frozen
      expect(manager.isInCombat()).toBe(false);
    });
  });

  describe('Bug Fixes Validation', () => {
    it('Bug #1: player does not die when enemy misses attack', () => {
      getMissChanceSpy.mockImplementation(() => 1); // 100% miss
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getLives: vi.fn(() => 1), // Player has 1 life
        damagePlayer: vi.fn(),
      });
      const renderer = { ...createRenderer(), combatAnimator: undefined };
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      // Player should NOT die despite having 1 life, because attack missed
      expect(renderer.applyGrayscaleFilter).not.toHaveBeenCalled();
      expect(gameState.damagePlayer).not.toHaveBeenCalled();
    });

    it('Bug #2: uses enemy ID instead of index for safe removal', () => {
      const onEnemyDefeated = vi.fn();
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 1 }]),
      });
      const renderer = { ...createRenderer(), combatAnimator: undefined };
      const manager = new CombatManager(gameState, renderer, { onEnemyDefeated });

      manager.handleEnemyCollision(0);

      // Should pass enemy ID, not index
      expect(onEnemyDefeated).toHaveBeenCalledWith('e1', expect.any(Object));
    });

    it('Bug #2: does not process combat if enemy has no ID', () => {
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      manager.handleEnemyCollision(0);

      expect(consoleSpy).toHaveBeenCalledWith('Enemy missing ID, cannot process combat safely');
      expect(renderer.combatAnimator.startLungeAttack).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('Bug #5: attackMissed does not mutate fallbackMissChance', () => {
      const gameState = createCombatGameState();
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer, { fallbackMissChance: 0.25 });

      const originalFallback = manager['fallbackMissChance'];
      manager.attackMissed(); // Call without parameter

      expect(manager['fallbackMissChance']).toBe(originalFallback); // Should not mutate
    });
  });

  describe('Edge Cases', () => {
    it('handles invalid enemy index gracefully', () => {
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => []),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      expect(() => manager.handleEnemyCollision(-1)).not.toThrow();
      expect(() => manager.handleEnemyCollision(999)).not.toThrow();
    });

    it('handles enemy without entityRenderer in death animation', () => {
      const onEnemyDefeated = vi.fn();
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 1 }]),
      });
      const renderer = { ...createRenderer(), entityRenderer: undefined };
      const manager = new CombatManager(gameState, renderer, { onEnemyDefeated });

      manager['playEnemyDeathAnimation']({ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1 }, onEnemyDefeated);

      // Advance timers to complete death animation (even without renderer, cleanup still scheduled)
      vi.advanceTimersByTime(1000);

      expect(onEnemyDefeated).toHaveBeenCalled();
    });

    it('handles damage reduction from shield', () => {
      getMissChanceSpy.mockImplementation(() => 0); // 0% miss - guaranteed hit
      getDefinitionSpy.mockImplementation(() => ({ ...baseEnemyDefinition, damage: 2 } as never));
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        damagePlayer: vi.fn(() => 2),
        consumeLastDamageReduction: vi.fn(() => 1), // Shield blocked 1 damage (less than total)
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'enemy' });

      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Blocked 1', { duration: 700 });
    });

    it('handles full damage block from shield', () => {
      getMissChanceSpy.mockImplementation(() => 0); // 0% miss - guaranteed hit
      getDefinitionSpy.mockImplementation(() => ({ ...baseEnemyDefinition, damage: 1 } as never));
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        damagePlayer: vi.fn(() => 2),
        consumeLastDamageReduction: vi.fn(() => 1), // Shield blocked all damage (1 >= 1)
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0, { initiator: 'enemy' });

      expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Blocked!', { duration: 700 });
    });
  });

  describe('Player Damage System', () => {
    it('deals base damage (1) when player has no sword', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 };
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getPlayerDamage: vi.fn(() => 1), // No sword = base damage
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      expect(enemy.lives).toBe(2); // 3 - 1 = 2
    });

    it('deals 2 damage when player has wooden sword', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 5 };
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getPlayerDamage: vi.fn(() => 2), // Wooden sword = 2 damage
        getSwordType: vi.fn(() => 'sword-wood'),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      expect(enemy.lives).toBe(3); // 5 - 2 = 3
    });

    it('deals 3 damage when player has bronze sword', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 5 };
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getPlayerDamage: vi.fn(() => 3), // Bronze sword = 3 damage
        getSwordType: vi.fn(() => 'sword-bronze'),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      expect(enemy.lives).toBe(2); // 5 - 3 = 2
    });

    it('deals 4 damage when player has steel sword', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 5 };
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getPlayerDamage: vi.fn(() => 4), // Steel sword = 4 damage
        getSwordType: vi.fn(() => 'sword'),
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      expect(enemy.lives).toBe(1); // 5 - 4 = 1
    });

    it('one-shots enemy with 2 lives using steel sword', () => {
      const onEnemyDefeated = vi.fn();
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 2 }]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getPlayerDamage: vi.fn(() => 4), // Steel sword = 4 damage
      });
      const renderer = createRenderer();
      const manager = new CombatManager(gameState, renderer, { onEnemyDefeated });

      manager.handleEnemyCollision(0);
      vi.advanceTimersByTime(1000); // Complete death animation (rotation + fade)

      expect(onEnemyDefeated).toHaveBeenCalledWith('e1', expect.objectContaining({ lives: -2 }));
    });

    it('applies sword damage in legacy combat mode', () => {
      const enemy = { id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 5 };
      const gameState = createCombatGameState({
        getEnemies: vi.fn(() => [enemy]),
        getPlayer: vi.fn(() => ({ roomIndex: 0, x: 0, y: 1 })),
        getPlayerDamage: vi.fn(() => 3), // Bronze sword
      });
      const renderer = { ...createRenderer(), combatAnimator: undefined }; // Force legacy mode
      const manager = new CombatManager(gameState, renderer);

      manager.handleEnemyCollision(0);

      expect(enemy.lives).toBe(2); // 5 - 3 = 2
    });
  });
});
