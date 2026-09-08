import { describe, expect, it, vi } from 'vitest';
import { EnemyEditModal } from '../../editor/modules/EnemyEditModal';

const makeFixture = (experience?: number) => {
  const host = document.createElement('div');
  host.id = 'enemy-edit-modal';
  host.hidden = true;
  document.body.appendChild(host);
  const enemy = {
    id: 'enemy-1', type: 'giant-rat', roomIndex: 0, x: 1, y: 2, lastX: 1,
    ...(experience === undefined ? {} : { experience }),
  };
  const handleEnemyExperienceChange = vi.fn();
  const service = {
    manager: {
      enemyService: {
        getEnemyDefinition: vi.fn(() => ({
          type: 'giant-rat', name: 'Rat', description: '', lives: 1, damage: 1,
          experience: 3, missChance: 0.1, hasEyes: true,
        })),
        handleEnemyExperienceChange,
        handleEnemyVariableChange: vi.fn(),
        startRepositioning: vi.fn(),
        removeEnemy: vi.fn(),
      },
      npcService: { populateVariableSelect: vi.fn() },
    },
    dom: { enemyEditModal: host },
    state: {},
    gameEngine: { getActiveEnemies: vi.fn(() => [enemy]) },
    enemyRenderer: {
      getEnemyDisplayName: vi.fn(() => 'Rat'),
      drawEnemyPreview: vi.fn(),
    },
    t: vi.fn((_key: string, fallback: string) => fallback),
    tf: vi.fn(),
  };
  return { host, modal: new EnemyEditModal(service as never), handleEnemyExperienceChange };
};

describe('EnemyEditModal custom experience', () => {
  it.each([[undefined, '3'], [0, '0'], [12, '12']] as const)(
    'renders the effective XP value for override %s',
    (experience, expected) => {
      const { host, modal } = makeFixture(experience);
      modal.open('enemy-1');
      const input = host.querySelector<HTMLInputElement>('input[type="number"]');
      expect(input?.value).toBe(expected);
      expect(input?.min).toBe('0');
      expect(input?.max).toBe('16');
      expect(input?.step).toBe('1');
      expect(input?.getAttribute('aria-label')).toBe('XP');
      host.remove();
    },
  );

  it('forwards numeric and empty edits', () => {
    const { host, modal, handleEnemyExperienceChange } = makeFixture();
    modal.open('enemy-1');
    const input = host.querySelector<HTMLInputElement>('input[type="number"]');
    if (!input) throw new Error('Expected enemy XP input');
    input.value = '9';
    input.dispatchEvent(new Event('change'));
    expect(handleEnemyExperienceChange).toHaveBeenLastCalledWith('enemy-1', '9');

    const refreshed = host.querySelector<HTMLInputElement>('input[type="number"]');
    if (!refreshed) throw new Error('Expected refreshed enemy XP input');
    refreshed.value = '';
    refreshed.dispatchEvent(new Event('change'));
    expect(handleEnemyExperienceChange).toHaveBeenLastCalledWith('enemy-1', '');
    host.remove();
  });
});
