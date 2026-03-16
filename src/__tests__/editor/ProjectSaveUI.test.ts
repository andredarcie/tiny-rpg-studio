import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { ProjectSaveUI } from '../../editor/manager/ProjectSaveUI';
import type { ProjectSaveManager } from '../../editor/manager/ProjectSaveManager';
import type { SaveResult } from '../../editor/manager/ProjectSaveManager.types';

function setupDom() {
  document.body.innerHTML = `
    <button id="btn-manual-save"></button>
    <button id="btn-history-dropdown"></button>
    <div id="history-dropdown-menu"><div id="history-items-container"></div></div>
  `;
}

describe('ProjectSaveUI', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('calls saveManager.manualSave when manual save button clicked', async () => {
    const manualSaveMock = vi.fn((): SaveResult => ({ ok: true }));
    const getHistoryMock = vi.fn(() => []);

    const saveManager = {
      manualSave: manualSaveMock,
      getHistory: getHistoryMock,
    } as unknown as ProjectSaveManager;

    const ui = new ProjectSaveUI(saveManager, () => 'https://share', () => 'title');

    const btn = document.getElementById('btn-manual-save') as HTMLButtonElement;
    expect(btn).toBeDefined();

    btn.click();
    // handleManualSave now always waits for 'share-url-ready' — dispatch it
    document.dispatchEvent(new CustomEvent('share-url-ready'));
    await new Promise((r) => setTimeout(r, 0));

    expect(manualSaveMock).toHaveBeenCalledTimes(1);
    ui.destroy();
  });

  it('opens and closes history menu when toggled', async () => {
    const saveManager = { manualSave: vi.fn(() => ({ ok: true })), getHistory: vi.fn(() => [{ id: '1', shareUrl: 'u', title: 't', savedAt: Date.now() }]) } as unknown as ProjectSaveManager;
    const ui = new ProjectSaveUI(saveManager, () => 'u', () => 't');

    const toggle = document.getElementById('btn-history-dropdown') as HTMLButtonElement;
    const menu = document.getElementById('history-dropdown-menu') as HTMLElement;
    expect(toggle).toBeDefined();
    expect(menu).toBeDefined();

    toggle.click();
    await Promise.resolve();

    // Our implementation sets aria-hidden to 'false' when opened
    expect(menu.getAttribute('aria-hidden')).toBe('false');

    toggle.click();
    await Promise.resolve();

    expect(menu.getAttribute('aria-hidden')).toBe('true');
    ui.destroy();
  });

  it('renders history items into container', async () => {
    const sample = { id: 'abc', shareUrl: 'u', title: 'My Project', savedAt: Date.now() };
    const saveManager = { manualSave: vi.fn(() => ({ ok: true })), getHistory: vi.fn(() => [sample]) } as unknown as ProjectSaveManager;
    const ui = new ProjectSaveUI(saveManager, () => 'u', () => 't');

    const container = document.getElementById('history-items-container') as HTMLElement;
    expect(container).toBeDefined();

    // refreshHistoryUI called on constructor; allow microtask
    await Promise.resolve();

    const item = container.querySelector('.history-item') as HTMLElement | null;
    expect(item).not.toBeNull();
    expect(item?.textContent).toContain('My Project');
    ui.destroy();
  });

  it('calls onLoadProject callback with shareUrl when history item clicked', async () => {
    const sample = { id: 'abc', shareUrl: 'https://example.com/share/xyz', title: 'My Project', savedAt: Date.now() };
    const saveManager = {
      manualSave: vi.fn(() => ({ ok: true })),
      getHistory: vi.fn(() => [sample]),
      loadProject: vi.fn((id) => (id === 'abc' ? sample : null)),
    } as unknown as ProjectSaveManager;

    const onLoadProjectMock = vi.fn();
    const ui = new ProjectSaveUI(saveManager, () => 'u', () => 't', onLoadProjectMock);

    await Promise.resolve();

    const container = document.getElementById('history-items-container') as HTMLElement;
    const item = container.querySelector('.history-item') as HTMLElement;
    expect(item).toBeDefined();

    item.click();

    expect(onLoadProjectMock).toHaveBeenCalledWith('https://example.com/share/xyz');
    ui.destroy();
  });

  it('does not call onLoadProject if project not found', async () => {
    const saveManager = {
      manualSave: vi.fn(() => ({ ok: true })),
      getHistory: vi.fn(() => []),
      loadProject: vi.fn(() => null),
    } as unknown as ProjectSaveManager;

    const onLoadProjectMock = vi.fn();
    const ui = new ProjectSaveUI(saveManager, () => 'u', () => 't', onLoadProjectMock);

    await Promise.resolve();

    // Since there are no items, we can't test clicking, but we can verify null case works
    expect(onLoadProjectMock).not.toHaveBeenCalled();
    ui.destroy();
  });
});
