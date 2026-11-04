export type GameplayDirection = 'left' | 'right' | 'up' | 'down';
export type GameplayPixels = readonly (readonly (string | null)[])[];
export type GameplayTileId = string | number;

export type GameplayTile = Readonly<{
    id: GameplayTileId;
    name: string;
    category: string;
    collision: boolean;
    visualEffect: string;
    mergeEdges: boolean;
    frames: readonly GameplayPixels[];
    pixels: GameplayPixels | null;
}>;

export type GameplayRoom = Readonly<{
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    backgroundIndex: number;
    background: string;
    exists: boolean;
}>;

export type GameplayCell = Readonly<{
    /** Full-height terrain; objects retain their transparent billboard sprites. */
    solid: boolean;
    /** Effective terrain and dynamic object blockers, without running interactions. */
    blocked: boolean;
    wall: GameplayPixels | null;
    floor: GameplayPixels | null;
    color: string;
    /** Original authoring layers, independent of the wall/floor/billboard interpretation. */
    groundTileId?: GameplayTileId | null;
    overlayTileId?: GameplayTileId | null;
    terrainWall?: boolean;
    roomIndex?: number;
    localX?: number;
    localY?: number;
}>;

export type GameplayBillboard = Readonly<{
    id: string;
    x: number;
    y: number;
    pixels: GameplayPixels;
    /** Unique for this runtime entity's lifetime; use for retained render objects. */
    key?: string;
    kind?: 'object' | 'npc' | 'enemy' | 'item' | 'remote-player' | 'tile';
    type?: string;
    roomIndex?: number;
    localX?: number;
    localY?: number;
    lives?: number;
    warning?: boolean;
    flash?: string | null;
}>;

export type GameplayScene = Readonly<{
    width: number;
    height: number;
    player: Readonly<{ x: number; y: number; roomIndex?: number; localX?: number; localY?: number;
        pixels?: GameplayPixels | null; facing?: 'left' | 'right'; lives?: number; maxLives?: number }>;
    ceiling: string;
    floor: string;
    boundary: string;
    cells: readonly GameplayCell[];
    entities: readonly GameplayBillboard[];
    /** Additive scene data; older engines and hand-built scenes may omit it. */
    world?: Readonly<{ rows: number; cols: number; roomSize: number; activeRoomIndex: number }>;
    rooms?: readonly GameplayRoom[];
    tiles?: readonly GameplayTile[];
    palette?: readonly string[];
    animationFrame?: number;
    animationIntervalMs?: number;
    customTileEffects?: readonly Readonly<{ id: string; name: string; baseEffectIds: readonly string[]; color?: string }>[];
    status?: Readonly<{ playing: boolean; gameOver: boolean; dialogActive: boolean }>;
}>;

export type GameplayFeedback = Readonly<{
    /** Latest enemy hit, retained across frames; sequence changes for each hit. */
    playerHit?: Readonly<{ sequence: number; sourceId?: string; x: number; y: number }> | null;
    /** Latest enemy attack targeting the player, including its wind-up. */
    incomingAttack?: Readonly<{ sequence: number; sourceId?: string; x: number; y: number }> | null;
    playerFlash: string | null;
    attacking: boolean;
    texts: readonly Readonly<{ text: string; x: number; y: number; color: string; opacity: number }>[];
    particles: readonly Readonly<{ x: number; y: number; color: string; opacity: number }>[];
}>;

export type GameplayFrame = Readonly<{
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    /** Monotonic milliseconds; delta is zero on the first frame after registration/reset. */
    timeMs?: number;
    deltaMs?: number;
    scene: GameplayScene;
    feedback: GameplayFeedback;
}>;

export type GameplayPresentation = {
    /** Return true to request another frame; the renderer owns animation scheduling. */
    draw(frame: GameplayFrame): boolean | void;
    direction(direction: GameplayDirection): readonly [number, number] | null;
    reset(): void;
};
