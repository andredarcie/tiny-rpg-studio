/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorVariableService } from '../../editor/modules/EditorVariableService';

function makeManager(stateOverrides: Record<string, unknown> = {}) {
  const state: Record<string, unknown> = {
    selectedNpcId: null, selectedNpcType: null, ...stateOverrides
  };
  return {
    state,
    domCache: {},
    renderService: { renderObjects: vi.fn() },
    npcService: { updateNpcSelection: vi.fn() },
    history: { pushCurrentState: vi.fn() },
    updateJSON: vi.fn(),
    gameEngine: {
      getVariableDefinitions: vi.fn(() => [
        { id: 'var-1', value: false },
        { id: 'var-2', value: true },
      ]),
      setVariableDefault: vi.fn(() => true),
      draw: vi.fn(),
    },
  };
}

describe('EditorVariableService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when variableId is empty', () => {
    const mgr = makeManager();
    const svc = new EditorVariableService(mgr as any);
    svc.toggle('');
    expect(mgr.gameEngine.setVariableDefault).not.toHaveBeenCalled();
  });

  it('toggles false → true when nextValue is null and current value is false', () => {
    const mgr = makeManager();
    const svc = new EditorVariableService(mgr as any);
    svc.toggle('var-1');
    expect(mgr.gameEngine.setVariableDefault).toHaveBeenCalledWith('var-1', true);
  });

  it('toggles true → false when nextValue is null and current value is true', () => {
    const mgr = makeManager();
    const svc = new EditorVariableService(mgr as any);
    svc.toggle('var-2');
    expect(mgr.gameEngine.setVariableDefault).toHaveBeenCalledWith('var-2', false);
  });

  it('uses nextValue when provided instead of toggling', () => {
    const mgr = makeManager();
    const svc = new EditorVariableService(mgr as any);
    svc.toggle('var-1', true);
    expect(mgr.gameEngine.setVariableDefault).toHaveBeenCalledWith('var-1', true);
    svc.toggle('var-2', false);
    expect(mgr.gameEngine.setVariableDefault).toHaveBeenCalledWith('var-2', false);
  });

  it('calls full render chain when change succeeds', () => {
    const mgr = makeManager({ selectedNpcType: 'villager', selectedNpcId: 'npc-1' });
    const svc = new EditorVariableService(mgr as any);
    svc.toggle('var-1');
    expect(mgr.renderService.renderObjects).toHaveBeenCalled();
    expect(mgr.npcService.updateNpcSelection).toHaveBeenCalledWith('villager', 'npc-1');
    expect(mgr.gameEngine.draw).toHaveBeenCalled();
    expect(mgr.updateJSON).toHaveBeenCalled();
    expect(mgr.history.pushCurrentState).toHaveBeenCalled();
  });

  it('skips render chain when setVariableDefault returns false', () => {
    const mgr = makeManager();
    mgr.gameEngine.setVariableDefault.mockReturnValue(false);
    const svc = new EditorVariableService(mgr as any);
    svc.toggle('var-1');
    expect(mgr.renderService.renderObjects).not.toHaveBeenCalled();
  });

  it('defaults current value to false when variable id not found', () => {
    const mgr = makeManager();
    const svc = new EditorVariableService(mgr as any);
    svc.toggle('unknown-var');
    // undefined?.value is falsy → target is true
    expect(mgr.gameEngine.setVariableDefault).toHaveBeenCalledWith('unknown-var', true);
  });
});


