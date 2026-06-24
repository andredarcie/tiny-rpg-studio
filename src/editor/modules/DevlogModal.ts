/**
 * DevlogModal — "Updates" button and engine devlog modal.
 *
 * Sits next to the Save / Load controls and opens a paginated modal listing the
 * engine's devlog (see {@link DEVLOG_ENTRIES}). A badge on the button warns the
 * user when there are updates they have not seen yet; once the modal is opened
 * the updates are marked as seen and the badge disappears.
 *
 * The button mirrors the Save / Load visibility: it is only shown while the
 * Editor tab is active, keeping the controls group cohesive.
 */
import { DEVLOG_ENTRIES, LATEST_DEVLOG_ID, type DevlogEntry } from '../manager/devlogData';
import { track } from '../../analytics/track';
import { TextResources } from '../../runtime/adapters/TextResources';

const SEEN_STORAGE_KEY = 'tiny-rpg-devlog-seen';
const PAGE_SIZE = 5;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Format an ISO `YYYY-MM-DD` date as e.g. `June 15, 2026` (always English). */
function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = MONTH_NAMES[Number(match[2]) - 1] ?? '';
  const day = Number(match[3]);
  return `${month} ${day}, ${match[1]}`;
}

function readSeenId(): string | null {
  try {
    return localStorage.getItem(SEEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSeenId(id: string): void {
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, id);
  } catch {
    // Storage unavailable (private mode / quota) — badge simply stays visible.
  }
}

class DevlogModal {
  private entries: DevlogEntry[];
  private button: HTMLButtonElement | null;
  private badge: HTMLElement | null;
  private modal: HTMLElement | null;
  private list: HTMLElement | null;
  private prevBtn: HTMLButtonElement | null;
  private nextBtn: HTMLButtonElement | null;
  private pageIndicator: HTMLElement | null;
  private tabEditor: HTMLElement | null;

  private currentPage = 0;

  private boundOpen = () => this.open();
  private boundClose = () => this.close();
  private boundPrev = () => this.goToPage(this.currentPage - 1);
  private boundNext = () => this.goToPage(this.currentPage + 1);
  private boundBackdrop = (e: MouseEvent) => { if (e.target === this.modal) this.close(); };
  private boundKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.modal && !this.modal.hidden) this.close();
  };
  private boundVisibility = () => this.updateButtonVisibility();
  private tabObserver: MutationObserver | null = null;

  constructor(entries: DevlogEntry[] = DEVLOG_ENTRIES) {
    this.entries = entries;
    this.button = document.getElementById('btn-devlog') as HTMLButtonElement | null;
    this.badge = document.getElementById('devlog-badge');
    this.modal = document.getElementById('devlog-modal');
    this.list = document.getElementById('devlog-list');
    this.prevBtn = document.getElementById('devlog-prev') as HTMLButtonElement | null;
    this.nextBtn = document.getElementById('devlog-next') as HTMLButtonElement | null;
    this.pageIndicator = document.getElementById('devlog-page-indicator');
    this.tabEditor = document.getElementById('tab-editor');

    this.bind();
    this.updateBadge();
    this.updateButtonVisibility();
  }

  private get totalPages(): number {
    return Math.max(1, Math.ceil(this.entries.length / PAGE_SIZE));
  }

  private bind(): void {
    this.button?.addEventListener('click', this.boundOpen);
    document.getElementById('devlog-close')?.addEventListener('click', this.boundClose);
    this.prevBtn?.addEventListener('click', this.boundPrev);
    this.nextBtn?.addEventListener('click', this.boundNext);
    this.modal?.addEventListener('click', this.boundBackdrop);
    document.addEventListener('keydown', this.boundKeydown);

    // Mirror the Save / Load buttons: only visible while the Editor tab is active.
    if (this.tabEditor) {
      this.tabObserver = new MutationObserver(this.boundVisibility);
      this.tabObserver.observe(this.tabEditor, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /** True when the most recent entry has not been seen by the user yet. */
  hasUnseenUpdates(): boolean {
    if (this.entries.length === 0) return false;
    const latestId = this.entries[0]?.id ?? LATEST_DEVLOG_ID;
    return readSeenId() !== latestId;
  }

  open(): void {
    if (!this.modal) return;
    this.currentPage = 0;
    this.renderPage();
    this.modal.hidden = false;
    track('devlog_opened');
    this.markAllSeen();
  }

  close(): void {
    if (!this.modal) return;
    this.modal.hidden = true;
  }

  private markAllSeen(): void {
    const latestId = this.entries[0]?.id ?? LATEST_DEVLOG_ID;
    if (latestId) writeSeenId(latestId);
    this.updateBadge();
  }

  private updateBadge(): void {
    const unseen = this.hasUnseenUpdates();
    if (this.badge) this.badge.hidden = !unseen;
    if (this.button) {
      this.button.classList.toggle('has-updates', unseen);
      this.button.setAttribute(
        'aria-label',
        unseen
          ? TextResources.get('devlog.buttonAriaUnseen', 'Engine updates and devlog (new updates available)')
          : TextResources.get('devlog.buttonAria', 'Engine updates and devlog'),
      );
    }
  }

  private goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 0), this.totalPages - 1);
    if (clamped === this.currentPage) return;
    this.currentPage = clamped;
    this.renderPage();
  }

  private renderPage(): void {
    if (!this.list) return;
    this.list.innerHTML = '';

    const start = this.currentPage * PAGE_SIZE;
    const pageEntries = this.entries.slice(start, start + PAGE_SIZE);

    for (const entry of pageEntries) {
      this.list.appendChild(this.renderEntry(entry));
    }

    this.list.scrollTop = 0;

    if (this.pageIndicator) {
      this.pageIndicator.textContent = TextResources.format(
        'devlog.pageIndicator',
        { current: this.currentPage + 1, total: this.totalPages },
        `Page ${this.currentPage + 1} of ${this.totalPages}`,
      );
    }
    if (this.prevBtn) this.prevBtn.disabled = this.currentPage === 0;
    if (this.nextBtn) this.nextBtn.disabled = this.currentPage >= this.totalPages - 1;
  }

  private renderEntry(entry: DevlogEntry): HTMLElement {
    const article = document.createElement('article');
    article.className = 'devlog-entry';

    const dateEl = document.createElement('div');
    dateEl.className = 'devlog-entry__date';
    dateEl.textContent = formatDate(entry.date);

    const titleEl = document.createElement('h3');
    titleEl.className = 'devlog-entry__title';
    titleEl.textContent = entry.title;

    const descEl = document.createElement('p');
    descEl.className = 'devlog-entry__desc';
    descEl.textContent = entry.description;

    article.appendChild(dateEl);
    article.appendChild(titleEl);
    article.appendChild(descEl);
    return article;
  }

  private updateButtonVisibility(): void {
    if (!this.button) return;
    const isEditorTabActive = this.tabEditor?.classList.contains('active') ?? false;
    this.button.style.display = isEditorTabActive ? '' : 'none';
  }

  destroy(): void {
    this.button?.removeEventListener('click', this.boundOpen);
    document.getElementById('devlog-close')?.removeEventListener('click', this.boundClose);
    this.prevBtn?.removeEventListener('click', this.boundPrev);
    this.nextBtn?.removeEventListener('click', this.boundNext);
    this.modal?.removeEventListener('click', this.boundBackdrop);
    document.removeEventListener('keydown', this.boundKeydown);
    this.tabObserver?.disconnect();
    this.tabObserver = null;
  }
}

export { DevlogModal };
