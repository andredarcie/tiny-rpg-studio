import { describe, expect, it, vi } from 'vitest';
import { NpcEditModal } from '../../editor/modules/NpcEditModal';

type ModalAccess = {
  conditionalExpanded: boolean;
  choiceExpanded: boolean;
  buildBody: (npc: Record<string, unknown>) => HTMLElement;
};

describe('NpcEditModal disappearance option', () => {
  it('reflects checked state and hides/restores alternative dialog controls', () => {
    const npcService = {
      populateVariableSelect: vi.fn(),
      updateNpcText: vi.fn(),
      updateNpcWander: vi.fn(),
      updateNpcWanderSpeed: vi.fn(),
      updateNpcConditionalText: vi.fn(),
      updateNpcChoicePrompt: vi.fn(),
      updateNpcChoiceYesText: vi.fn(),
      updateNpcChoiceNoText: vi.fn(),
      handleRewardVariableChange: vi.fn(),
      handleConditionVariableChange: vi.fn(),
      handleConditionalRewardVariableChange: vi.fn(),
      handleChoiceYesVariableChange: vi.fn(),
      handleChoiceNoVariableChange: vi.fn(),
      toggleChoiceEnabled: vi.fn(),
      updateNpcDisappearAfterDialog: vi.fn(),
    };
    const state = { selectedNpcId: 'npc-1', selectedNpcType: 'villager' };
    const service = {
      manager: { state, npcService },
      dom: { npcEditModal: null },
      state,
      gameEngine: {},
      t: (_key: string, fallback = '') => fallback,
      tf: (_key: string, _params: Record<string, unknown>, fallback = '') => fallback,
    };
    const modal = new NpcEditModal(service as never);
    const access = modal as unknown as ModalAccess;
    access.conditionalExpanded = true;
    access.choiceExpanded = true;

    const body = access.buildBody({
      id: 'npc-1', type: 'villager', roomIndex: 0,
      text: 'Bye', conditionText: 'Alternate', choiceEnabled: true,
      choicePrompt: 'Choose?', disappearAfterDialog: true,
    });
    const checkbox = body.querySelector<HTMLInputElement>('#npc-disappear-after-dialog');
    const textarea = body.querySelector<HTMLTextAreaElement>('#npc-default-dialog');
    const toggles = Array.from(body.querySelectorAll<HTMLButtonElement>('.npc-edit-modal__toggle'));
    const conditional = body.querySelector<HTMLElement>('.npc-conditional-section');
    const choice = body.querySelector<HTMLElement>('.npc-choice-section');
    const hintsButton = body.querySelector<HTMLButtonElement>('.npc-dialog-hints__button');
    const hintsBubble = document.body.querySelector<HTMLElement>('.npc-dialog-hints__bubble');

    const wander = body.querySelector<HTMLInputElement>('#npc-wander');
    const speed = body.querySelector<HTMLInputElement>('#npc-wander-speed');
    if (!wander || !speed) throw Error('Missing NPC movement controls');
    expect(wander.checked).toBe(false);
    expect(speed.value).toBe('1');
    expect([speed.min, speed.max, speed.step]).toEqual(['0', '2', '0.1']);
    expect(body.querySelector('label[for="npc-wander"]')).not.toBeNull();
    expect(body.querySelector('label[for="npc-wander-speed"]')).not.toBeNull();
    expect(body.children[0].className).toBe('npc-movement-row');
    expect(body.children[1].tagName).toBe('HR');
    expect(body.children[2].querySelector('.npc-dialog-heading')).not.toBeNull();
    expect(speed.disabled).toBe(false);
    speed.value = '0.5';
    speed.dispatchEvent(new Event('change'));
    expect(npcService.updateNpcWanderSpeed).toHaveBeenCalledWith(0.5);
    wander.checked = true;
    wander.dispatchEvent(new Event('change'));
    expect(npcService.updateNpcWander).toHaveBeenCalledWith(true);
    expect(checkbox?.checked).toBe(true);
    expect(body.querySelector('label[for="npc-default-dialog"]')).not.toBeNull();
    expect(body.querySelector('label[for="npc-disappear-after-dialog"]')).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(textarea?.parentElement?.classList.contains('object-config-label')).toBe(true);
    expect(body.querySelector('.object-config-hint')).toBeNull();
    expect(body.querySelector('.npc-dialog-hints__bubble')).toBeNull();
    expect(hintsBubble?.parentElement).toBe(document.body);
    expect(hintsButton?.textContent).toBe('i');
    expect(hintsButton?.getAttribute('aria-expanded')).toBe('false');
    expect(hintsBubble?.hidden).toBe(true);
    expect(hintsBubble?.querySelectorAll('li')).toHaveLength(5);

    hintsButton?.click();
    expect(hintsButton?.getAttribute('aria-expanded')).toBe('true');
    expect(hintsBubble?.hidden).toBe(false);
    expect(hintsBubble?.textContent).toContain('{wvy}text{wvy}');
    expect(hintsBubble?.textContent).toContain('{rbw}text{rbw}');
    expect(hintsBubble?.textContent).toContain('{shk}text{shk}');
    expect(hintsBubble?.textContent).toContain('[CLR15]');
    expect(hintsBubble?.style.top).not.toBe('');
    expect(hintsBubble?.style.right).not.toBe('');
    expect(hintsBubble?.dataset.placement).toBe('below');
    expect(toggles.every((toggle) => toggle.hidden)).toBe(true);
    expect(conditional?.hidden).toBe(true);
    expect(choice?.hidden).toBe(true);

    if (!checkbox) throw new Error('Expected disappearance checkbox.');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    expect(npcService.updateNpcDisappearAfterDialog).toHaveBeenCalledWith(false);
    expect(toggles.every((toggle) => !toggle.hidden)).toBe(true);
    expect(conditional?.hidden).toBe(false);
    expect(choice?.hidden).toBe(false);
  });
});
