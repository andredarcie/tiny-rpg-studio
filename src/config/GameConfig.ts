/**
 * Centralized game configuration
 *
 * This file contains all constants and configurable values for the game runtime.
 * Uses GameConfigSchema for type safety and validation.
 */

import { GameConfigSchema } from './GameConfigSchema';

/**
 * Validated and immutable game configuration instance
 *
 * All values are validated at instantiation time to ensure correctness.
 */
export const GameConfig = new GameConfigSchema({
  /**
   * Canvas and rendering configuration
   */
  canvas: {
    /** Game canvas width in pixels */
    width: 128,
    /** Game canvas height in pixels */
    height: 152,
    /** Minimum tile size in pixels */
    minTileSize: 8,
    /** Minimum HUD bar height in pixels */
    minHudHeight: 28,
    /** HUD height multiplier relative to tile size */
    hudHeightMultiplier: 1.75,
    /** Minimum inventory bar height in pixels */
    minInventoryHeight: 40,
    /** Inventory height multiplier relative to tile size */
    inventoryHeightMultiplier: 2,
  },

  /**
   * World and room configuration
   */
  world: {
    /** Number of rows in the world grid */
    rows: 3,
    /** Number of columns in the world grid */
    cols: 3,
    /** Size of each room (tiles per side) */
    roomSize: 8,
    /** Tile matrix size (tiles x tiles per room) */
    matrixSize: 8,
  },

  /**
   * Player configuration
   */
  player: {
    /** Starting X position */
    startX: 1,
    /** Starting Y position */
    startY: 1,
    /** Starting room index */
    startRoomIndex: 0,
    /** Starting level */
    startLevel: 1,
    /** Maximum achievable level */
    maxLevel: 10,
    /** Base maximum lives at start */
    baseMaxLives: 3,
    /** Starting lives */
    startLives: 3,
    /** Base experience required to level up */
    experienceBase: 6,
    /** XP growth multiplier per level */
    experienceGrowth: 1.35,
    /** Maximum number of keys that can be carried */
    maxKeys: 9,
    /** Damage cooldown time after room change (ms) */
    roomChangeDamageCooldown: 1000,
  },

  /**
   * Combat system configuration
   */
  combat: {
    /** Minimum time between attacks (ms) */
    attackCooldown: 1500,
    /** Duration of hit stun after taking damage (ms) */
    hitStunDuration: 800,
    /** Duration of lunge attack animation (ms) */
    lungeAnimationDuration: 700,
    /** Duration of knockback animation (ms) */
    knockbackDuration: 600,
    /** Duration of enemy death animation (ms) */
    deathAnimationDuration: 1000,
    /** Screen shake configuration */
    screenShake: {
      /** Enable screen shake effect */
      enabled: true,
      /** Minimum shake intensity (0.0 - 1.0) */
      minIntensity: 0.3,
      /** Maximum shake intensity (0.0 - 1.0) */
      maxIntensity: 1.0,
      /** Base shake duration (ms) */
      baseDuration: 300,
      /** Additional intensity per damage point */
      intensityPerDamage: 0.2,
    },
    /** Hit flash duration (ms) */
    hitFlashDuration: 100,
    /** Camera freeze (hitstop) duration (ms) */
    hitstopDuration: 60,
    /** Minimum damage to trigger hitstop */
    hitstopMinDamage: 3,
    /** Floating damage numbers configuration */
    floatingNumbers: {
      /** Enable floating damage numbers */
      enabled: true,
      /** Duration of floating text (ms) */
      duration: 800,
      /** Rise speed (pixels per second) */
      riseSpeed: 0.5,
      /** Font size for damage numbers (pixels) */
      fontSize: 8,
    },
    /** Attack telegraph (warning) configuration */
    telegraph: {
      /** Enable attack warning indicators */
      enabled: true,
      /** Warning color (hex) */
      color: '#FF004D',
      /** Pulse speed (radians per millisecond) - faster = more noticeable */
      pulseSpeed: 0.02,
      /** Show warning when enemy is N tiles away */
      triggerDistance: 1,
    },
    /** Particle effects configuration */
    particles: {
      /** Enable particle effects */
      enabled: true,
      /** Particle count for normal impact */
      impactCount: 8,
      /** Particle count for critical impact */
      criticalImpactCount: 16,
      /** Particle count for enemy death */
      deathCount: 20,
      /** Particle lifetime (ms) */
      lifetime: 500,
      /** Gravity acceleration (pixels per frame) */
      gravity: 0.1,
    },
  },

  /**
   * Enemy configuration
   */
  enemy: {
    /** Enemy movement interval (ms) */
    movementInterval: 600,
    /** Default attack miss chance (0.0 - 1.0) */
    fallbackMissChance: 0.25,
    /** Stealth assassination miss chance (0.0 - 1.0) */
    stealthMissChance: 0.25,
    vision: {
      /** Range offset in tiles for enemy awareness (each direction) */
      range: 2,
      /** Duration of the alert icon (ms) */
      alertDuration: 1000,
    },
  },

  /**
   * Animation and visual effects configuration
   */
  animation: {
    /** Tile animation interval (ms) */
    tileInterval: 320,
    /** Minimum animation interval (ms) */
    minInterval: 60,
    /** Duration of icon over player (ms) */
    iconOverPlayerDuration: 2000,
    /** Frame rate for overlays (FPS) */
    overlayFPS: 30,
    /** Blink interval in overlays (ms) */
    blinkInterval: 500,
    /** Minimum blink opacity (0.0 - 1.0) */
    blinkMinOpacity: 0.3,
    /** Maximum blink opacity (0.0 - 1.0) */
    blinkMaxOpacity: 0.95,
  },

  /**
   * Visual effects configuration
   */
  effects: {
    /** Default combat indicator duration (ms) */
    combatIndicatorDuration: 600,
    /** Minimum screen flash duration (ms) */
    screenFlashMinDuration: 16,
    /** Default screen flash duration (ms) */
    screenFlashDuration: 140,
    /** Minimum edge flash duration (ms) */
    edgeFlashMinDuration: 32,
    /** Default edge flash duration (ms) */
    edgeFlashDuration: 220,
  },

  /**
   * Transitions configuration
   */
  transitions: {
    /** Minimum room transition duration (ms) */
    roomMinDuration: 120,
    /** Default room transition duration (ms) */
    roomDuration: 320,
    /** Blocked movement duration (edge flash) (ms) */
    blockedMovementDuration: 240,
  },

  /**
   * Screen timing configuration
   */
  timing: {
    /** Time to reset after intro screen (ms) */
    resetAfterIntro: 2000,
    /** Time to reset after game over (ms) */
    resetAfterGameOver: 2000,
    /** Level-up celebration duration (ms) */
    levelUpCelebration: 3000,
    /** Minimum celebration duration (ms) */
    celebrationMinDuration: 300,
    /** Maximum celebration duration (ms) */
    celebrationMaxDuration: 3000,
  },

  /**
   * Input configuration
   */
  input: {
    /** Maximum input duration (ms) */
    maxDuration: 600,
  },

  /**
   * HUD configuration
   */
  hud: {
    /** HUD internal padding (pixels) */
    padding: 4,
    /** Spacing between HUD elements (pixels) */
    gap: 6,
    /** HUD background color */
    backgroundColor: '#000000',
  },

  /**
   * Tiles configuration
   */
  tiles: {
    /** Maximum tile value in legacy format */
    legacyMax: 15,
    /** Maximum tile value */
    valueMax: 255,
  },

  /**
   * Default color palette (PICO-8 style)
   */
  palette: {
    /** Array of 16 colors in hexadecimal format */
    colors: [
      '#000000', // 0 - Black
      '#1D2B53', // 1 - Dark blue
      '#7E2553', // 2 - Dark purple
      '#008751', // 3 - Dark green
      '#AB5236', // 4 - Brown
      '#5F574F', // 5 - Dark gray
      '#C2C3C7', // 6 - Light gray
      '#FFF1E8', // 7 - White
      '#FF004D', // 8 - Red
      '#FFA300', // 9 - Orange
      '#FFFF27', // 10 - Yellow
      '#00E756', // 11 - Green
      '#29ADFF', // 12 - Blue
      '#83769C', // 13 - Indigo
      '#FF77A8', // 14 - Pink
      '#FFCCAA', // 15 - Peach
    ],
  },
});

/**
 * Type helper for game configuration
 */
export type GameConfigType = typeof GameConfig;
