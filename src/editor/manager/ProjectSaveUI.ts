import type { ProjectSaveManager } from './ProjectSaveManager';

type ShareGetter = () => string | null;
type TitleGetter = () => string;
type OnLoadProject = (shareUrl: string) => void;

export class ProjectSaveUI {
  private saveManager: ProjectSaveManager;
  private getShareUrl: ShareGetter;
  private getProjectTitle: TitleGetter;
  private onLoadProject: OnLoadProject | null = null;
  private manualSaveBtn: HTMLButtonElement | null = null;
  private historyToggleBtn: HTMLButtonElement | null = null;
  private historyMenu: HTMLElement | null = null;
  private historyContainer: HTMLElement | null = null;
  private historyWrapper: HTMLElement | null = null;
  private tabEditor: HTMLElement | null = null;
  private boundOutsideClick = (ev: MouseEvent) => this.handleOutsideClick(ev);
  private boundStorage = (ev: StorageEvent) => this.handleStorageEvent(ev);
  private boundManualSave = () => void this.handleManualSave();
  private boundToggle = () => this.toggleHistoryMenu();
  private boundUpdateVisibility = () => this.updateButtonVisibility();
  private tabObserver: MutationObserver | null = null;

  constructor(saveManager: ProjectSaveManager, getShareUrl: ShareGetter, getProjectTitle: TitleGetter, onLoadProject?: OnLoadProject | null) {
    this.saveManager = saveManager;
    this.getShareUrl = getShareUrl;
    this.getProjectTitle = getProjectTitle;
    this.onLoadProject = onLoadProject || null;
    this.initElements();
    this.bindListeners();
    this.refreshHistoryUI();
  }

