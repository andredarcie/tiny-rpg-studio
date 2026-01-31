import { EditorManager } from './editor/EditorManager';
import { EditorExportService } from './editor/modules/EditorExportService';
import { GameEngine } from './runtime/services/GameEngine';
import { ShareUtils } from './runtime/infra/share/ShareUtils';
import { getTinyRpgApi, setTinyRpgApi, type TinyRpgApi } from './runtime/infra/TinyRpgApi';
import { TextResources } from './runtime/adapters/TextResources';

const getTextResource = (key: string, fallback = ''): string => {
  const value = TextResources.get(key, fallback) as string;
  return value || fallback || key || '';
};

type TabActivationDetail = { initial?: boolean };

class TinyRPGApplication {
  static boot(): void {
    document.addEventListener('DOMContentLoaded', () => {
      this.initializeApplication();
      this.setupResponsiveCanvas();
    });
  }

  static initializeApplication(): void {
    this.setupTabs();

    const gameCanvas = document.getElementById('game-canvas');
    if (!(gameCanvas instanceof HTMLCanvasElement)) return;

    const gameEngine = new GameEngine(gameCanvas);
    this.loadSharedGameIfAvailable(gameEngine);
    const isExportMode = Boolean((globalThis as Record<string, unknown>).__TINY_RPG_EXPORT_MODE);
    let editorManager: EditorManager | null = null;

    document.addEventListener('game-tab-activated', (ev) => {
      const event = ev as CustomEvent<TabActivationDetail>;
      if (event.detail.initial) return;
      gameEngine.resetGame();
    });
    document.addEventListener('editor-tab-activated', (ev) => {
      const event = ev as CustomEvent<TabActivationDetail>;
      if (event.detail.initial) return;
      gameEngine.resetGame();
    });

    const api: TinyRpgApi = {
      exportGameData: () => gameEngine.exportGameData(),
      importGameData: (data: unknown) => gameEngine.importGameData(data),
      getState: () => gameEngine.getState(),
      draw: () => gameEngine.draw(),
      resetGame: () => gameEngine.resetGame(),
      updateTile: (tileId: string | number, data: unknown) => gameEngine.updateTile(tileId, data as Parameters<typeof gameEngine.updateTile>[1]),
      setMapTile: (x: number, y: number, tileId: string | number) => gameEngine.setMapTile(x, y, tileId),
      getTiles: () => gameEngine.getTiles(),
      getTileMap: () => gameEngine.getTileMap(),
      getTilePresetNames: () => gameEngine.getTilePresetNames(),
      getVariables: () => gameEngine.getVariableDefinitions(),
      setVariableDefault: (variableId: string | number, value: unknown) =>
        gameEngine.setVariableDefault(typeof variableId === 'string' ? variableId : String(variableId), value),
      addSprite: (npc: unknown) => gameEngine.addSprite(npc),
      getSprites: () => gameEngine.getSprites(),
      resetNPCs: () => gameEngine.npcManager.resetNPCs(),
      renderAll: () => editorManager?.renderAll(),
    };
    setTinyRpgApi(api);

    if (!isExportMode) {
      editorManager = new EditorManager(gameEngine);
    }
    new EditorExportService();
    this.bindResetButton(gameEngine);
    this.bindTouchPad(gameEngine);
    this.bindLanguageSelector();

    console.log(getTextResource('log.engineReady'));
  }

    static getLocation(): Location | null {
      return ((globalThis as typeof globalThis & { location?: Location }).location) ?? null;
    }

