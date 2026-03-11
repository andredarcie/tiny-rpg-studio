import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorHistoryManager } from '../../editor/modules/EditorHistoryManager';
import type { EditorManager } from '../../editor/EditorManager';

describe('EditorHistoryManager', () => {
  const snapshotA = JSON.stringify({ level: 1 });
  const snapshotB = JSON.stringify({ level: 2 });
  const snapshotC = JSON.stringify({ level: 3 });

  let exportGameData: ReturnType<typeof vi.fn>;
  let restore: ReturnType<typeof vi.fn>;
  let editorManager: EditorManager;

  beforeEach(() => {
    exportGameData = vi.fn(() => ({ level: 1 }));
    restore = vi.fn();
    editorManager = {
      gameEngine: {
        exportGameData,
      },
      restore,
    } as unknown as EditorManager;
  });

  it('should push snapshots and ignore duplicates', () => {
    const history = new EditorHistoryManager(editorManager);

    history.pushSnapshot(snapshotA);
    history.pushSnapshot(snapshotA);

    expect(history.stack).toEqual([snapshotA]);
    expect(history.index).toBe(0);
  });

  it('should truncate redo history when pushing new snapshots', () => {
    const history = new EditorHistoryManager(editorManager);

    history.pushSnapshot(snapshotA);
    history.pushSnapshot(snapshotB);
    history.undo();
    history.pushSnapshot(snapshotC);

    expect(history.stack).toEqual([snapshotA, snapshotC]);
    expect(history.index).toBe(1);
  });

  it('should create snapshots from the current state', () => {
    const history = new EditorHistoryManager(editorManager);

    history.pushCurrentState();

    expect(exportGameData).toHaveBeenCalledTimes(1);
    expect(history.stack[0]).toBe(snapshotA);
  });

  it('should restore previous snapshots on undo/redo', () => {
    const history = new EditorHistoryManager(editorManager);

    history.pushSnapshot(snapshotA);
    history.pushSnapshot(snapshotB);

    history.undo();
    expect(restore).toHaveBeenCalledWith({ level: 1 }, { skipHistory: true });

    history.redo();
    expect(restore).toHaveBeenCalledWith({ level: 2 }, { skipHistory: true });
  });

  it('should handle corrupted snapshots without crashing', () => {
    const history = new EditorHistoryManager(editorManager);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    history.pushSnapshot(snapshotA);
    history.pushSnapshot('NOT VALID JSON {{{');

    history.restoreCurrent();

    expect(restore).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to restore snapshot at index',
      1,
      expect.any(SyntaxError),
    );
    expect(history.stack).toEqual([snapshotA]);
    expect(history.index).toBe(0);

    consoleSpy.mockRestore();
  });
});

describe('EditorHistoryManager - customSprites', () => {
  it('includes customSprites in the snapshot when exportGameData returns them', () => {
    const customSprites = [
      { group: 'npc', key: 'wizard', variant: 'base', frames: [[[ 0, 1 ]]] },
    ];
    const exportFn = vi.fn(() => ({ level: 1, customSprites }));
    const restoreFn = vi.fn();
    const manager = {
      gameEngine: { exportGameData: exportFn },
      restore: restoreFn,
    } as unknown as EditorManager;

    const history = new EditorHistoryManager(manager);
    history.pushCurrentState();

    expect(exportFn).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(history.stack[0]) as Record<string, unknown>;
    expect(parsed.customSprites).toEqual(customSprites);
  });

  it('restoreCurrent restores customSprites into the editor manager', () => {
    const customSpritesA = [{ group: 'tile', key: 'rock', variant: 'base', frames: [[[3]]] }];
    const customSpritesB = [{ group: 'enemy', key: 'goblin', variant: 'base', frames: [[[7]]] }];
    const exportFn = vi.fn()
      .mockReturnValueOnce({ level: 1, customSprites: customSpritesA })
      .mockReturnValueOnce({ level: 2, customSprites: customSpritesB });
    const restoreFn = vi.fn();
    const manager = {
      gameEngine: { exportGameData: exportFn },
      restore: restoreFn,
    } as unknown as EditorManager;

    const history = new EditorHistoryManager(manager);
    history.pushCurrentState(); // snapshot with customSpritesA
    history.pushCurrentState(); // snapshot with customSpritesB

    history.undo();

    expect(restoreFn).toHaveBeenCalledWith(
      expect.objectContaining({ customSprites: customSpritesA }),
      { skipHistory: true }
    );
  });
});
