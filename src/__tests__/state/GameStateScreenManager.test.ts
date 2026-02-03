import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameStateScreenManager } from '../../runtime/domain/state/GameStateScreenManager';

describe('GameStateScreenManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks active ending text', () => {
    const manager = new GameStateScreenManager({});

    expect(manager.getActiveEndingText()).toBe('');
    expect(manager.setActiveEndingText('  The End  ')).toBe('The End');
    expect(manager.getActiveEndingText()).toBe('The End');
  });

  it('resets state and clears cooldown', () => {
    const manager = new GameStateScreenManager({});

    manager.setActiveEndingText('Final');
    manager.startGameOverCooldown(1000);
    manager.reset();

    expect(manager.getActiveEndingText()).toBe('');
    expect(manager.canResetAfterGameOver).toBe(false);
    expect(manager.gameOverResetTimer).toBeNull();
  });

  it('starts and clears the game over cooldown', () => {
    const manager = new GameStateScreenManager({});

    manager.startGameOverCooldown(500);
    expect(manager.canResetAfterGameOver).toBe(false);
    expect(manager.gameOverResetTimer).not.toBeNull();

    vi.advanceTimersByTime(500);

    expect(manager.canResetAfterGameOver).toBe(true);
    expect(manager.gameOverResetTimer).toBeNull();
  });
});