    static bindResetButton(gameEngine: GameEngine): void {
    const resetButton = document.getElementById('btn-reset');
    if (!(resetButton instanceof HTMLButtonElement)) return;

      const getBaseUrl = () => {
        const location = this.getLocation();
        if (!location) return '';
        return `${location.origin}${location.pathname}`;
      };

    const openNewGameTab = (url: string) => {
      const popup = globalThis.open(url, '_blank', 'noopener');
      if (popup) {
        return true;
      }
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.style.position = 'absolute';
      anchor.style.left = '-9999px';
      document.body.appendChild(anchor);
      anchor.click();
      requestAnimationFrame(() => anchor.remove());
      return true;
    };

    const handleClick = (ev: MouseEvent) => {
      const isEditorMode = document.body.classList.contains('editor-mode');
      if (isEditorMode) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const targetUrl = getBaseUrl();
        openNewGameTab(targetUrl);
        resetButton.blur();
        return false;
      }
      gameEngine.resetGame();
      resetButton.blur();
      return false;
    };

    const updateButtonState = () => {
      const isEditorMode = document.body.classList.contains('editor-mode');
      if (isEditorMode) {
        resetButton.textContent = getTextResource('buttons.newGame');
        resetButton.setAttribute('aria-label', getTextResource('aria.newGame'));
      } else {
        resetButton.textContent = getTextResource('buttons.reset');
        resetButton.setAttribute('aria-label', getTextResource('aria.reset'));
      }
    };

