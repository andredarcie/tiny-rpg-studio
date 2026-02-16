/**
 * Strongly-typed and validated game configuration schema
 *
 * This schema ensures all configuration values are valid and type-safe.
 * It prevents invalid configurations at compile-time and runtime.
 */

export interface GameCanvasConfig {
  readonly width: number;
  readonly height: number;
  readonly minTileSize: number;
  readonly minHudHeight: number;
  readonly hudHeightMultiplier: number;
  readonly minInventoryHeight: number;
  readonly inventoryHeightMultiplier: number;
}

export interface GameWorldConfig {
  readonly rows: number;
  readonly cols: number;
  readonly roomSize: number;
  readonly matrixSize: number;
}

export interface GamePlayerConfig {
  readonly startX: number;
  readonly startY: number;
  readonly startRoomIndex: number;
  readonly startLevel: number;
  readonly maxLevel: number;
  readonly baseMaxLives: number;
  readonly startLives: number;
  readonly experienceBase: number;
  readonly experienceGrowth: number;
  readonly maxKeys: number;
  readonly roomChangeDamageCooldown: number;
}

export interface GameCombatScreenShakeConfig {
  readonly enabled: boolean;
  readonly minIntensity: number;
  readonly maxIntensity: number;
  readonly baseDuration: number;
  readonly intensityPerDamage: number;
}

export interface GameCombatFloatingNumbersConfig {
  readonly enabled: boolean;
  readonly duration: number;
  readonly riseSpeed: number;
  readonly fontSize: number;
}

export interface GameCombatParticlesConfig {
  readonly enabled: boolean;
  readonly impactCount: number;
  readonly criticalImpactCount: number;
  readonly deathCount: number;
  readonly lifetime: number;
  readonly gravity: number;
}

export interface GameCombatTelegraphConfig {
  readonly enabled: boolean;
  readonly color: string;
  readonly pulseSpeed: number;
  readonly triggerDistance: number;
}

export interface GameCombatMessageDurationConfig {
  readonly standard: number;
  readonly cooldown: number;
  readonly death: number;
}

export interface GameCombatConfig {
  readonly attackCooldown: number;
  readonly hitStunDuration: number;
  readonly lungeAnimationDuration: number;
  readonly knockbackDuration: number;
  readonly deathAnimationDuration: number;
  readonly screenShake: GameCombatScreenShakeConfig;
  readonly hitFlashDuration: number;
  readonly hitstopDuration: number;
  readonly hitstopMinDamage: number;
  readonly entityFlashDuration: number;
  readonly messageDuration: GameCombatMessageDurationConfig;
  readonly floatingNumbers: GameCombatFloatingNumbersConfig;
  readonly particles: GameCombatParticlesConfig;
  readonly telegraph: GameCombatTelegraphConfig;
}

export interface GameEnemyVisionConfig {
  readonly range: number;
  readonly alertDuration: number;
}

export interface GameEnemyConfig {
  readonly movementInterval: number;
  readonly fallbackMissChance: number;
  readonly stealthMissChance: number;
  readonly vision: GameEnemyVisionConfig;
}

export interface GameAnimationConfig {
  readonly tileInterval: number;
  readonly minInterval: number;
  readonly iconOverPlayerDuration: number;
  readonly overlayFPS: number;
  readonly blinkInterval: number;
  readonly blinkMinOpacity: number;
  readonly blinkMaxOpacity: number;
}

export interface GameEffectsConfig {
  readonly combatIndicatorDuration: number;
  readonly screenFlashMinDuration: number;
  readonly screenFlashDuration: number;
  readonly edgeFlashMinDuration: number;
  readonly edgeFlashDuration: number;
}

export interface GameTransitionsConfig {
  readonly roomMinDuration: number;
  readonly roomDuration: number;
  readonly blockedMovementDuration: number;
}

