import { describe, it, expect } from 'vitest';
import { GameConfigSchema } from '../../config/GameConfigSchema';

describe('GameConfigSchema', () => {
  const createValidConfig = () => ({
    canvas: {
      width: 128,
      height: 152,
      minTileSize: 8,
      minHudHeight: 28,
      hudHeightMultiplier: 1.75,
      minInventoryHeight: 40,
      inventoryHeightMultiplier: 2,
    },
    world: {
      rows: 3,
      cols: 3,
      roomSize: 8,
      matrixSize: 8,
    },
    player: {
      startX: 1,
      startY: 1,
      startRoomIndex: 0,
      startLevel: 1,
      maxLevel: 10,
      baseMaxLives: 3,
      startLives: 3,
      experienceBase: 6,
      experienceGrowth: 1.35,
      maxKeys: 9,
      roomChangeDamageCooldown: 1000,
    },
    combat: {
      attackCooldown: 300,
      hitStunDuration: 200,
      lungeAnimationDuration: 150,
      knockbackDuration: 150,
      deathAnimationDuration: 300,
      screenShake: {
        enabled: true,
        minIntensity: 0.3,
        maxIntensity: 1.0,
        baseDuration: 300,
        intensityPerDamage: 0.2,
      },
      hitFlashDuration: 100,
      hitstopDuration: 60,
      hitstopMinDamage: 3,
      floatingNumbers: {
        enabled: true,
        duration: 800,
        riseSpeed: 0.5,
        fontSize: 8,
      },
      particles: {
        enabled: true,
        impactCount: 8,
        criticalImpactCount: 16,
        deathCount: 20,
        lifetime: 500,
        gravity: 0.1,
      },
      telegraph: {
        enabled: true,
        color: '#FF004D',
        pulseSpeed: 0.006,
        triggerDistance: 1,
      },
    },
    enemy: {
      movementInterval: 600,
      fallbackMissChance: 0.25,
      stealthMissChance: 0.25,
      vision: {
        range: 2,
        alertDuration: 140,
      },
    },
    animation: {
      tileInterval: 320,
      minInterval: 60,
      iconOverPlayerDuration: 2000,
      overlayFPS: 30,
      blinkInterval: 500,
      blinkMinOpacity: 0.3,
      blinkMaxOpacity: 0.95,
    },
    effects: {
      combatIndicatorDuration: 600,
      screenFlashMinDuration: 16,
      screenFlashDuration: 140,
      edgeFlashMinDuration: 32,
      edgeFlashDuration: 220,
    },
    transitions: {
      roomMinDuration: 120,
      roomDuration: 320,
      blockedMovementDuration: 240,
    },
    timing: {
      resetAfterIntro: 2000,
      resetAfterGameOver: 2000,
      levelUpCelebration: 3000,
      celebrationMinDuration: 300,
      celebrationMaxDuration: 3000,
    },
    input: {
      maxDuration: 600,
    },
    hud: {
      padding: 4,
      gap: 6,
      backgroundColor: '#000000',
    },
    tiles: {
      legacyMax: 15,
      valueMax: 255,
    },
    palette: {
      colors: [
        '#000000',
        '#1D2B53',
        '#7E2553',
        '#008751',
        '#AB5236',
        '#5F574F',
        '#C2C3C7',
        '#FFF1E8',
        '#FF004D',
        '#FFA300',
        '#FFFF27',
        '#00E756',
        '#29ADFF',
        '#83769C',
        '#FF77A8',
        '#FFCCAA',
      ],
    },
    debug: {
      showEnemyVision: false,
      visionOverlayColor: '#FF004D',
      visionOverlayOpacity: 0.3,
    },
  });

  describe('Valid configuration', () => {
    it('should create a valid configuration instance', () => {
      const config = new GameConfigSchema(createValidConfig());

      expect(config.canvas.width).toBe(128);
      expect(config.world.rows).toBe(3);
      expect(config.player.maxLevel).toBe(10);
      expect(config.enemy.vision.range).toBe(2);
      expect(config.animation.tileInterval).toBe(320);
      expect(config.palette.colors).toHaveLength(16);
    });

    it('should return immutable copies from getters', () => {
      const config = new GameConfigSchema(createValidConfig());

      const canvas1 = config.canvas;
      const canvas2 = config.canvas;

      expect(canvas1).not.toBe(canvas2);
      expect(canvas1).toEqual(canvas2);
    });
  });

  describe('Canvas validation', () => {
    it('should reject negative canvas width', () => {
      const configData = createValidConfig();
      configData.canvas.width = -128;

      expect(() => new GameConfigSchema(configData)).toThrow('Invalid canvas width');
    });

    it('should reject non-integer min tile size', () => {
      const configData = createValidConfig();
      configData.canvas.minTileSize = 8.5;

      expect(() => new GameConfigSchema(configData)).toThrow('Invalid min tile size');
    });
  });

  describe('Player validation', () => {
    it('should reject start level greater than max level', () => {
      const configData = createValidConfig();
      configData.player.startLevel = 15;
      configData.player.maxLevel = 10;

        expect(() => new GameConfigSchema(configData)).toThrow(
        'Start level (15) cannot exceed max level (10)'
      );
    });

    it('should reject start lives greater than base max lives', () => {
      const configData = createValidConfig();
      configData.player.startLives = 5;
      configData.player.baseMaxLives = 3;

      expect(() => new GameConfigSchema(configData)).toThrow(
        'Start lives (5) cannot exceed base max lives (3)'
      );
    });

    it('should reject negative max keys', () => {
      const configData = createValidConfig();
      configData.player.maxKeys = -1;

      expect(() => new GameConfigSchema(configData)).toThrow('Invalid max keys');
    });
  });

  describe('Enemy validation', () => {
    it('should reject invalid miss chance values', () => {
      const configData = createValidConfig();
      configData.enemy.fallbackMissChance = 1.5;

      expect(() => new GameConfigSchema(configData)).toThrow(
        'Invalid fallback miss chance'
      );
    });

    it('should reject negative miss chance', () => {
      const configData = createValidConfig();
      configData.enemy.stealthMissChance = -0.1;

      expect(() => new GameConfigSchema(configData)).toThrow(
        'Invalid stealth miss chance'
      );
    });

    it('should reject negative vision range', () => {
      const configData = createValidConfig();
      configData.enemy.vision.range = -1;

      expect(() => new GameConfigSchema(configData)).toThrow('Invalid enemy vision range');
    });
  });

  describe('Animation validation', () => {
    it('should reject min opacity greater than max opacity', () => {
      const configData = createValidConfig();
      configData.animation.blinkMinOpacity = 0.9;
      configData.animation.blinkMaxOpacity = 0.3;

      expect(() => new GameConfigSchema(configData)).toThrow(
        'Blink min opacity (0.9) cannot exceed max opacity (0.3)'
      );
    });

    it('should reject invalid opacity values', () => {
      const configData = createValidConfig();
      configData.animation.blinkMinOpacity = 1.5;

      expect(() => new GameConfigSchema(configData)).toThrow('Invalid blink min opacity');
    });

    it('should reject zero overlay FPS', () => {
      const configData = createValidConfig();
      configData.animation.overlayFPS = 0;

      expect(() => new GameConfigSchema(configData)).toThrow('Invalid overlay FPS');
    });
  });

  describe('Timing validation', () => {
    it('should reject min celebration duration greater than max', () => {
      const configData = createValidConfig();
      configData.timing.celebrationMinDuration = 5000;
      configData.timing.celebrationMaxDuration = 3000;

      expect(() => new GameConfigSchema(configData)).toThrow(
        'Celebration min duration (5000) cannot exceed max duration (3000)'
      );
    });
  });

  describe('HUD validation', () => {
    it('should reject invalid background color', () => {
      const configData = createValidConfig();
      configData.hud.backgroundColor = 'not-a-color';

      expect(() => new GameConfigSchema(configData)).toThrow(
        'Invalid HUD background color'
      );
    });

    it('should accept valid hex colors', () => {
      const configData = createValidConfig();
      configData.hud.backgroundColor = '#FF0000';

      const config = new GameConfigSchema(configData);
      expect(config.hud.backgroundColor).toBe('#FF0000');
    });
  });

  describe('Palette validation', () => {
    it('should reject empty color palette', () => {
      const configData = createValidConfig();
      configData.palette.colors = [];

      expect(() => new GameConfigSchema(configData)).toThrow(
        'Palette colors must be a non-empty array'
      );
    });

    it('should reject invalid color in palette', () => {
      const configData = createValidConfig();
      configData.palette.colors = ['#000000', 'invalid-color'];

      expect(() => new GameConfigSchema(configData)).toThrow(
        'Invalid color at palette index 1'
      );
    });
  });

  describe('JSON export', () => {
    it('should export to JSON correctly', () => {
      const configData = createValidConfig();
      const config = new GameConfigSchema(configData);
      const json = config.toJSON();

      expect(json.canvas).toEqual(configData.canvas);
      expect(json.world).toEqual(configData.world);
      expect(json.player).toEqual(configData.player);
      expect(json.enemy).toEqual(configData.enemy);
      expect(json.palette.colors).toEqual(configData.palette.colors);
    });
  });
});
