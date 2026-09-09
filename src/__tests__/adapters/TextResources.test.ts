import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextResources } from '../../runtime/adapters/TextResources';

describe('TextResources', () => {
  const originalLocale = TextResources.getLocale();

  beforeEach(() => {
    TextResources.setLocale('en-US', { silent: true });
  });

  afterEach(() => {
    TextResources.setLocale(originalLocale, { silent: true });
    vi.unstubAllGlobals();
  });

  it('returns localized strings with fallback', () => {
    expect(TextResources.get('intro.startAdventure')).toBe('Start adventure');
    expect(TextResources.get('missing.key', 'Fallback')).toBe('Fallback');
    expect(TextResources.get(null, 'Fallback')).toBe('Fallback');
  });

  it('formats strings with params', () => {
    const result = TextResources.format('enemies.xpBarValue', { current: 2, total: 5 });

    expect(result).toBe('2 / 5 enemies');
  });

  it('defines the new skills and unassigned level label in every locale', () => {
    for (const locale of Object.keys(TextResources.bundles)) {
      const strings = TextResources.getStrings(locale);
      expect(strings['skills.booksmart.name']).toBeTruthy();
      expect(strings['skills.booksmart.desc']).toBeTruthy();
      expect(strings['skills.blackmith.name']).toBeTruthy();
      expect(strings['skills.blackmith.desc']).toBeTruthy();
      expect(strings['skills.blessed.name']).toBeTruthy();
      expect(strings['skills.blessed.desc']).toBeTruthy();
      expect(strings['project.skills.levelUnassigned']).toContain('-');
    }
  });

  it('detects browser locale from navigator', () => {
    vi.stubGlobal('navigator', { languages: ['pt-BR'], language: 'pt-BR' } as unknown as Navigator);

    expect(TextResources.detectBrowserLocale()).toBe('pt-BR');
  });

  it('applies text and attributes to DOM elements', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <span data-text-key="intro.startAdventure"></span>
      <input data-placeholder-key="project.titlePlaceholder" />
      <button data-aria-label-key="aria.reset"></button>
      <div data-title-key="project.shareHint"></div>
    `;

    TextResources.apply(root);

    const textNode = root.querySelector('[data-text-key]');
    const input = root.querySelector('[data-placeholder-key]') as HTMLInputElement;
    const button = root.querySelector('[data-aria-label-key]') as HTMLButtonElement;
    const titled = root.querySelector('[data-title-key]') as HTMLDivElement;

    expect(textNode?.textContent).toBe('Start adventure');
    expect(input.placeholder).toBe('Eg: Legends of the Vale');
    expect(button.getAttribute('aria-label')).toBe('Restart the current run');
    expect(titled.getAttribute('title')).toBe('Generate a URL and share it with friends!');
  });
});
