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
});