    resetButton.addEventListener('click', handleClick);
    document.addEventListener('game-tab-activated', updateButtonState);
    document.addEventListener('editor-tab-activated', updateButtonState);
    document.addEventListener('language-changed', updateButtonState);
    updateButtonState();
  }

  static bindTouchPad(gameEngine: GameEngine): void {
    const touchButtons = document.querySelectorAll<HTMLButtonElement>(
      '.game-touch-pad .pad-button[data-direction]',
    );
    const toggleButton = document.getElementById('touch-controls-toggle');
    const hideButton = document.getElementById('touch-controls-hide');
    const padContainer = document.getElementById('mobile-touch-pad');

    if (!touchButtons.length || !(toggleButton instanceof HTMLButtonElement) || !padContainer)
      return;

    type Direction = 'left' | 'right' | 'up' | 'down';
    const directionMap: Record<Direction, [number, number]> = {
      left: [-1, 0],
      right: [1, 0],
      up: [0, -1],
      down: [0, 1],
    };

    touchButtons.forEach((btn) => {
      btn.addEventListener(
        'touchstart',
        (ev) => {
          ev.preventDefault();
          const dir = btn.dataset.direction as Direction | undefined;
          if (!dir) return;
          const delta = directionMap[dir];
          gameEngine.tryMove(delta[0], delta[1]);
        },
        { passive: false },
      );
    });

    let showControlsText = '';
    let hideControlsText = '';

    const syncTouchTexts = () => {
      showControlsText = getTextResource('touchControls.show');
      hideControlsText = getTextResource('touchControls.hide');
      toggleButton.textContent = showControlsText;
      if (hideButton instanceof HTMLButtonElement) {
        hideButton.textContent = hideControlsText;
        hideButton.setAttribute('aria-label', hideControlsText);
      }
    };

    syncTouchTexts();

    const updateToggleState = () => {
      const isVisible = document.body.classList.contains('touch-controls-visible');
      toggleButton.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
      toggleButton.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
      padContainer.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
      if (!isVisible) {
        toggleButton.textContent = showControlsText;
      }
      if (hideButton instanceof HTMLButtonElement) {
        hideButton.hidden = !isVisible;
        if (isVisible) {
          hideButton.textContent = hideControlsText;
        }
      }
    };

    toggleButton.addEventListener('click', () => {
      document.body.classList.add('touch-controls-visible');
      updateToggleState();
    });

    if (hideButton instanceof HTMLButtonElement) {
      hideButton.addEventListener('click', () => {
        document.body.classList.remove('touch-controls-visible');
        updateToggleState();
      });
    }

    const hideControls = () => {
      document.body.classList.remove('touch-controls-visible');
      updateToggleState();
    };

    document.addEventListener('editor-tab-activated', hideControls);
    document.addEventListener('game-tab-activated', updateToggleState);
    document.addEventListener('language-changed', () => {
      syncTouchTexts();
      updateToggleState();
    });

    updateToggleState();
  }

  static bindLanguageSelector(): void {
    const select = document.getElementById('language-select');
    if (!(select instanceof HTMLSelectElement)) return;

    const syncSelect = () => {
      select.value = TextResources.getLocale() as string;
    };

    syncSelect();

    select.addEventListener('change', () => {
      const locale = select.value;
      if (!locale) return;
      const changed = TextResources.setLocale(locale) as boolean;
      if (!changed) {
        syncSelect();
      }
    });

    document.addEventListener('language-changed', syncSelect);
  }

  static setupTabs(): void {
    const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-button[data-tab]');
    const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');

    const applyLayoutMode = (tabName: string) => {
      const isEditor = tabName === 'editor';
      const isGame = tabName === 'game';
      document.body.classList.toggle('editor-mode', isEditor);
      document.body.classList.toggle('game-mode', isGame);
    };

    const activateTab = (btn: HTMLButtonElement) => {
      if (btn.classList.contains('active')) {
        return;
      }

      const tabName = btn.dataset.tab;
      if (!tabName) return;

      tabs.forEach((other) => {
        other.classList.remove('active');
        other.setAttribute('aria-selected', 'false');
      });

      tabContents.forEach((content) => content.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const targetId = `tab-${tabName}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      applyLayoutMode(tabName);

      if (tabName === 'game') {
        document.dispatchEvent(new CustomEvent('game-tab-activated'));
      }

      if (tabName === 'editor') {
        const api = getTinyRpgApi();
        if (!api) return;
        api.resetNPCs();
        api.draw();
        document.dispatchEvent(new CustomEvent('editor-tab-activated'));
        api.renderAll();
        const currentData = api.exportGameData();
        api.importGameData(currentData);
      }
    };

    tabs.forEach((btn) => {
      btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        activateTab(btn);
      });
      btn.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          activateTab(btn);
        }
      });
    });

    const initialTab = document.querySelector<HTMLButtonElement>(
      '.tab-button.active[data-tab]',
    );
    if (initialTab?.dataset.tab) {
      applyLayoutMode(initialTab.dataset.tab);
      if (initialTab.dataset.tab === 'game') {
        document.dispatchEvent(
          new CustomEvent('game-tab-activated', { detail: { initial: true } }),
        );
      }
      if (initialTab.dataset.tab === 'editor') {
        document.dispatchEvent(
          new CustomEvent('editor-tab-activated', { detail: { initial: true } }),
        );
      }
    }
  }

  static loadSharedGameIfAvailable(gameEngine: GameEngine): void {
    const data = ShareUtils.extractGameDataFromLocation(globalThis.location);
    if (data) {
      gameEngine.importGameData(data);
    }
  }

  static setupResponsiveCanvas(): void {
    const gameCanvas = document.getElementById('game-canvas');
    const gameContainer = document.getElementById('game-container');
    if (!(gameCanvas instanceof HTMLCanvasElement) || !gameContainer) {
      return;
    }

    const resizeCanvas = () => {
      const rect = gameContainer.getBoundingClientRect();
      const availableWidth = rect.width || globalThis.innerWidth;
      const availableHeight = rect.height || globalThis.innerHeight;
      const aspectRatio = (gameCanvas.height || 1) / (gameCanvas.width || 1);
      const maxWidth = Math.max(128, availableWidth * 0.9);
      const maxHeight = Math.max(128, availableHeight * 0.9);
      const widthLimitedByHeight = maxHeight / aspectRatio;
      const targetWidth = Math.min(maxWidth, widthLimitedByHeight);
      const targetHeight = targetWidth * aspectRatio;
      gameCanvas.style.width = `${targetWidth}px`;
      gameCanvas.style.height = `${targetHeight}px`;
    };

    const scheduleResize = () => globalThis.requestAnimationFrame(resizeCanvas);

    globalThis.addEventListener('resize', scheduleResize);
    document.addEventListener('game-tab-activated', scheduleResize);

    scheduleResize();
  }
}

TinyRPGApplication.boot();
export { TinyRPGApplication };