  private initElements(): void {
    this.manualSaveBtn = document.getElementById('btn-manual-save') as HTMLButtonElement | null;
    this.historyToggleBtn = document.getElementById('btn-history-dropdown') as HTMLButtonElement | null;
    this.historyMenu = document.getElementById('history-dropdown-menu') as HTMLElement | null;
    this.historyContainer = document.getElementById('history-items-container') as HTMLElement | null;
    this.historyWrapper = document.querySelector('.history-dropdown-wrapper') as HTMLElement | null;
    this.tabEditor = document.getElementById('tab-editor') as HTMLElement | null;

    if (this.historyMenu) {
      this.historyMenu.setAttribute('role', 'menu');
      this.historyMenu.setAttribute('aria-hidden', 'true');
    }
    if (this.historyToggleBtn) {
      this.historyToggleBtn.setAttribute('aria-haspopup', 'true');
      this.historyToggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  private bindListeners(): void {
    if (this.manualSaveBtn) this.manualSaveBtn.addEventListener('click', this.boundManualSave);
    if (this.historyToggleBtn) this.historyToggleBtn.addEventListener('click', this.boundToggle);
    document.addEventListener('click', this.boundOutsideClick);
    window.addEventListener('storage', this.boundStorage);
    
    // Listen for tab changes to show/hide save buttons
    if (this.tabEditor) {
      // Observe changes to the tab's active class
      this.tabObserver = new MutationObserver(this.boundUpdateVisibility);
      this.tabObserver.observe(this.tabEditor, { attributes: true, attributeFilter: ['class'] });
    }
    
    // Initial visibility update
    this.updateButtonVisibility();
  }

  async handleManualSave(): Promise<void> {
    if (!this.manualSaveBtn) return;
    let shareUrl = this.getShareUrl();
    const title = this.getProjectTitle();

    this.manualSaveBtn.disabled = true;
    try {
      // Always regenerate the URL to capture the current game state
      await new Promise<void>((resolve) => {
        const handler = () => resolve();
        document.addEventListener('share-url-ready', handler, { once: true });
        setTimeout(resolve, 2000);
        document.dispatchEvent(new CustomEvent('request-share-url'));
      });
      shareUrl = this.getShareUrl();

      if (!shareUrl) {
        this.showNotification('Unable to generate share URL', 'error');
        return;
      }

      const result = await Promise.resolve(this.saveManager.manualSave(shareUrl, title));
      if (result.ok) {
        this.showNotification('Project saved', 'success');
        this.refreshHistoryUI();
      } else {
        this.showNotification(result.reason || 'Save failed', 'error');
      }
    } catch {
      this.showNotification('Unexpected error during save', 'error');
    } finally {
      this.manualSaveBtn.disabled = false;
    }
  }

  private refreshHistoryUI(): void {
    if (!this.historyContainer) return;
    this.historyContainer.innerHTML = '';
    const history = this.saveManager.getHistory();
    history.forEach((p) => {
      const item = document.createElement('button');
      item.className = 'history-item';
      item.setAttribute('role', 'menuitem');
      item.dataset.projectId = p.id;

      const titleEl = document.createElement('span');
      titleEl.className = 'history-item-title';
      titleEl.textContent = p.title || p.shareUrl;

      const tsEl = document.createElement('span');
      tsEl.className = 'history-item-timestamp';
      tsEl.textContent = new Date(p.savedAt).toLocaleString();

      item.appendChild(titleEl);
      item.appendChild(tsEl);
      item.addEventListener('click', () => this.handleLoadProject(p.id));
      this.historyContainer?.appendChild(item);
    });
  }

  private handleLoadProject(projectId: string): void {
    try {
      const project = this.saveManager.loadProject(projectId);
      if (project && project.shareUrl) {
        this.closeHistoryMenu();
        if (this.onLoadProject) {
          this.onLoadProject(project.shareUrl);
          this.showNotification('Game reloaded from save', 'success');
        }
      } else {
        this.showNotification('Project not found', 'error');
      }
    } catch {
      this.showNotification('Failed to load project', 'error');
    }
  }

  private toggleHistoryMenu(): void {
    if (!this.historyMenu || !this.historyToggleBtn) return;
    const expanded = this.historyToggleBtn.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      this.closeHistoryMenu();
    } else {
      this.openHistoryMenu();
    }
  }

  private openHistoryMenu(): void {
    if (!this.historyMenu || !this.historyToggleBtn) return;
    this.refreshHistoryUI();
    this.historyMenu.removeAttribute('hidden');
    this.historyMenu.setAttribute('aria-hidden', 'false');
    this.historyToggleBtn.setAttribute('aria-expanded', 'true');
  }

  private closeHistoryMenu(): void {
    if (!this.historyMenu || !this.historyToggleBtn) return;
    this.historyMenu.setAttribute('hidden', '');
    this.historyMenu.setAttribute('aria-hidden', 'true');
    this.historyToggleBtn.setAttribute('aria-expanded', 'false');
  }

  private handleOutsideClick(ev: MouseEvent): void {
    if (!this.historyMenu || !this.historyWrapper) return;
    if (!(ev.target instanceof Node)) return;
    if (!this.historyWrapper.contains(ev.target)) {
      this.closeHistoryMenu();
    }
  }

  private handleStorageEvent(_ev: StorageEvent): void {
    // Refresh history when storage changes externally
    void this.refreshHistoryUI();
  }

  private updateButtonVisibility(): void {
    // Check if the editor tab is active
    const isEditorTabActive = this.tabEditor?.classList.contains('active') ?? false;
    
    // Show buttons only when editor tab is active
    if (this.manualSaveBtn) {
      this.manualSaveBtn.style.display = isEditorTabActive ? '' : 'none';
    }
    if (this.historyToggleBtn) {
      this.historyToggleBtn.style.display = isEditorTabActive ? '' : 'none';
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `project-save-toast project-save-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  destroy(): void {
    if (this.manualSaveBtn) this.manualSaveBtn.removeEventListener('click', this.boundManualSave);
    if (this.historyToggleBtn) this.historyToggleBtn.removeEventListener('click', this.boundToggle);
    document.removeEventListener('click', this.boundOutsideClick);
    window.removeEventListener('storage', this.boundStorage);
    if (this.tabObserver) this.tabObserver.disconnect();
    this.manualSaveBtn = null;
    this.historyToggleBtn = null;
    this.historyMenu = null;
    this.historyContainer = null;
    this.historyWrapper = null;
    this.tabEditor = null;
    this.tabObserver = null;
  }
}
