import { describe, expect, it } from 'vitest';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { NPCDefinitions } from '../../runtime/domain/definitions/NPCDefinitions';
import { itemCatalog } from '../../runtime/domain/services/ItemCatalog';
import { PICO8_COLORS, TILE_PRESETS, TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';
import { SkillDefinitions } from '../../runtime/domain/definitions/SkillDefinitions';

describe('Core definitions', () => {
  const getNecromancerSkill = () => {
    const skill = SkillDefinitions.getById('necromancer');
    if (!skill) throw new Error('Expected necromancer skill to exist');
    return skill;
  };

  it('EnemyDefinitions exposes a default entry', () => {
    expect(EnemyDefinitions.getDefault()).not.toBeNull();
  });

  it('NPCDefinitions exposes definitions', () => {
    expect(NPCDefinitions.definitions.length).toBeGreaterThan(0);
  });

  it('ItemCatalog exposes placeable types', () => {
    expect(itemCatalog.getPlaceableTypes().length).toBeGreaterThan(0);
  });

  it('TileDefinitions exposes presets and colors', () => {
    expect(PICO8_COLORS.length).toBeGreaterThan(0);
    expect(TILE_PRESETS.length).toBeGreaterThan(0);
    expect(TileDefinitions.createEmptyLayout().length).toBe(8);
  });

  it('SkillDefinitions exposes skills', () => {
    expect(SkillDefinitions.getAll().length).toBeGreaterThan(0);
  });

  it('sanitizes skill customizations defensively', () => {
    const sanitized = SkillDefinitions.sanitizeCustomizationMap({
      necromancer: {
        name: '  Custom Necromancer Name Too Long  ',
        description: '  This description is intentionally too long for the level card.  '
      },
      unknown: { name: 'Nope' },
      charisma: { name: '   ' }
    });

    expect(sanitized).toEqual({
      necromancer: {
        name: 'Custom Necromancer',
        description: 'This description is intentionally too long for'
      }
    });
  });

  it('sanitizes skill customizations with icon field', () => {
    const sanitized = SkillDefinitions.sanitizeCustomizationMap({
      necromancer: { icon: '  ⚡  ' }
    });
    expect(sanitized).toEqual({ necromancer: { icon: '⚡' } });
  });

  it('sanitizes skill customizations truncating icon to ICON_MAX_LENGTH', () => {
    const longIcon = '1234567890abcdefghij';
    const sanitized = SkillDefinitions.sanitizeCustomizationMap({
      necromancer: { icon: longIcon }
    });
    expect(sanitized).toEqual({
      necromancer: { icon: longIcon.slice(0, SkillDefinitions.ICON_MAX_LENGTH) }
    });
  });

  it('sanitizes skill customizations rejecting whitespace-only icon', () => {
    const sanitized = SkillDefinitions.sanitizeCustomizationMap({
      necromancer: { icon: '   ' }
    });
    expect(sanitized).toBeUndefined();
  });

  it('getDisplayIcon returns custom icon when set', () => {
    const skill = getNecromancerSkill();
    const customizations = { necromancer: { icon: '⚡' } };
    expect(SkillDefinitions.getDisplayIcon(skill, customizations)).toBe('⚡');
  });

  it('getDisplayIcon trims whitespace from custom icon', () => {
    const skill = getNecromancerSkill();
    const customizations = { necromancer: { icon: '  ⚡  ' } };
    expect(SkillDefinitions.getDisplayIcon(skill, customizations)).toBe('⚡');
  });

  it('getDisplayIcon falls back to skill default icon when no customization', () => {
    const skill = getNecromancerSkill();
    expect(SkillDefinitions.getDisplayIcon(skill, undefined)).toBe('☠️');
  });

  it('getDisplayIcon falls back when custom icon is empty or whitespace', () => {
    const skill = getNecromancerSkill();
    expect(SkillDefinitions.getDisplayIcon(skill, { necromancer: { icon: '   ' } })).toBe('☠️');
    expect(SkillDefinitions.getDisplayIcon(skill, { necromancer: {} })).toBe('☠️');
  });
});
