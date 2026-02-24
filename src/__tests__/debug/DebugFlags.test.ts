import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebugFlags } from '../../runtime/debug/DebugFlags';

describe('DebugFlags', () => {
  beforeEach(() => {
    DebugFlags.setEnemyVision(false);
    vi.restoreAllMocks();
  });

  it('returns the current enemy vision flag', () => {
    expect(DebugFlags.showEnemyVision).toBe(false);

    DebugFlags.setEnemyVision(true);

    expect(DebugFlags.showEnemyVision).toBe(true);
  });

  it('toggles enemy vision on and logs the ON state', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = DebugFlags.toggleEnemyVision();

    expect(result).toBe(true);
    expect(DebugFlags.showEnemyVision).toBe(true);
    expect(logSpy).toHaveBeenCalledWith('[Debug] Enemy vision overlay: ON');
  });

  it('toggles enemy vision off and logs the OFF state', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    DebugFlags.setEnemyVision(true);

    const result = DebugFlags.toggleEnemyVision();

    expect(result).toBe(false);
    expect(DebugFlags.showEnemyVision).toBe(false);
    expect(logSpy).toHaveBeenCalledWith('[Debug] Enemy vision overlay: OFF');
  });
});
