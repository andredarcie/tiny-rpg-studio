
import { ShareDecoder } from '../../runtime/infra/share/ShareDecoder';
import { GameEngine } from '../../runtime/services/GameEngine';
import { getTinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { TextResources } from '../../runtime/adapters/TextResources';

const PREVIEW_CANVAS_WIDTH = 128;
const GAMEPLAY_SIZE = 128;
const GAMEPLAY_OFFSET_Y = 28;

const BACKUP_KEY = 'tiny-rpg-explore-backup';

type JamEntry = {
  itchUrl: string;
  sharedCode: string;
  title: string;
  author: string;
  jam: number;
};

export type GameEntry = {
  id: string;
  url: string;
  title: string;
  author: string;
  itchUrl: string;
  gameData: Record<string, unknown> | null;
};

function renderGamePreview(gameData: Record<string, unknown>): string {
  const src = document.createElement('canvas');
  src.width = PREVIEW_CANVAS_WIDTH;

  const engine = new GameEngine(src);
  engine.importGameData(gameData);

  const offsetY = gameData.hideHud ? 0 : GAMEPLAY_OFFSET_Y;

  const out = document.createElement('canvas');
  out.width = GAMEPLAY_SIZE;
  out.height = GAMEPLAY_SIZE;
  const ctx = out.getContext('2d');
  if (ctx) {
    ctx.drawImage(src, 0, offsetY, GAMEPLAY_SIZE, GAMEPLAY_SIZE, 0, 0, GAMEPLAY_SIZE, GAMEPLAY_SIZE);
  }

  engine.destroy();
  return out.toDataURL('image/png');
}

function saveBackup(data: unknown): void {
  try {
    sessionStorage.setItem(BACKUP_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded — skip
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

let cachedEntries: GameEntry[] | null = null;

async function loadJamGames(): Promise<GameEntry[]> {
  if (cachedEntries) return cachedEntries;

  const resp = await fetch('jam-games.json');
  if (!resp.ok) throw new Error(`Failed to load jam-games.json: ${resp.status}`);
  const raw = await resp.json() as JamEntry[];

  cachedEntries = raw
    .filter(e => e.sharedCode)
    .map((e, i) => {
      let gameData: Record<string, unknown> | null = null;
      let title = e.title;
      let author = e.author;
      try {
        const decoded = ShareDecoder.decodeShareCode(e.sharedCode);
        if (decoded && typeof decoded === 'object') {
          gameData = decoded;
          if (!title && typeof decoded.title === 'string') title = decoded.title;
          if (!author && typeof decoded.author === 'string') author = decoded.author;
        }
      } catch {
        // keep null
      }
      return {
        id: String(i),
        url: e.sharedCode,
        title: title || 'Untitled',
        author: author || 'Anonymous',
        itchUrl: e.itchUrl,
        gameData,
      };
    });

  return cachedEntries;
}

type PreviewJob = { gameData: Record<string, unknown>; img: HTMLImageElement };

class ExploreModal {
  private modal: HTMLElement | null;
  private grid: HTMLElement | null;
  private loadingEl: HTMLElement | null;
  private emptyEl: HTMLElement | null;
  private backBanner: HTMLElement | null;
  private subtitleEl: HTMLElement | null;

  private loaded = false;
  private previewQueue: PreviewJob[] = [];
  private previewRunning = false;

  constructor() {
    this.modal = document.getElementById('explore-modal');
    this.grid = document.getElementById('explore-grid');
    this.loadingEl = document.getElementById('explore-loading');
    this.emptyEl = document.getElementById('explore-empty');
    this.backBanner = document.getElementById('explore-back-banner');
    this.subtitleEl = document.getElementById('explore-subtitle');
    this.bind();
  }

  private bind(): void {
    document.getElementById('btn-explore')?.addEventListener('click', () => this.open());
    document.getElementById('explore-close')?.addEventListener('click', () => this.close());
    document.getElementById('btn-explore-back')?.addEventListener('click', () => this.restoreMyGame());
    this.modal?.addEventListener('click', e => {
      if (e.target === this.modal) this.close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.modal && !this.modal.hidden) this.close();
    });
  }

  open(): void {
    if (!this.modal) return;
    this.modal.hidden = false;
    this.syncBackBanner();
    if (!this.loaded) void this.loadAll();
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

  private async loadAll(): Promise<void> {
    if (this.loadingEl) this.loadingEl.hidden = false;

    let games: GameEntry[];
    try {
      games = await loadJamGames();
    } catch (err) {
      console.warn('[TinyRPG] Explore: failed to load jam-games.json', err);
      games = [];
    }

    if (this.loadingEl) this.loadingEl.hidden = true;
    this.loaded = true;

    if (this.subtitleEl && games.length > 0) {
      this.subtitleEl.textContent = TextResources.format('explore.subtitle', { count: games.length });
    }

    if (games.length === 0) {
      if (this.emptyEl) this.emptyEl.hidden = false;
      return;
    }

    for (const game of games) {
      this.grid?.appendChild(this.renderCard(game));
    }

    this.drainPreviewQueue();
  }

  private renderCard(game: GameEntry): HTMLElement {
    const card = document.createElement('button');
    card.className = 'explore-card';
    card.type = 'button';
    card.setAttribute('aria-label', game.title);
    card.setAttribute('role', 'listitem');
    card.addEventListener('click', () => this.playGame(game));

    const cover = document.createElement('div');
    cover.className = 'explore-card__cover';

    if (game.gameData) {
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

    const byLabel = TextResources.get('explore.by', 'by');
    const authorEl = document.createElement('div');
    authorEl.className = 'explore-card__author';
    authorEl.textContent = `${byLabel} ${game.author}`;

    const itchLink = document.createElement('a');
    itchLink.className = 'explore-card__itch-link';
    itchLink.href = game.itchUrl;
    itchLink.target = '_blank';
    itchLink.rel = 'noopener noreferrer';
    itchLink.textContent = TextResources.get('explore.itchLink', 'itch.io ↗');
    itchLink.setAttribute('aria-label', TextResources.format('explore.itchLinkAria', { title: game.title }, `${game.title} on itch.io`));
    itchLink.addEventListener('click', e => e.stopPropagation());

    info.appendChild(titleEl);
    info.appendChild(authorEl);
    info.appendChild(itchLink);

    card.appendChild(cover);
    card.appendChild(info);
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

    document.dispatchEvent(new CustomEvent('game-tab-activated', { detail: { initial: true } }));
  }
}

export { ExploreModal };
