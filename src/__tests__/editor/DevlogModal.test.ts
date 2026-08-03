import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { DevlogModal } from '../../editor/modules/DevlogModal';
import type { DevlogEntry } from '../../editor/manager/devlogData';

const SEEN_STORAGE_KEY = 'tiny-rpg-devlog-seen';

function setupDom(editorActive = true): void {
  document.body.innerHTML = `
    <div id="tab-editor" class="${editorActive ? 'active' : ''}"></div>
    <button id="btn-devlog" class="btn-devlog"><span id="devlog-badge" hidden></span></button>
    <div id="devlog-modal" class="tiny-modal devlog-modal" hidden>
      <div class="tiny-modal__panel tiny-modal__panel--lg">
        <div class="tiny-modal__header">
          <button id="devlog-close" class="tiny-modal__close" data-modal-close></button>
        </div>
        <div id="devlog-list" class="tiny-modal__body"></div>
        <div class="tiny-modal__footer">
          <button id="devlog-prev"></button>
          <span id="devlog-page-indicator"></span>
          <button id="devlog-next"></button>
        </div>
      </div>
    </div>
  `;
}

function makeEntries(count: number): DevlogEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `entry-${i}`,
    date: '2026-06-15',
    title: `Feature ${i}`,
    description: `Description for feature ${i}.`,
  }));
}

describe('DevlogModal', () => {
  beforeEach(() => {
    setupDom();
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows the badge when there are unseen updates', () => {
    const modal = new DevlogModal(makeEntries(3));
    const badge = document.getElementById('devlog-badge') as HTMLElement;

    expect(modal.hasUnseenUpdates()).toBe(true);
    expect(badge.hidden).toBe(false);
    expect(document.getElementById('btn-devlog')?.classList.contains('has-updates')).toBe(true);
    modal.destroy();
  });

  it('hides the badge when the latest update was already seen', () => {
    const entries = makeEntries(3);
    localStorage.setItem(SEEN_STORAGE_KEY, entries[0].id);

    const modal = new DevlogModal(entries);
    const badge = document.getElementById('devlog-badge') as HTMLElement;

    expect(modal.hasUnseenUpdates()).toBe(false);
    expect(badge.hidden).toBe(true);
    modal.destroy();
  });

  it('opens the modal, renders the first page and marks updates as seen', () => {
    const entries = makeEntries(3);
    const modal = new DevlogModal(entries);

    (document.getElementById('btn-devlog') as HTMLElement).click();

    const modalEl = document.getElementById('devlog-modal') as HTMLElement;
    const list = document.getElementById('devlog-list') as HTMLElement;
    expect(modalEl.hidden).toBe(false);
    expect(list.querySelectorAll('.devlog-entry').length).toBe(3);
    expect(list.textContent).toContain('Feature 0');

    // Opening marks the latest update as seen → badge gone.
    expect(localStorage.getItem(SEEN_STORAGE_KEY)).toBe(entries[0].id);
    expect(modal.hasUnseenUpdates()).toBe(false);
    expect((document.getElementById('devlog-badge') as HTMLElement).hidden).toBe(true);
    modal.destroy();
  });

  it('paginates entries with prev/next and disables edge buttons', () => {
    // 12 entries → 3 pages of 5/5/2.
    const modal = new DevlogModal(makeEntries(12));
    const list = document.getElementById('devlog-list') as HTMLElement;
    const prev = document.getElementById('devlog-prev') as HTMLButtonElement;
    const next = document.getElementById('devlog-next') as HTMLButtonElement;
    const indicator = document.getElementById('devlog-page-indicator') as HTMLElement;

    (document.getElementById('btn-devlog') as HTMLElement).click();

    expect(list.querySelectorAll('.devlog-entry').length).toBe(5);
    expect(indicator.textContent).toBe('Page 1 of 3');
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    expect(indicator.textContent).toBe('Page 2 of 3');
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);

    next.click();
    expect(indicator.textContent).toBe('Page 3 of 3');
    expect(list.querySelectorAll('.devlog-entry').length).toBe(2);
    expect(next.disabled).toBe(true);

    prev.click();
    expect(indicator.textContent).toBe('Page 2 of 3');
    modal.destroy();
  });

  it('closes on the close button and on Escape', () => {
    const modal = new DevlogModal(makeEntries(3));
    const modalEl = document.getElementById('devlog-modal') as HTMLElement;

    (document.getElementById('btn-devlog') as HTMLElement).click();
    expect(modalEl.hidden).toBe(false);

    (document.getElementById('devlog-close') as HTMLElement).click();
    expect(modalEl.hidden).toBe(true);

    (document.getElementById('btn-devlog') as HTMLElement).click();
    expect(modalEl.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modalEl.hidden).toBe(true);
    modal.destroy();
  });

  it('hides the button when the editor tab is not active', () => {
    setupDom(false);
    const modal = new DevlogModal(makeEntries(3));
    const btn = document.getElementById('btn-devlog') as HTMLButtonElement;

    expect(btn.style.display).toBe('none');
    modal.destroy();
  });
});