export interface GameTimingConfig {
  readonly resetAfterIntro: number;
  readonly resetAfterGameOver: number;
  readonly levelUpCelebration: number;
  readonly celebrationMinDuration: number;
  readonly celebrationMaxDuration: number;
}

export interface GameInputConfig {
  readonly maxDuration: number;
}

export interface GameHudConfig {
  readonly padding: number;
  readonly gap: number;
  readonly backgroundColor: string;
}

export interface GameTilesConfig {
  readonly legacyMax: number;
  readonly valueMax: number;
}

export interface GamePaletteConfig {
  readonly colors: readonly string[];
}

export interface GameDebugConfig {
  readonly showEnemyVision: boolean;
  readonly visionOverlayColor: string;
  readonly visionOverlayOpacity: number;
}

/**
 * Type helpers for accessing nested config types
 */
export type GameConfigShape = {
  canvas: GameCanvasConfig;
  world: GameWorldConfig;
  player: GamePlayerConfig;
  combat: GameCombatConfig;
  enemy: GameEnemyConfig;
  animation: GameAnimationConfig;
  effects: GameEffectsConfig;
  transitions: GameTransitionsConfig;
  timing: GameTimingConfig;
  input: GameInputConfig;
  hud: GameHudConfig;
  tiles: GameTilesConfig;
  palette: GamePaletteConfig;
  debug: GameDebugConfig;
};

/**
 * Main game configuration class with validation
 */
export class GameConfigSchema {
  private _canvas: GameCanvasConfig;
  private _world: GameWorldConfig;
  private _player: GamePlayerConfig;
  private _combat: GameCombatConfig;
  private _enemy: GameEnemyConfig;
  private _animation: GameAnimationConfig;
  private _effects: GameEffectsConfig;
  private _transitions: GameTransitionsConfig;
  private _timing: GameTimingConfig;
  private _input: GameInputConfig;
  private _hud: GameHudConfig;
  private _tiles: GameTilesConfig;
  private _palette: GamePaletteConfig;
  private _debug: GameDebugConfig;

  constructor(config: {
    canvas: GameCanvasConfig;
    world: GameWorldConfig;
    player: GamePlayerConfig;
    combat: GameCombatConfig;
    enemy: GameEnemyConfig;
    animation: GameAnimationConfig;
    effects: GameEffectsConfig;
    transitions: GameTransitionsConfig;
    timing: GameTimingConfig;
    input: GameInputConfig;
    hud: GameHudConfig;
    tiles: GameTilesConfig;
    palette: GamePaletteConfig;
    debug: GameDebugConfig;
  }) {
    this._canvas = this.validateCanvas(config.canvas);
    this._world = this.validateWorld(config.world);
    this._player = this.validatePlayer(config.player);
    this._combat = this.validateCombat(config.combat);
    this._enemy = this.validateEnemy(config.enemy);
    this._animation = this.validateAnimation(config.animation);
    this._effects = this.validateEffects(config.effects);
    this._transitions = this.validateTransitions(config.transitions);
    this._timing = this.validateTiming(config.timing);
    this._input = this.validateInput(config.input);
    this._hud = this.validateHud(config.hud);
    this._tiles = this.validateTiles(config.tiles);
    this._palette = this.validatePalette(config.palette);
    this._debug = this.validateDebug(config.debug);
  }

  // Getters
  get canvas(): GameCanvasConfig {
    return { ...this._canvas };
  }

  get world(): GameWorldConfig {
    return { ...this._world };
  }

  get player(): GamePlayerConfig {
    return { ...this._player };
  }

