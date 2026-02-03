import { describe, it, expect } from 'vitest';
import { EditorDomCache } from '../../editor/modules/EditorDomCache';

describe('EditorDomCache', () => {
  it('should initialize with nulls when root is missing', () => {
    const cache = new EditorDomCache(null);

    expect(cache.root).toBeNull();
    expect(cache.editorCanvas).toBeNull();
    expect(cache.mapPosition).toBeNull();
    expect(cache.mapNavButtons).toEqual([]);
    expect(cache.mobileNavButtons).toEqual([]);
    expect(cache.mobilePanels).toEqual([]);
    expect(cache.npcText).toBeNull();
    expect(cache.projectTestPanel).toBeNull();
    expect(cache.jsonArea).toBeNull();
  });

  it('should cache elements from the provided root', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <canvas id="editor-canvas"></canvas>
      <div id="editor-map-position"></div>
      <button class="map-nav-button"></button>
      <button class="map-nav-button"></button>
      <button class="editor-mobile-nav-button"></button>
      <section class="editor-section" data-mobile-panel="tiles"></section>
      <section class="editor-section" data-mobile-panel="npcs"></section>
      <div id="selected-tile-preview"></div>
      <div id="tile-preset-summary"></div>
      <div id="tile-list"></div>
      <div id="npcs-list"></div>
      <textarea id="npc-text"></textarea>
      <textarea id="npc-conditional-text"></textarea>
      <select id="npc-conditional-variable"></select>
      <select id="npc-reward-variable"></select>
      <select id="npc-conditional-reward-variable"></select>
      <button id="btn-toggle-npc-conditional"></button>
      <div id="npc-conditional-section"></div>
      <button data-npc-variant-filter="human"></button>
      <button data-npc-variant-filter="elf"></button>
      <div id="world-grid"></div>
      <input id="game-title" />
      <input id="game-author" />
      <input id="file-input" />
      <div id="object-types"></div>
      <div id="objects-list"></div>
      <button id="npc-delete"></button>
      <div class="npc-editor"></div>
      <button id="btn-generate-url"></button>
      <input id="project-share-url" />
      <button id="btn-undo"></button>
      <button id="btn-redo"></button>
      <div id="enemy-types"></div>
      <div id="enemies-list"></div>
      <div id="project-variables-container"></div>
      <button id="project-variables-toggle"></button>
      <div id="project-variable-usage-list"></div>
      <div id="project-variable-usage-summary"></div>
      <div id="project-skills-container"></div>
      <button id="project-skills-toggle"></button>
      <div id="project-skills-list"></div>
      <div id="project-test-container"></div>
      <button id="project-test-toggle"></button>
      <div id="project-test-panel"></div>
      <select id="project-test-start-level"></select>
      <div id="project-test-skill-list"></div>
      <input id="project-test-god-mode" />
      <textarea id="json-area"></textarea>
    `;

    const cache = new EditorDomCache(root);

    expect(cache.editorCanvas).toBeInstanceOf(HTMLCanvasElement);
    expect(cache.mapPosition).toBeInstanceOf(HTMLElement);
    expect(cache.mapNavButtons).toHaveLength(2);
    expect(cache.mobileNavButtons).toHaveLength(1);
    expect(cache.mobilePanels).toHaveLength(2);
    expect(cache.npcText).toBeInstanceOf(HTMLTextAreaElement);
    expect(cache.npcConditionalVariable).toBeInstanceOf(HTMLSelectElement);
    expect(cache.btnToggleNpcConditional).toBeInstanceOf(HTMLElement);
    expect(cache.npcVariantButtons).toHaveLength(2);
    expect(cache.titleInput).toBeInstanceOf(HTMLInputElement);
    expect(cache.projectTestStartLevel).toBeInstanceOf(HTMLSelectElement);
    expect(cache.projectTestGodMode).toBeInstanceOf(HTMLInputElement);
    expect(cache.jsonArea).toBeInstanceOf(HTMLTextAreaElement);
  });
});
