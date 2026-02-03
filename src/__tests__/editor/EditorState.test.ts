import { describe, it, expect } from 'vitest';
import { EditorState } from '../../editor/modules/EditorState';

describe('EditorState', () => {
  it('should initialize with expected defaults', () => {
    const state = new EditorState();

    expect(state.selectedTileId).toBeNull();
    expect(state.selectedNpcId).toBeNull();
    expect(state.selectedNpcType).toBeNull();
    expect(state.activeRoomIndex).toBe(0);
    expect(state.placingNpc).toBe(false);
    expect(state.placingEnemy).toBe(false);
    expect(state.placingObjectType).toBeNull();
    expect(state.selectedObjectType).toBeNull();
    expect(state.selectedEnemyType).toBeNull();
    expect(state.mapPainting).toBe(false);
    expect(state.skipMapHistory).toBe(false);
    expect(state.npcTextUpdateTimer).toBeNull();
    expect(state.suppressNpcFormUpdates).toBe(false);
    expect(state.conditionalDialogueExpanded).toBe(false);
    expect(state.activeMobilePanel).toBe('tiles');
    expect(state.npcVariantFilter).toBe('human');
    expect(state.playerEndTextUpdateTimer).toBeNull();
    expect(state.variablePanelCollapsed).toBe(true);
    expect(state.skillPanelCollapsed).toBe(true);
    expect(state.testPanelCollapsed).toBe(true);
  });
});
