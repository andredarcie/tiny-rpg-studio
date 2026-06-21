import { describe, expect, it } from 'vitest';
import { resolveChoiceDialog, resolveNpcDialog } from '../../runtime/services/engine/resolveNpcDialog';
import type { NpcDialogResolverGameState, NpcDialogState } from '../../runtime/services/engine/resolveNpcDialog';

const makeGameState = (
  overrides: Partial<{ onVars: string[]; skills: string[]; answered: string[] }> = {},
): NpcDialogResolverGameState => {
  const onVars = new Set(overrides.onVars ?? []);
  const skills = new Set(overrides.skills ?? []);
  const answered = new Set(overrides.answered ?? []);
  return {
    // A variable id is "valid" when it looks like var-N; otherwise it normalizes to null.
    normalizeVariableId: (id) => (typeof id === 'string' && /^var-\d+$/.test(id) ? id : (id === 'skill:bard' ? id : null)),
    isVariableOn: (id) => onVars.has(id),
    hasSkill: (id) => skills.has(id),
    hasAnsweredChoice: (npcId) => (npcId ? answered.has(npcId) : false),
  };
};

describe('resolveNpcDialog — simple dialog', () => {
  it('returns the default text and never a choice', () => {
    const resolved = resolveNpcDialog(
      { id: 'npc-1', text: 'Hello there', choiceEnabled: true, choicePrompt: 'Accept?' },
      makeGameState(),
    );
    expect(resolved.kind).toBe('simple');
    expect(resolved.text).toBe('Hello there');
    expect(resolved.choices).toBeNull();
  });

  it('swaps to the conditional text when the condition is active', () => {
    const npc: NpcDialogState = {
      id: 'npc-1',
      text: 'Default',
      conditionText: 'Conditional',
      conditionVariableId: 'var-1',
    };
    expect(resolveNpcDialog(npc, makeGameState({ onVars: ['var-1'] })).text).toBe('Conditional');
    expect(resolveNpcDialog(npc, makeGameState({ onVars: [] })).text).toBe('Default');
  });
});

describe('resolveChoiceDialog — choice question', () => {
  const baseChoice: NpcDialogState = {
    id: 'npc-1',
    text: 'plain line',
    choiceEnabled: true,
    choicePrompt: 'Accept the quest?',
    choiceYesText: 'Great!',
    choiceNoText: 'Too bad.',
    choiceYesVariableId: 'var-3',
    choiceNoVariableId: 'var-5',
  };

  it('returns a choice when enabled with a prompt and no condition', () => {
    const resolved = resolveChoiceDialog(baseChoice, makeGameState());

    expect(resolved).not.toBeNull();
    expect(resolved?.kind).toBe('choice');
    expect(resolved?.text).toBe('Accept the quest?');
    expect(resolved?.variantKey).toBe('choice:Accept the quest?');
    expect(resolved?.choices).toEqual({
      yes: { text: 'Great!', rewardVariableId: 'var-3' },
      no: { text: 'Too bad.', rewardVariableId: 'var-5' },
    });
  });

  it('normalizes invalid branch reward variables to null', () => {
    const resolved = resolveChoiceDialog(
      { ...baseChoice, choiceYesVariableId: 'bogus', choiceNoVariableId: null },
      makeGameState(),
    );
    expect(resolved?.choices?.yes.rewardVariableId).toBeNull();
    expect(resolved?.choices?.no.rewardVariableId).toBeNull();
  });

  it('returns null when the prompt is empty', () => {
    expect(resolveChoiceDialog({ ...baseChoice, choicePrompt: '   ' }, makeGameState())).toBeNull();
  });

  it('returns null when choiceEnabled is false', () => {
    expect(resolveChoiceDialog({ ...baseChoice, choiceEnabled: false }, makeGameState())).toBeNull();
  });

  it('locks the choice once it has been answered (definitive choice)', () => {
    expect(resolveChoiceDialog(baseChoice, makeGameState({ answered: ['npc-1'] }))).toBeNull();
  });

  it('calls normalizeVariableId with its receiver (preserves `this`)', () => {
    // Regression: resolveChoiceDialog must not detach normalizeVariableId from gameState,
    // otherwise a real GameState method that uses `this` (delegating to variableManager)
    // throws "Cannot read properties of undefined (reading 'variableManager')".
    const gameState = {
      validIds: new Set(['var-3', 'var-5']),
      normalizeVariableId(id: string | null): string | null {
        return typeof id === 'string' && this.validIds.has(id) ? id : null;
      },
      isVariableOn: () => false,
      hasSkill: () => false,
      hasAnsweredChoice: () => false,
    };

    expect(() => resolveChoiceDialog(baseChoice, gameState)).not.toThrow();
    const resolved = resolveChoiceDialog(baseChoice, gameState);
    expect(resolved?.choices?.yes.rewardVariableId).toBe('var-3');
    expect(resolved?.choices?.no.rewardVariableId).toBe('var-5');
  });

  it('is independent of the condition (it only swaps the default dialog text)', () => {
    const gated: NpcDialogState = { ...baseChoice, conditionVariableId: 'var-7' };
    // The choice shows whether the condition variable is active or not.
    expect(resolveChoiceDialog(gated, makeGameState({ onVars: ['var-7'] }))?.kind).toBe('choice');
    expect(resolveChoiceDialog(gated, makeGameState({ onVars: [] }))?.kind).toBe('choice');
  });
});