  get combat(): GameCombatConfig {
    return {
      attackCooldown: this._combat.attackCooldown,
      hitStunDuration: this._combat.hitStunDuration,
      lungeAnimationDuration: this._combat.lungeAnimationDuration,
      knockbackDuration: this._combat.knockbackDuration,
      deathAnimationDuration: this._combat.deathAnimationDuration,
      screenShake: { ...this._combat.screenShake },
      hitFlashDuration: this._combat.hitFlashDuration,
      hitstopDuration: this._combat.hitstopDuration,
      hitstopMinDamage: this._combat.hitstopMinDamage,
      entityFlashDuration: this._combat.entityFlashDuration,
      messageDuration: { ...this._combat.messageDuration },
      floatingNumbers: { ...this._combat.floatingNumbers },
      particles: { ...this._combat.particles },
      telegraph: { ...this._combat.telegraph },
    };
  }

    get enemy(): GameEnemyConfig {
      return {
        movementInterval: this._enemy.movementInterval,
        fallbackMissChance: this._enemy.fallbackMissChance,
        stealthMissChance: this._enemy.stealthMissChance,
        vision: { ...this._enemy.vision },
      };
    }

  get animation(): GameAnimationConfig {
    return { ...this._animation };
  }

  get effects(): GameEffectsConfig {
    return { ...this._effects };
  }

  get transitions(): GameTransitionsConfig {
    return { ...this._transitions };
  }

  get timing(): GameTimingConfig {
    return { ...this._timing };
  }

  get input(): GameInputConfig {
    return { ...this._input };
  }

  get hud(): GameHudConfig {
    return { ...this._hud };
  }

  get tiles(): GameTilesConfig {
    return { ...this._tiles };
  }

  get palette(): GamePaletteConfig {
    return { colors: [...this._palette.colors] };
  }

  get debug(): GameDebugConfig {
    return { ...this._debug };
  }

  // Validation methods
  private validateCanvas(canvas: GameCanvasConfig): GameCanvasConfig {
    this.assertPositiveInteger(canvas.width, 'canvas width');
    this.assertPositiveInteger(canvas.height, 'canvas height');
    this.assertPositiveInteger(canvas.minTileSize, 'min tile size');
    this.assertPositiveInteger(canvas.minHudHeight, 'min HUD height');
    this.assertPositiveNumber(canvas.hudHeightMultiplier, 'HUD height multiplier');
    this.assertPositiveInteger(canvas.minInventoryHeight, 'min inventory height');
    this.assertPositiveNumber(canvas.inventoryHeightMultiplier, 'inventory height multiplier');
    return Object.freeze({ ...canvas });
  }

  private validateWorld(world: GameWorldConfig): GameWorldConfig {
    this.assertPositiveInteger(world.rows, 'world rows');
    this.assertPositiveInteger(world.cols, 'world cols');
    this.assertPositiveInteger(world.roomSize, 'room size');
    this.assertPositiveInteger(world.matrixSize, 'matrix size');
    return Object.freeze({ ...world });
  }

  private validatePlayer(player: GamePlayerConfig): GamePlayerConfig {
    this.assertNonNegativeInteger(player.startX, 'start X');
    this.assertNonNegativeInteger(player.startY, 'start Y');
    this.assertNonNegativeInteger(player.startRoomIndex, 'start room index');
    this.assertPositiveInteger(player.startLevel, 'start level');
    this.assertPositiveInteger(player.maxLevel, 'max level');
    this.assertPositiveInteger(player.baseMaxLives, 'base max lives');
    this.assertPositiveInteger(player.startLives, 'start lives');
    this.assertPositiveNumber(player.experienceBase, 'experience base');
    this.assertPositiveNumber(player.experienceGrowth, 'experience growth');
    this.assertNonNegativeInteger(player.maxKeys, 'max keys');
    this.assertNonNegativeInteger(player.roomChangeDamageCooldown, 'room change damage cooldown');

    if (player.startLevel > player.maxLevel) {
      throw new Error(`Start level (${player.startLevel}) cannot exceed max level (${player.maxLevel})`);
    }
    if (player.startLives > player.baseMaxLives) {
      throw new Error(`Start lives (${player.startLives}) cannot exceed base max lives (${player.baseMaxLives})`);
    }

    return Object.freeze({ ...player });
  }

