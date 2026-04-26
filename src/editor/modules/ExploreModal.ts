
import { FirebaseGamesService, type GameEntry, type GamesPage } from '../../runtime/infra/share/FirebaseGamesService';
import { GameEngine } from '../../runtime/services/GameEngine';
import { getTinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { TextResources } from '../../runtime/adapters/TextResources';

// Gameplay area dimensions matching the engine's defaults at canvas.width=128
const PREVIEW_CANVAS_WIDTH = 128;
const GAMEPLAY_SIZE = 128;   // 8 tiles × 16px each
const GAMEPLAY_OFFSET_Y = 28; // hudBarHeight at this canvas width

const BACKUP_KEY = 'tiny-rpg-explore-backup';

function renderGamePreview(gameData: Record<string, unknown>): string {
  const src = document.createElement('canvas');
  src.width = PREVIEW_CANVAS_WIDTH;

  const engine = new GameEngine(src);
  engine.importGameData(gameData);

  const out = document.createElement('canvas');
  out.width = GAMEPLAY_SIZE;
  out.height = GAMEPLAY_SIZE;
  const ctx = out.getContext('2d');
  if (ctx) {
    ctx.drawImage(src, 0, GAMEPLAY_OFFSET_Y, GAMEPLAY_SIZE, GAMEPLAY_SIZE, 0, 0, GAMEPLAY_SIZE, GAMEPLAY_SIZE);
  }

  engine.destroy();
  return out.toDataURL('image/png');
}

function saveBackup(data: unknown): void {
  try {
    sessionStorage.setItem(BACKUP_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded or unavailable — skip silently
  }
}

function loadBackup(): unknown | null {
  try {
    const raw = sessionStorage.getItem(BACKUP_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function clearBackup(): void {
  try {
    sessionStorage.removeItem(BACKUP_KEY);
  } catch {
    // ignore
  }
}

type PreviewJob = { gameData: Record<string, unknown>; img: HTMLImageElement };

class ExploreModal {
  private modal: HTMLElement | null;
  private grid: HTMLElement | null;
  private loadMoreBtn: HTMLButtonElement | null;
  private loadingEl: HTMLElement | null;
  private emptyEl: HTMLElement | null;
  private backBanner: HTMLElement | null;

  private cursor: unknown = null;
  private hasMore = false;
  private isLoading = false;

  private previewQueue: PreviewJob[] = [];
  private previewRunning = false;

  constructor() {
    this.modal = document.getElementById('explore-modal');
    this.grid = document.getElementById('explore-grid');
    this.loadMoreBtn = document.getElementById('explore-load-more') as HTMLButtonElement | null;
    this.loadingEl = document.getElementById('explore-loading');
    this.emptyEl = document.getElementById('explore-empty');
    this.backBanner = document.getElementById('explore-back-banner');
    this.bind();
  }

  private bind(): void {
    document.getElementById('btn-explore')?.addEventListener('click', () => this.open());
    document.getElementById('explore-close')?.addEventListener('click', () => this.close());
    document.getElementById('btn-explore-back')?.addEventListener('click', () => this.restoreMyGame());
    this.modal?.addEventListener('click', e => {
      if (e.target === this.modal) this.close();
    });
    this.loadMoreBtn?.addEventListener('click', () => { void this.loadPage(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.modal && !this.modal.hidden) this.close();
    });
  }

  open(): void {
    if (!this.modal) return;
    this.modal.hidden = false;
    this.syncBackBanner();
    this.reset();
    void this.loadPage();
  }

  close(): void {
    if (!this.modal) return;
    this.modal.hidden = true;
    this.previewQueue = [];
  }

  private syncBackBanner(): void {
    if (!this.backBanner) return;
    this.backBanner.hidden = loadBackup() === null;
  }

  private reset(): void {
    this.cursor = null;
    this.hasMore = false;
    this.previewQueue = [];
    if (this.grid) this.grid.innerHTML = '';
    if (this.emptyEl) this.emptyEl.hidden = true;
    if (this.loadMoreBtn) this.loadMoreBtn.hidden = true;
  }

  private async loadPage(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    if (this.loadingEl) this.loadingEl.hidden = false;

    const result: GamesPage = await FirebaseGamesService.fetchPage(this.cursor || undefined);

    if (this.loadingEl) this.loadingEl.hidden = true;
    this.isLoading = false;
    this.cursor = result.cursor;
    this.hasMore = result.hasMore;

    if (result.games.length === 0 && !this.grid?.childElementCount) {
      if (this.emptyEl) this.emptyEl.hidden = false;
    } else {
      for (const game of result.games) {
        this.grid?.appendChild(this.renderCard(game));
      }
    }

    if (this.loadMoreBtn) this.loadMoreBtn.hidden = !this.hasMore;
    this.drainPreviewQueue();
  }

  private renderCard(game: GameEntry): HTMLElement {
    const card = document.createElement('button');
    card.className = 'explore-card';
    card.type = 'button';
    card.setAttribute('aria-label', game.title);
    card.setAttribute('role', 'listitem');

    const cover = document.createElement('div');
    cover.className = 'explore-card__cover';

    if (game.coverImage) {
      const img = document.createElement('img');
      img.src = game.coverImage;
      img.alt = '';
      img.className = 'explore-card__img';
      img.loading = 'lazy';
      cover.appendChild(img);
    } else if (game.gameData) {
      const placeholder = document.createElement('span');
      placeholder.className = 'explore-card__preview-placeholder';
      cover.appendChild(placeholder);

      const img = document.createElement('img');
      img.alt = '';
      img.className = 'explore-card__img explore-card__img--hidden';
      cover.appendChild(img);

      this.previewQueue.push({ gameData: game.gameData, img });
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'explore-card__no-cover';
      placeholder.textContent = '?';
      cover.appendChild(placeholder);
    }

    const info = document.createElement('div');
    info.className = 'explore-card__info';

    const titleEl = document.createElement('div');
    titleEl.className = 'explore-card__title';
    titleEl.textContent = game.title;

    const byLabel = TextResources.get('explore.by', 'por');
    const authorEl = document.createElement('div');
    authorEl.className = 'explore-card__author';
    authorEl.textContent = `${byLabel} ${game.author}`;

    info.appendChild(titleEl);
    info.appendChild(authorEl);

    card.appendChild(cover);
    card.appendChild(info);
    card.addEventListener('click', () => this.playGame(game));
    return card;
  }

  private drainPreviewQueue(): void {
    if (this.previewRunning || this.previewQueue.length === 0) return;
    this.previewRunning = true;
    this.processNextPreview();
  }

  private processNextPreview(): void {
    const job = this.previewQueue.shift();
    if (!job) {
      this.previewRunning = false;
      return;
    }

    requestAnimationFrame(() => {
      const dataUrl = renderGamePreview(job.gameData);
      job.img.src = dataUrl;
      job.img.classList.remove('explore-card__img--hidden');

      job.img.addEventListener('load', () => {
        const placeholder = job.img.previousElementSibling;
        if (placeholder?.classList.contains('explore-card__preview-placeholder')) {
          placeholder.remove();
        }
      }, { once: true });

      this.processNextPreview();
    });
  }

  private playGame(game: GameEntry): void {
    if (!game.gameData) {
      console.warn('[TinyRPG] Explore: could not decode game.', game.id);
      return;
    }

    const api = getTinyRpgApi();
    if (!api) return;

    // Save the user's current project only if there's no backup yet
    // (avoid overwriting their real project with another explored game)
    if (loadBackup() === null) {
      saveBackup(api.exportGameData());
    }

    this.close();
    this.activateGameTab();
    api.resetGame();
    api.importGameData(game.gameData);
  }

  private restoreMyGame(): void {
    const backup = loadBackup();
    if (!backup) return;

    const api = getTinyRpgApi();
    if (!api) return;

    clearBackup();
    this.close();
    this.activateGameTab();
    api.resetGame();
    api.importGameData(backup);
  }

  private activateGameTab(): void {
    document.querySelectorAll<HTMLButtonElement>('.tab-button[data-tab]').forEach(btn => {
      const isGame = btn.dataset.tab === 'game';
      btn.classList.toggle('active', isGame);
      btn.setAttribute('aria-selected', isGame ? 'true' : 'false');
    });

    document.querySelectorAll<HTMLElement>('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-game')?.classList.add('active');

    document.body.classList.remove('editor-mode');
    document.body.classList.add('game-mode');

    // initial: true so the main listener skips its own resetGame call
    document.dispatchEvent(new CustomEvent('game-tab-activated', { detail: { initial: true } }));
  }
}

export { ExploreModal };
