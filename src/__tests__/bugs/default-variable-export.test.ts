import { describe, expect, it } from 'vitest';
import { GameState } from '../../runtime/domain/GameState';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';

type VariableEntry = { id: string; value: boolean };
type GameData = Record<string, unknown> & { variables?: VariableEntry[] };

const variableValue = (data: GameData | null, id: string): boolean | undefined =>
  data?.variables?.find((variable) => variable.id === id)?.value;

describe('Default variable state exports', () => {
  it('serializes authored defaults instead of live gameplay values', () => {
    const state = new GameState();
    state.setVariableValue('var-2', true, true);
    state.setVariableValue('var-1', true);
    state.setVariableValue('var-2', false);

    expect(state.isVariableOn('var-1')).toBe(true);
    expect(state.isVariableOn('var-2')).toBe(false);

    const exported = state.exportGameData() as GameData;
    const htmlPayload = ShareUtils.decode(ShareUtils.encode(exported)) as GameData;
    const shared = ShareUtils.extractGameDataFromShareUrl(
      ShareUtils.buildShareUrl(exported),
    ) as GameData;

    for (const decoded of [htmlPayload, shared]) {
      expect(variableValue(decoded, 'var-1')).toBe(false);
      expect(variableValue(decoded, 'var-2')).toBe(true);
    }

    state.resetGame();
    expect(state.isVariableOn('var-1')).toBe(false);
    expect(state.isVariableOn('var-2')).toBe(true);
  });

  it('keeps NOT-gate outputs authored off and derives them on after load', () => {
    const state = new GameState();
    state.game.objects = [{
      id: 'logic-gate-not-0',
      type: 'logic-gate-not',
      x: 1,
      y: 1,
      roomIndex: 0,
      inputVariableId: 'var-1',
      outputVariableId: 'var-2',
    }];
    state.resetGame();

    expect(state.isVariableOn('var-2')).toBe(true);

    const exported = state.exportGameData() as GameData;
    const decoded = ShareUtils.decode(ShareUtils.encode(exported)) as GameData;
    expect(variableValue(exported, 'var-2')).toBe(false);
    expect(variableValue(decoded, 'var-2')).toBe(false);

    const loaded = new GameState();
    loaded.importGameData(decoded);
    expect(variableValue(loaded.exportGameData() as GameData, 'var-2')).toBe(false);
    expect(loaded.isVariableOn('var-2')).toBe(true);

    loaded.resetGame();
    expect(loaded.isVariableOn('var-2')).toBe(true);
  });
});