  private validateCombat(combat: GameCombatConfig): GameCombatConfig {
    this.assertNonNegativeInteger(combat.attackCooldown, 'attack cooldown');
    this.assertNonNegativeInteger(combat.hitStunDuration, 'hit stun duration');
    this.assertPositiveInteger(combat.lungeAnimationDuration, 'lunge animation duration');
    this.assertPositiveInteger(combat.knockbackDuration, 'knockback duration');
    this.assertPositiveInteger(combat.deathAnimationDuration, 'death animation duration');
    this.assertPositiveInteger(combat.hitFlashDuration, 'hit flash duration');
    this.assertNonNegativeInteger(combat.hitstopDuration, 'hitstop duration');
    this.assertNonNegativeInteger(combat.hitstopMinDamage, 'hitstop min damage');
    this.assertPositiveInteger(combat.entityFlashDuration, 'entity flash duration');

    // Validate message duration
    this.assertPositiveInteger(combat.messageDuration.standard, 'message duration standard');
    this.assertPositiveInteger(combat.messageDuration.cooldown, 'message duration cooldown');
    this.assertPositiveInteger(combat.messageDuration.death, 'message duration death');

    // Validate screen shake
    if (typeof combat.screenShake.enabled !== 'boolean') {
      throw new Error('Screen shake enabled must be a boolean');
    }
    this.assertProbability(combat.screenShake.minIntensity, 'screen shake min intensity');
    this.assertProbability(combat.screenShake.maxIntensity, 'screen shake max intensity');
    this.assertPositiveInteger(combat.screenShake.baseDuration, 'screen shake base duration');
    this.assertPositiveNumber(combat.screenShake.intensityPerDamage, 'screen shake intensity per damage');
    if (combat.screenShake.minIntensity > combat.screenShake.maxIntensity) {
      throw new Error(`Screen shake min intensity (${combat.screenShake.minIntensity}) cannot exceed max intensity (${combat.screenShake.maxIntensity})`);
    }

    // Validate floating numbers
    if (typeof combat.floatingNumbers.enabled !== 'boolean') {
      throw new Error('Floating numbers enabled must be a boolean');
    }
    this.assertPositiveInteger(combat.floatingNumbers.duration, 'floating numbers duration');
    this.assertPositiveNumber(combat.floatingNumbers.riseSpeed, 'floating numbers rise speed');
    this.assertPositiveInteger(combat.floatingNumbers.fontSize, 'floating numbers font size');

    // Validate particles
    if (typeof combat.particles.enabled !== 'boolean') {
      throw new Error('Particles enabled must be a boolean');
    }
    this.assertNonNegativeInteger(combat.particles.impactCount, 'particles impact count');
    this.assertNonNegativeInteger(combat.particles.criticalImpactCount, 'particles critical impact count');
    this.assertNonNegativeInteger(combat.particles.deathCount, 'particles death count');
    this.assertPositiveInteger(combat.particles.lifetime, 'particles lifetime');
    this.assertPositiveNumber(combat.particles.gravity, 'particles gravity');

    // Validate telegraph
    if (typeof combat.telegraph.enabled !== 'boolean') {
      throw new Error('Telegraph enabled must be a boolean');
    }
    if (typeof combat.telegraph.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(combat.telegraph.color)) {
      throw new Error('Telegraph color must be a valid hex color (#RRGGBB)');
    }
    this.assertPositiveNumber(combat.telegraph.pulseSpeed, 'telegraph pulse speed');
    this.assertPositiveInteger(combat.telegraph.triggerDistance, 'telegraph trigger distance');

    return Object.freeze({
      attackCooldown: combat.attackCooldown,
      hitStunDuration: combat.hitStunDuration,
      lungeAnimationDuration: combat.lungeAnimationDuration,
      knockbackDuration: combat.knockbackDuration,
      deathAnimationDuration: combat.deathAnimationDuration,
      screenShake: Object.freeze({ ...combat.screenShake }),
      hitFlashDuration: combat.hitFlashDuration,
      hitstopDuration: combat.hitstopDuration,
      hitstopMinDamage: combat.hitstopMinDamage,
      entityFlashDuration: combat.entityFlashDuration,
      messageDuration: Object.freeze({ ...combat.messageDuration }),
      floatingNumbers: Object.freeze({ ...combat.floatingNumbers }),
      particles: Object.freeze({ ...combat.particles }),
      telegraph: Object.freeze({ ...combat.telegraph }),
    });
  }

