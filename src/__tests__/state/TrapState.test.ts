import { describe, expect, it, vi } from 'vitest';
import { isTrapActive } from '../../runtime/domain/state/TrapState';

describe('isTrapActive', () => {
  it('treats missing and unusable variables as active', () => {
    const lookup = vi.fn(() => false);

    expect(isTrapActive({}, lookup)).toBe(true);
    expect(isTrapActive({ variableId: '' }, lookup)).toBe(true);
    expect(isTrapActive({ variableId: 'missing' }, lookup)).toBe(true);
  });

  it('uses the inverse of the linked variable state', () => {
    expect(isTrapActive({ variableId: 'var-1' }, () => false)).toBe(true);
    expect(isTrapActive({ variableId: 'var-1' }, () => true)).toBe(false);
  });
});
