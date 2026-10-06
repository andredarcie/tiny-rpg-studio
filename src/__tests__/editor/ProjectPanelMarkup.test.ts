import html from '../../../index.html?raw';
import textResources from '../../runtime/adapters/TextResources.ts?raw';
import { describe, expect, it } from 'vitest';

const page = document.createElement('div');
page.innerHTML = html;
const required = <T extends Element = HTMLElement>(root: Element, selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
};
const project = required(page, '.editor-section--project');
const panel = (key: string) => required(project, `[data-project-tab-panel="${key}"]`);
const section = (tab: string, group: string) => required(panel(tab), `[data-project-section="${group}"]`);
const ids = (root: Element) => Array.from(root.querySelectorAll('[id]'), element => element.id);

describe('Project panel markup', () => {
  it('links each of the eight tabs to one named panel and keeps existing IDs unique', () => {
    const keys = ['development', 'testing', 'appearance', 'online', 'info', 'audio', 'export', 'plugins'];
    expect(Array.from(project.querySelectorAll('[data-project-tab-button]'), button => (button as HTMLElement).dataset.projectTabButton)).toEqual(keys);
    expect(Array.from(project.querySelectorAll('[data-project-tab-panel]'), item => (item as HTMLElement).dataset.projectTabPanel)).toEqual(keys);
    for (const key of keys) {
      const button = required(project, `[data-project-tab-button="${key}"]`);
      const target = panel(key);
      expect(button.id).toBe(`project-tab-${key}`);
      expect(button.getAttribute('aria-controls')).toBe(target.id);
      expect(target.getAttribute('aria-labelledby')).toBe(button.id);
      expect(target.id).toBe(`project-panel-${key}`);
      expect(target.querySelector(`[data-text-key="project.group.${key}"]`)).toBeNull();
    }
    const allIds = ids(page);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(panel('development').classList.contains('active')).toBe(true);
    expect(panel('development').hidden).toBe(false);
    expect(keys.slice(1).every(key => panel(key).hidden)).toBe(true);
  });

  it('uses the same disclosure structure for every submenu', () => {
    const groups = {
      development: [['variables', 'project.section.variables', true], ['skills', 'project.section.skills', true], ['enemies', 'project.enemies.title', false]],
      testing: [['testing', 'project.section.testSetup', true]],
      appearance: [['palette', 'project.section.palette', true], ['sprites', 'project.sprites.title', true], ['effects', 'project.section.effects', false], ['display', 'project.section.display', true]],
      online: [['online', 'project.section.onlineSetup', true]],
      info: [['information', 'project.section.gameDetails', true]],
      audio: [['music', 'project.audio.backgroundMusic', true]],
      export: [['share-url', 'project.section.shareUrl', true], ['project-file', 'project.section.projectFile', true]],
      plugins: [['plugins', 'project.section.pluginSettings', true]],
    } as const;
    for (const [tab, entries] of Object.entries(groups)) {
      expect(panel(tab).querySelectorAll('.project-card')).toHaveLength(entries.length);
      for (const [name, key, open] of entries) {
        const card = section(tab, name) as HTMLDetailsElement;
        expect(card.tagName).toBe('DETAILS');
        expect(card.open).toBe(open);
        expect(card.firstElementChild?.matches(`summary[data-text-key="${key}"]`)).toBe(true);
        expect(card.parentElement?.matches(tab === 'plugins' ? '.project-tab-panel' : '.project-group')).toBe(true);
      }
    }
  });

  it('groups Development controls with their related toggles and keeps Enemies closed', () => {
    expect(section('development', 'variables').querySelector('#project-variables-container #project-variables-toggle')).not.toBeNull();
    expect(section('development', 'variables').querySelector('#project-show-variable-links')).not.toBeNull();
    expect(section('development', 'variables').querySelector('#project-variable-usage-list #project-show-variable-links')).toBeNull();
    expect(section('development', 'skills').querySelector('#project-skills-container #project-skills-toggle')).not.toBeNull();
    expect(section('development', 'skills').querySelector('#project-disable-skills')).not.toBeNull();
    expect(section('development', 'skills').querySelector('#project-skills-list #project-disable-skills')).toBeNull();
    const enemies = section('development', 'enemies');
    expect(enemies.tagName).toBe('DETAILS');
    expect(enemies.hasAttribute('open')).toBe(false);
    expect(enemies.querySelector('summary[data-text-key="project.enemies.title"]')).not.toBeNull();
    expect(ids(enemies)).toEqual(['project-respawnable-enemies', 'project-respawnable-bosses']);
  });

  it('keeps Testing and Online controls together', () => {
    for (const id of ['project-test-start-level', 'project-test-god-mode', 'project-test-debug-vision', 'project-test-skill-list']) {
      expect(section('testing', 'testing').querySelector(`#${id}`)).not.toBeNull();
    }
    const online = section('online', 'online');
    expect(online.querySelector('.project-online-warning')).not.toBeNull();
    for (const id of ['project-online-enabled', 'project-online-controls', 'btn-start-online-server', 'online-server-url']) {
      expect(online.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('groups Visuals controls and opens Palette by default', () => {
    const palette = section('appearance', 'palette');
    const effects = section('appearance', 'effects');
    expect(palette.tagName).toBe('DETAILS');
    expect((palette as HTMLDetailsElement).open).toBe(true);
    expect(effects.tagName).toBe('DETAILS');
    expect((effects as HTMLDetailsElement).open).toBe(false);
    for (const id of ['project-palette-container', 'palette-grid', 'palette-preset-select', 'palette-import-button', 'palette-export-button', 'palette-reset-button', 'palette-about-button']) {
      expect(palette.querySelector(`#${id}`)).not.toBeNull();
    }
    for (const id of ['project-enable-effects', 'custom-effect-open', 'custom-effects-import-button', 'custom-effects-export-button']) {
      expect(effects.querySelector(`#${id}`)).not.toBeNull();
    }
    for (const id of ['project-sprite-outline', 'project-sprite-outline-color', 'project-show-new-dialog-exclamation', 'project-hide-hud', 'project-disable-pixel-font']) {
      expect(section('appearance', 'display').querySelector(`#${id}`)).not.toBeNull();
    }
    expect(section('appearance', 'sprites').querySelector('#project-sprites-container')).not.toBeNull();
  });

  it('groups Information, Audio, Share and plugin content', () => {
    for (const id of ['game-title', 'game-author', 'language-select', 'btn-about']) {
      expect(section('info', 'information').querySelector(`#${id}`)).not.toBeNull();
    }
    const music = section('audio', 'music');
    expect(music.tagName).toBe('DETAILS');
    expect((music as HTMLDetailsElement).open).toBe(true);
    expect(music.querySelector('#project-background-music-url')).not.toBeNull();
    expect(music.querySelector('#project-background-music-volume')).not.toBeNull();
    for (const id of ['generate-url-wrapper', 'btn-generate-url', 'project-share-url']) {
      expect(section('export', 'share-url').querySelector(`#${id}`)).not.toBeNull();
    }
    for (const id of ['btn-import-html', 'btn-generate-html', 'export-editable-in-studio']) {
      expect(section('export', 'project-file').querySelector(`#${id}`)).not.toBeNull();
    }
    expect(section('plugins', 'plugins').querySelector('[data-plugin-settings-empty]')).not.toBeNull();
    expect(section('plugins', 'plugins').querySelector('[data-plugin-settings-groups]')).not.toBeNull();
  });

  it('provides every new section title in all five locales', () => {
    const keys = ['variables', 'skills', 'testSetup', 'palette', 'effects', 'display', 'onlineSetup', 'gameDetails', 'shareUrl', 'projectFile', 'pluginSettings'];
    for (const key of keys) {
      expect(project.querySelector(`[data-text-key="project.section.${key}"]`)).not.toBeNull();
      expect(textResources.match(new RegExp(`'project\\.section\\.${key}':`, 'g'))).toHaveLength(5);
    }
  });
});