  private validateEnemy(enemy: GameEnemyConfig): GameEnemyConfig {
    this.assertPositiveInteger(enemy.movementInterval, 'enemy movement interval');
    this.assertProbability(enemy.fallbackMissChance, 'fallback miss chance');
    this.assertProbability(enemy.stealthMissChance, 'stealth miss chance');

    this.assertNonNegativeInteger(enemy.vision.range, 'enemy vision range');
    this.assertPositiveInteger(enemy.vision.alertDuration, 'enemy vision alert duration');

    return Object.freeze({
      movementInterval: enemy.movementInterval,
      fallbackMissChance: enemy.fallbackMissChance,
      stealthMissChance: enemy.stealthMissChance,
      vision: Object.freeze({ ...enemy.vision }),
    });
  }

  private validateAnimation(animation: GameAnimationConfig): GameAnimationConfig {
    this.assertPositiveInteger(animation.tileInterval, 'tile interval');
    this.assertPositiveInteger(animation.minInterval, 'min animation interval');
    this.assertPositiveInteger(animation.iconOverPlayerDuration, 'icon over player duration');
    this.assertPositiveInteger(animation.overlayFPS, 'overlay FPS');
    this.assertPositiveInteger(animation.blinkInterval, 'blink interval');
    this.assertProbability(animation.blinkMinOpacity, 'blink min opacity');
    this.assertProbability(animation.blinkMaxOpacity, 'blink max opacity');

    if (animation.blinkMinOpacity > animation.blinkMaxOpacity) {
      throw new Error(`Blink min opacity (${animation.blinkMinOpacity}) cannot exceed max opacity (${animation.blinkMaxOpacity})`);
    }

    return Object.freeze({ ...animation });
  }

  private validateEffects(effects: GameEffectsConfig): GameEffectsConfig {
    this.assertPositiveInteger(effects.combatIndicatorDuration, 'combat indicator duration');
    this.assertPositiveInteger(effects.screenFlashMinDuration, 'screen flash min duration');
    this.assertPositiveInteger(effects.screenFlashDuration, 'screen flash duration');
    this.assertPositiveInteger(effects.edgeFlashMinDuration, 'edge flash min duration');
    this.assertPositiveInteger(effects.edgeFlashDuration, 'edge flash duration');
    return Object.freeze({ ...effects });
  }

  private validateTransitions(transitions: GameTransitionsConfig): GameTransitionsConfig {
    this.assertPositiveInteger(transitions.roomMinDuration, 'room min duration');
    this.assertPositiveInteger(transitions.roomDuration, 'room duration');
    this.assertPositiveInteger(transitions.blockedMovementDuration, 'blocked movement duration');
    return Object.freeze({ ...transitions });
  }

  private validateTiming(timing: GameTimingConfig): GameTimingConfig {
    this.assertPositiveInteger(timing.resetAfterIntro, 'reset after intro');
    this.assertPositiveInteger(timing.resetAfterGameOver, 'reset after game over');
    this.assertPositiveInteger(timing.levelUpCelebration, 'level up celebration');
    this.assertPositiveInteger(timing.celebrationMinDuration, 'celebration min duration');
    this.assertPositiveInteger(timing.celebrationMaxDuration, 'celebration max duration');

    if (timing.celebrationMinDuration > timing.celebrationMaxDuration) {
      throw new Error(`Celebration min duration (${timing.celebrationMinDuration}) cannot exceed max duration (${timing.celebrationMaxDuration})`);
    }

    return Object.freeze({ ...timing });
  }

