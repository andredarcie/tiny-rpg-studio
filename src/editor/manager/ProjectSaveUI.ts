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
    const title = this.getProjectTitle() ?? '';

    this.manualSaveBtn.disabled = true;
    try {
      // If no share URL exists, we need to generate one first
      if (!shareUrl) {
        // Trigger share URL generation by dispatching a custom event
        // The EditorManager should listen for this and generate the URL
        const event = new CustomEvent('request-share-url', { detail: {} });
        document.dispatchEvent(event);
        
        // Give a small delay for the event handler to generate the URL
        await new Promise((resolve) => setTimeout(resolve, 100));
        shareUrl = this.getShareUrl();
      }

      if (!shareUrl) {
        this.showNotification('Unable to generate share URL', 'error');
        return;
      }

      const result = await Promise.resolve(this.saveManager.manualSave(shareUrl, title));
      if (result && result.ok) {
        this.showNotification('Project saved', 'success');
        await this.refreshHistoryUI();
      } else {
        this.showNotification(result?.reason || 'Save failed', 'error');
      }
    } catch (err) {
      this.showNotification('Unexpected error during save', 'error');
    } finally {
      this.manualSaveBtn.disabled = false;
    }
  }

  private async refreshHistoryUI(): Promise<void> {
    if (!this.historyContainer) return;
    this.historyContainer.innerHTML = '';
    const history = this.saveManager.getHistory();
    history.forEach((p) => {
      const item = document.createElement('button');
      item.className = 'history-item';
      item.setAttribute('role', 'menuitem');
      item.textContent = p.title || p.shareUrl;
      item.dataset.projectId = p.id;
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
          console.log(project)
          this.onLoadProject(project.shareUrl);
        }
      } else {
        this.showNotification('Project not found', 'error');
      }
    } catch (err) {
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

  private showNotification(_message: string, _type: 'success' | 'error' | 'info' = 'info'): void {
    // Minimal hook: could integrate toasts later. For now use console to avoid silent failures in tests
    // eslint-disable-next-line no-console
    console.log('[ProjectSaveUI]', _type, _message);
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
