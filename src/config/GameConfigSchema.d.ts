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
export declare class GameConfigSchema {
    private _canvas;
    private _world;
    private _player;
    private _combat;
    private _enemy;
    private _animation;
    private _effects;
    private _transitions;
    private _timing;
    private _input;
    private _hud;
    private _tiles;
    private _palette;
    private _debug;
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
    });
    get canvas(): GameCanvasConfig;
    get world(): GameWorldConfig;
    get player(): GamePlayerConfig;
    get combat(): GameCombatConfig;
    get enemy(): GameEnemyConfig;
    get animation(): GameAnimationConfig;
    get effects(): GameEffectsConfig;
    get transitions(): GameTransitionsConfig;
    get timing(): GameTimingConfig;
    get input(): GameInputConfig;
    get hud(): GameHudConfig;
    get tiles(): GameTilesConfig;
    get palette(): GamePaletteConfig;
    get debug(): GameDebugConfig;
    private validateCanvas;
    private validateWorld;
    private validatePlayer;
    private validateCombat;
    private validateEnemy;
    private validateAnimation;
    private validateEffects;
    private validateTransitions;
    private validateTiming;
    private validateInput;
    private validateHud;
    private validateTiles;
    private validatePalette;
    private validateDebug;
    private assertPositiveInteger;
    private assertNonNegativeInteger;
    private assertPositiveNumber;
    private assertProbability;
    private isValidColor;
    /**
     * Creates a deep immutable copy of the entire configuration
     */
    toJSON(): {
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
    };
}