  private validateInput(input: GameInputConfig): GameInputConfig {
    this.assertPositiveInteger(input.maxDuration, 'input max duration');
    return Object.freeze({ ...input });
  }

  private validateHud(hud: GameHudConfig): GameHudConfig {
    this.assertNonNegativeInteger(hud.padding, 'HUD padding');
    this.assertNonNegativeInteger(hud.gap, 'HUD gap');
    if (typeof hud.backgroundColor !== 'string' || !this.isValidColor(hud.backgroundColor)) {
      throw new Error(`Invalid HUD background color: ${hud.backgroundColor}`);
    }
    return Object.freeze({ ...hud });
  }

  private validateTiles(tiles: GameTilesConfig): GameTilesConfig {
    this.assertPositiveInteger(tiles.legacyMax, 'legacy max tile value');
    this.assertPositiveInteger(tiles.valueMax, 'max tile value');
    return Object.freeze({ ...tiles });
  }

  private validatePalette(palette: GamePaletteConfig): GamePaletteConfig {
    if (!Array.isArray(palette.colors) || palette.colors.length === 0) {
      throw new Error('Palette colors must be a non-empty array');
    }
    palette.colors.forEach((color, index) => {
      if (typeof color !== 'string' || !this.isValidColor(color)) {
        throw new Error(`Invalid color at palette index ${index}: ${color}`);
      }
    });
    const colorsCopy = palette.colors.slice();
    const frozenColors = Object.freeze(colorsCopy) as readonly string[];
    return Object.freeze({ colors: frozenColors });
  }

  private validateDebug(debug: GameDebugConfig): GameDebugConfig {
    if (typeof debug.showEnemyVision !== 'boolean') {
      throw new Error('Debug showEnemyVision must be a boolean');
    }
    if (typeof debug.visionOverlayColor !== 'string' || !this.isValidColor(debug.visionOverlayColor)) {
      throw new Error(`Invalid debug visionOverlayColor: ${debug.visionOverlayColor}`);
    }
    if (typeof debug.visionOverlayOpacity !== 'number' || debug.visionOverlayOpacity < 0 || debug.visionOverlayOpacity > 1) {
      throw new Error(`Invalid debug visionOverlayOpacity: ${debug.visionOverlayOpacity}. Must be between 0 and 1.`);
    }
    return Object.freeze({ ...debug });
  }

  // Utility validation methods
  private assertPositiveInteger(value: number, name: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid ${name}: ${value}. Must be a positive integer.`);
    }
  }

  private assertNonNegativeInteger(value: number, name: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid ${name}: ${value}. Must be a non-negative integer.`);
    }
  }

  private assertPositiveNumber(value: number, name: string): void {
    if (typeof value !== 'number' || value <= 0 || !isFinite(value)) {
      throw new Error(`Invalid ${name}: ${value}. Must be a positive number.`);
    }
  }

  private assertProbability(value: number, name: string): void {
    if (typeof value !== 'number' || value < 0 || value > 1 || !isFinite(value)) {
      throw new Error(`Invalid ${name}: ${value}. Must be a number between 0 and 1.`);
    }
  }

  private isValidColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(color) ||
           /^[a-z]+$/i.test(color);
  }

  /**
   * Creates a deep immutable copy of the entire configuration
   */
  toJSON() {
    return {
      canvas: this.canvas,
      world: this.world,
      player: this.player,
      combat: this.combat,
      enemy: this.enemy,
      animation: this.animation,
      effects: this.effects,
      transitions: this.transitions,
      timing: this.timing,
      input: this.input,
      hud: this.hud,
      tiles: this.tiles,
      palette: this.palette,
    };
  }
}
