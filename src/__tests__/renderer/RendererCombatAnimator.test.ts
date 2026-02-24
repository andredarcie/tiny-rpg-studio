
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RendererCombatAnimator } from '../../runtime/adapters/renderer/RendererCombatAnimator';

type CombatRendererApi = ConstructorParameters<typeof RendererCombatAnimator>[0];
type CombatRendererFixture = ReturnType<typeof makeRenderer>;

function asRendererApi(renderer: CombatRendererFixture): CombatRendererApi {
  return renderer as unknown as CombatRendererApi;
}

function makeRenderer(playerPos: { x: number; y: number } | null = { x: 5, y: 5 }) {
  const pauseGame = vi.fn();
  const resumeGame = vi.fn();

  return {
    canvas: document.createElement('canvas'),
    ctx: null,
    gameState: {
      state: playerPos ? { player: { ...playerPos } } : undefined,
      pauseGame,
      resumeGame,
    },
    gameEngine: {},
    tileManager: {},
    paletteManager: {},
    spriteFactory: {},
    canvasHelper: {},
    entityRenderer: {},
    attackTelegraph: { activateTelegraph: vi.fn() },
    draw: vi.fn(),
  };
}

describe('RendererCombatAnimator', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  // ─── constructor / isAnimating ───────────────────────────────────────────

  it('initializes with active=false', () => {
    const renderer = makeRenderer();
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    expect(animator.isAnimating()).toBe(false);
  });

  it('hitstopTimer is null initially', () => {
    const renderer = makeRenderer();
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    expect(animator.hitstopTimer).toBeNull();
  });

  // ─── startLungeAttack ────────────────────────────────────────────────────

  it('calls activateTelegraph with direction to target', () => {
    const renderer = makeRenderer({ x: 3, y: 3 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    const onComplete = vi.fn();
    animator.startLungeAttack('player', { x: 4, y: 3 }, onComplete);
    expect(renderer.attackTelegraph.activateTelegraph).toHaveBeenCalledWith('player', { x: 1, y: 0 });
  });

  it('calls onComplete after lunge duration', () => {
    const renderer = makeRenderer({ x: 3, y: 3 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    const onComplete = vi.fn();
    animator.startLungeAttack('player', { x: 4, y: 3 }, onComplete);
    expect(onComplete).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(onComplete).toHaveBeenCalled();
  });

  it('calls onComplete immediately when player not found', () => {
    const renderer = makeRenderer(null);
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    const onComplete = vi.fn();
    animator.startLungeAttack('player', { x: 4, y: 3 }, onComplete);
    expect(onComplete).toHaveBeenCalled();
  });

  it('does not throw when onComplete is not provided', () => {
    const renderer = makeRenderer({ x: 3, y: 3 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    expect(() => animator.startLungeAttack('player', { x: 4, y: 3 })).not.toThrow();
    vi.runAllTimers();
  });

  // ─── startKnockback ──────────────────────────────────────────────────────

  it('calls onComplete immediately for non-player entity', () => {
    const renderer = makeRenderer();
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    const onComplete = vi.fn();
    animator.startKnockback('enemy-1', { x: 1, y: 0 }, onComplete);
    expect(onComplete).toHaveBeenCalled();
    expect(animator.isAnimating()).toBe(false);
  });

  it('calls onComplete immediately when player not found', () => {
    const renderer = makeRenderer(null);
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    const onComplete = vi.fn();
    animator.startKnockback('player', { x: 1, y: 0 }, onComplete);
    expect(onComplete).toHaveBeenCalled();
  });

  it('starts animation and sets isAnimating to true', () => {
    const renderer = makeRenderer({ x: 5, y: 5 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.startKnockback('player', { x: 1, y: 0 });
    expect(animator.isAnimating()).toBe(true);
  });

  it('pauses game when knockback animation starts', () => {
    const renderer = makeRenderer({ x: 5, y: 5 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.startKnockback('player', { x: 1, y: 0 });
    expect(renderer.gameState.pauseGame).toHaveBeenCalledWith('combat-animation');
  });

  it('animation entity and positions set correctly', () => {
    const renderer = makeRenderer({ x: 5, y: 5 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.startKnockback('player', { x: -1, y: 0 });
    expect(animator.animation.entity).toBe('player');
    expect(animator.animation.from).toEqual({ x: 5, y: 5 });
    expect(animator.animation.to).toEqual({ x: 4, y: 5 });
  });

  // ─── getEntityRenderPosition ─────────────────────────────────────────────

  it('returns undefined when no animation active', () => {
    const renderer = makeRenderer();
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    expect(animator.getEntityRenderPosition('player')).toBeUndefined();
  });

  it('returns undefined when animating different entity', () => {
    const renderer = makeRenderer({ x: 5, y: 5 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.startKnockback('player', { x: 1, y: 0 });
    expect(animator.getEntityRenderPosition('enemy-1')).toBeUndefined();
  });

  it('returns position for player during knockback', () => {
    const renderer = makeRenderer({ x: 5, y: 5 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.startKnockback('player', { x: 1, y: 0 });
    // At start, progress ≈ 0, should return near fromX
    const pos = animator.getEntityRenderPosition('player');
    expect(pos).toBeDefined();
    if (!pos) throw new Error('position should exist');
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  it('returns undefined when from/to not set', () => {
    const renderer = makeRenderer({ x: 5, y: 5 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    // Manually set animation without from/to
    animator.animation = { active: true, entity: 'player', type: 'knockback' };
    expect(animator.getEntityRenderPosition('player')).toBeUndefined();
  });

  // ─── cancel ─────────────────────────────────────────────────────────────

  it('cancel stops active animation', () => {
    const renderer = makeRenderer({ x: 5, y: 5 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.startKnockback('player', { x: 1, y: 0 });
    animator.cancel();
    expect(animator.isAnimating()).toBe(false);
  });

  it('cancel calls resumeGame when animation was active', () => {
    const renderer = makeRenderer({ x: 5, y: 5 });
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.startKnockback('player', { x: 1, y: 0 });
    vi.clearAllMocks();
    animator.cancel();
    expect(renderer.gameState.resumeGame).toHaveBeenCalledWith('combat-animation');
  });

  it('cancel does not call resumeGame when animation was not active', () => {
    const renderer = makeRenderer();
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.cancel();
    expect(renderer.gameState.resumeGame).not.toHaveBeenCalled();
  });

  it('cancel also cancels active hitstopTimer', () => {
    const renderer = makeRenderer();
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.freezeFrame(100);
    vi.clearAllMocks();
    animator.cancel();
    expect(animator.hitstopTimer).toBeNull();
    expect(renderer.gameState.resumeGame).toHaveBeenCalledWith('hitstop');
  });

  // ─── freezeFrame ────────────────────────────────────────────────────────

  it('pauses game for freeze duration', () => {
    const renderer = makeRenderer();
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.freezeFrame(50);
    expect(renderer.gameState.pauseGame).toHaveBeenCalledWith('hitstop');
  });

  it('resumes game after freeze duration expires', () => {
    const renderer = makeRenderer();
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.freezeFrame(50);
    vi.advanceTimersByTime(50);
    expect(renderer.gameState.resumeGame).toHaveBeenCalledWith('hitstop');
    expect(animator.hitstopTimer).toBeNull();
  });

  it('cancels existing hitstop before starting new one', () => {
    const renderer = makeRenderer();
    const animator = new RendererCombatAnimator(asRendererApi(renderer));
    animator.freezeFrame(100);
    vi.clearAllMocks();
    animator.freezeFrame(50); // Second call should cancel first
    // resumeGame should be called to cancel first freeze
    expect(renderer.gameState.resumeGame).toHaveBeenCalledWith('hitstop');
    expect(renderer.gameState.pauseGame).toHaveBeenCalledWith('hitstop');
  });
});


