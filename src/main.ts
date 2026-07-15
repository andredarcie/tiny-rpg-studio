import './styles.css';
import { BootLoadingScreen } from './BootLoadingScreen';
import { applyFontConfig } from './config/FontConfig';
import type { EditorManager } from './editor/EditorManager';
import { EditorExportService } from './editor/modules/EditorExportService';
import { ExploreModal } from './editor/modules/ExploreModal';
import { DevlogModal } from './editor/modules/DevlogModal';
import { AboutModal } from './editor/modules/AboutModal';
import { GameEngine } from './runtime/services/GameEngine';
import { ShareUtils } from './runtime/infra/share/ShareUtils';
import { ProjectSaveManager } from './editor/manager/ProjectSaveManager';
import { getTinyRpgApi, setTinyRpgApi, type TinyRpgApi } from './runtime/infra/TinyRpgApi';
import { TextResources } from './runtime/adapters/TextResources';
import { soundEngine } from './runtime/services/SoundEngine';
import { normalizeBackgroundMusicVolume } from './runtime/infra/share/BackgroundMusicVideoId';
import { PerformanceProfiler, performanceProfiler } from './runtime/debug/PerformanceProfiler';
import { loadAnalyticsWhenIdle } from './analytics/loadAnalytics';
import { track } from './analytics/track';
import { installPwaUpdateChecks, recoverFromDynamicImportFailure } from './pwa/installPwaUpdateChecks';

const getTextResource = (key: string, fallback = ''): string => {
  const value = TextResources.get(key, fallback) as string;
  return value || fallback || key || '';
};

type TabActivationDetail = { initial?: boolean };

class TinyRPGApplication {
  static boot(): void {
    document.addEventListener('DOMContentLoaded', () => {
      BootLoadingScreen.start();
      this.setupWelcomeAudio();
      this.initializeApplication();
      this.setupResponsiveCanvas();
      // Reveal the engine only once its core assets are loaded, so the user
      // never sees the unstyled load happening underneath the boot screen.
      void BootLoadingScreen.finishWhenReady();
    });
  }

  /**
   * Plays a short welcome jingle when the title screen appears and warms up the
   * Web Audio system. Browsers keep audio suspended until the first user
   * gesture, so we (a) play it on `boot-finished` if audio is already unlocked,
   * and (b) otherwise unlock + play on the very first interaction. Either way the
   * audio context is running before the first dialog, so its sounds never glitch.
   */
  static setupWelcomeAudio(): void {
    let welcomed = false;
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    const removeListeners = () => events.forEach((e) => globalThis.removeEventListener(e, onGesture));
    const playWelcome = () => {
      if (welcomed) return;
      welcomed = true;
      soundEngine.unlock();
      soundEngine.play('gameStart');
      removeListeners();
    };
    const onGesture = () => playWelcome();
    events.forEach((e) => globalThis.addEventListener(e, onGesture, { passive: true }));
    document.addEventListener('boot-finished', () => {
      // Do not unlock here: creating/resuming the AudioContext before the first
      // user gesture triggers Chrome's "AudioContext was not allowed to start"
      // warning (and can't actually start audio anyway). The first-gesture
      // handler above unlocks audio properly. If the user already interacted
      // (context running), play the welcome jingle now.
      if (soundEngine.isRunning()) playWelcome();
    });
  }

  static initializeApplication(): void {
    applyFontConfig();

    // Load analytics off the boot critical path (idle) for every entry path —
    // normal, online and export — restoring the coverage the old <head> gtag had.
    loadAnalyticsWhenIdle();

    // Mutable dirty-state guard so PWA recovery can be installed before the
    // editor module exists, and still protect unsaved work once it does.
    let editorManager: EditorManager | null = null;
    const pwaDirtyState = {
      hasUnsavedChanges: () => editorManager?.hasUnsavedChangesForUpdate() ?? false,
      saveBeforeUpdate: () => editorManager?.saveBeforePwaUpdate() ?? true,
    };
    // Install early so vite:preloadError / missing-chunk recovery is armed before
    // any code-split import (editor or online mode).
    installPwaUpdateChecks({ dirtyState: pwaDirtyState });

    const onlineGuid = this.detectOnlineMode();
    if (onlineGuid) {
      this.bootOnlineMode(onlineGuid);
      return;
    }

    this.setupTabs();

    const gameCanvas = document.getElementById('game-canvas');
    if (!(gameCanvas instanceof HTMLCanvasElement)) return;

    // Enable the profiler before the engine is built so boot work is measured;
    // the time() wrappers below are no-ops when profiling is off. See AP-9.
    if (PerformanceProfiler.isRequested()) {
      performanceProfiler.enable({ renderLoop: PerformanceProfiler.renderLoopRequested() });
    }
    const gameEngine = performanceProfiler.time('boot.engineCtor', () => new GameEngine(gameCanvas));
    performanceProfiler.time('boot.loadShared', () => this.loadSharedGameIfAvailable(gameEngine));
    this.setupPerformanceProfiler(gameEngine);
    const isExportMode = Boolean((globalThis as Record<string, unknown>).__TINY_RPG_EXPORT_MODE);
    let editorLoad: Promise<void> | null = null;
    // The editor bundle is code-split and loaded on first editor activation, so a
    // player who only opens a shared game never downloads it. See AP-8.
    const ensureEditor = (): Promise<void> => {
      if (isExportMode) return Promise.resolve();
      if (editorLoad) return editorLoad;
      editorLoad = import('./editor/EditorManager')
        .then(({ EditorManager }) => {
          editorManager = new EditorManager(gameEngine);
        })
        .catch((error: unknown) => {
          console.error('[TinyRPG] Failed to load the editor module.', error);
          // Stale PWA cache after deploy: hashed chunk is gone — auto-reload.
          if (recoverFromDynamicImportFailure(error)) {
            return;
          }
          // Non-stale failure: allow a later tab switch to retry the import.
          editorLoad = null;
        });
      return editorLoad;
    };

    document.addEventListener('game-tab-activated', (ev) => {
      const event = ev as CustomEvent<TabActivationDetail>;
      if (event.detail.initial) return;
      gameEngine.resetGame();
      if (typeof gameEngine.resumeBackgroundMusic === 'function') {
        gameEngine.resumeBackgroundMusic();
      }
    });
    document.addEventListener('editor-tab-activated', (ev) => {
      const event = ev as CustomEvent<TabActivationDetail>;
      if (event.detail.initial) return;
      gameEngine.resetGame();
      // Load the code-split editor and (re-)render its panels once available; the
      // synchronous renderAll in setupTabs is a no-op until then. See AP-8.
      void ensureEditor().then(() => getTinyRpgApi()?.renderAll());
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

    new EditorExportService();
    new ExploreModal();
    new DevlogModal();
    new AboutModal();
    this.bindResetButton(gameEngine);
    this.bindExportResetButton(gameEngine);
    this.bindTouchPad(gameEngine);
    this.bindFullscreenButton();
    this.bindBackgroundMusicVolumeControl(gameEngine);
    this.bindLanguageSelector();

    console.log(getTextResource('log.engineReady'));
  }

    static getLocation(): Location | null {
      return ((globalThis as typeof globalThis & { location?: Location }).location) ?? null;
    }

    /**
     * Attaches the profiler's instrumentation to the built engine. `enable()` is
     * called earlier (before engine construction) so boot work is timed too, so
     * this is a no-op unless the page was loaded with a `?profile` flag. Inert for
     * normal players — it never touches production.
     */
    static setupPerformanceProfiler(gameEngine: GameEngine): void {
      // enable() is called earlier (before engine construction) so boot is timed;
      // here we only attach the instrumentation to the now-built engine.
      if (!performanceProfiler.isEnabled) return;
      performanceProfiler.attach(gameEngine as never);
      console.log('[TinyRPG] Performance profiler enabled.');
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
        track('new_game_clicked');
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

  /** Export-only reset control (`#btn-export-reset`); no-ops when the node is absent. */
  static bindExportResetButton(gameEngine: GameEngine): void {
    const button = document.getElementById('btn-export-reset');
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener('click', () => {
      gameEngine.resetGame();
      button.blur();
    });
  }

  static bindTouchPad(gameEngine: GameEngine): void {
    // The mini D-pad is always visible on touch screens (CSS-driven); here we
    // only wire its arrows to player movement / dialog advancing.
    const touchButtons = document.querySelectorAll<HTMLButtonElement>(
      '.game-touch-pad .pad-button[data-direction]',
    );
    if (!touchButtons.length) return;

    type Direction = 'left' | 'right' | 'up' | 'down';
    const directionMap: Record<Direction, [number, number]> = {
      left: [-1, 0],
      right: [1, 0],
      up: [0, -1],
      down: [0, 1],
    };

    touchButtons.forEach((btn) => {
      // Pointer events cover both touch and mouse. Touch can't rely on CSS
      // :active (and our preventDefault suppresses it), so we drive the
      // "pressed" visual with a class while the pointer is down.
      const release = () => btn.classList.remove('is-pressed');
      btn.addEventListener(
        'pointerdown',
        (ev) => {
          // Ignore non-primary mouse buttons; touch/pen report button 0.
          if (ev.button !== 0) return;
          ev.preventDefault();
          btn.classList.add('is-pressed');
          const dialog = gameEngine.gameState.getDialog();
          if (dialog.active) {
            gameEngine.advanceDialog();
            return;
          }
          const dir = btn.dataset.direction as Direction | undefined;
          if (!dir) return;
          const delta = directionMap[dir];
          gameEngine.tryMove(delta[0], delta[1]);
        },
      );
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    });
  }

  static bindFullscreenButton(): void {
    const gameContainer = document.getElementById('game-container');
    if (!(gameContainer instanceof HTMLElement)) return;

    const desktopQuery = typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(hover: hover) and (pointer: fine)')
      : null;
    const button = document.createElement('button');
    button.id = 'game-fullscreen-toggle';
    button.type = 'button';
    button.className = 'game-fullscreen-button';
    button.hidden = true;
    gameContainer.appendChild(button);

    const isFullscreenActive = () => document.fullscreenElement === gameContainer;

    const syncButtonState = () => {
      const active = isFullscreenActive();
      const label = active
        ? getTextResource('aria.fullscreenExit', 'Exit fullscreen')
        : getTextResource('aria.fullscreenEnter', 'Enter fullscreen');
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('title', label);
      button.dataset.state = active ? 'exit' : 'enter';
      button.classList.toggle('is-active', active);
    };

    const updateVisibility = () => {
      const isDesktop = desktopQuery?.matches ?? false;
      const isGameMode = document.body.classList.contains('game-mode');
      button.hidden = !isDesktop || !isGameMode;
    };

    button.addEventListener('click', () => {
      if (isFullscreenActive()) {
        void document.exitFullscreen();
        return;
      }
      void gameContainer.requestFullscreen();
    });

    const handleEditorActivation = () => {
      updateVisibility();
      if (isFullscreenActive()) {
        void document.exitFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', syncButtonState);
    document.addEventListener('fullscreenchange', updateVisibility);
    document.addEventListener('game-tab-activated', updateVisibility);
    document.addEventListener('editor-tab-activated', handleEditorActivation);
    document.addEventListener('language-changed', syncButtonState);

    if (desktopQuery) {
      const onViewportChange = () => updateVisibility();
      desktopQuery.addEventListener('change', onViewportChange);
    }

    syncButtonState();
    updateVisibility();
  }

  static bindBackgroundMusicVolumeControl(gameEngine: GameEngine): void {
    const gameContainer = document.getElementById('game-container');
    if (!(gameContainer instanceof HTMLElement)) return;

    const desktopQuery = typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(hover: hover) and (pointer: fine)')
      : null;
    const controls = document.createElement('div');
    controls.id = 'game-audio-controls';
    controls.className = 'game-audio-controls';
    controls.hidden = true;

    const label = document.createElement('label');
    label.className = 'game-audio-controls__label';
    label.setAttribute('for', 'game-background-music-volume');

    const slider = document.createElement('input');
    slider.id = 'game-background-music-volume';
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';

    const value = document.createElement('span');
    value.id = 'game-background-music-volume-value';
    value.setAttribute('aria-live', 'polite');

    label.append(slider, value);
    controls.appendChild(label);
    gameContainer.appendChild(controls);

    const syncValue = (volume: number) => {
      const normalized = normalizeBackgroundMusicVolume(volume);
      slider.value = String(normalized);
      value.textContent = `${normalized}%`;
    };

    const updateVisibility = () => {
      const game = gameEngine.getGame() as { backgroundMusicVideoId?: string };
      const isDesktop = desktopQuery?.matches ?? false;
      const isGameMode = document.body.classList.contains('game-mode');
      const hasMusic = typeof game.backgroundMusicVideoId === 'string' && game.backgroundMusicVideoId.trim().length > 0;
      controls.hidden = !isDesktop || !isGameMode || !hasMusic;
      if (!controls.hidden) {
        syncValue(gameEngine.backgroundMusicEngine.getVolume());
      }
    };

    slider.addEventListener('input', () => {
      const volume = normalizeBackgroundMusicVolume(Number(slider.value));
      gameEngine.backgroundMusicEngine.setVolume(volume);
      syncValue(volume);
    });

    document.addEventListener('game-tab-activated', updateVisibility);
    document.addEventListener('editor-tab-activated', updateVisibility);
    document.addEventListener('share-url-ready', updateVisibility);
    if (desktopQuery) {
      desktopQuery.addEventListener('change', updateVisibility);
    }

    updateVisibility();
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
      track('tab_switch', { tab: tabName });

      if (tabName === 'game') {
        document.dispatchEvent(new CustomEvent('game-tab-activated', { detail: { initial: false } }));
      }

      if (tabName === 'editor') {
        const api = getTinyRpgApi();
        if (!api) return;
        api.resetNPCs();
        api.draw();
        document.dispatchEvent(new CustomEvent('editor-tab-activated', { detail: { initial: false } }));
        // renderAll is a no-op until the code-split editor module has loaded; the
        // editor-tab-activated handler re-renders the panels once it is ready (AP-8).
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

  static detectOnlineMode(): string | null {
    if (typeof globalThis.location === 'undefined') return null;
    const params = new URLSearchParams(globalThis.location.search);
    return params.get('online-mode') ?? params.get('modo-online');
  }

  static bootOnlineMode(guid: string): void {
    // Multiplayer is code-split: only fetched when the URL requests online mode.
    void import('./online/OnlineModeApplication')
      .then(({ OnlineModeApplication }) => {
        OnlineModeApplication.boot(guid, (gameEngine) => this.loadSharedGameIfAvailable(gameEngine));
      })
      .catch((error: unknown) => {
        console.error('[TinyRPG] Failed to load the online mode module.', error);
        recoverFromDynamicImportFailure(error);
      });
  }

  static loadSharedGameIfAvailable(gameEngine: GameEngine): void {
    const dataFromLocation = ShareUtils.extractGameDataFromLocation(globalThis.location);
    if (dataFromLocation) {
      gameEngine.importGameData(dataFromLocation);
      return;
    }

    const sharedCode = (globalThis as Record<string, unknown>).__TINY_RPG_SHARED_CODE;
    if (typeof sharedCode === 'string' && sharedCode.trim().length > 0) {
      try {
        const decoded = ShareUtils.decode(sharedCode);
        if (decoded) {
          gameEngine.importGameData(decoded);
          return;
        }
      } catch (error) {
        console.warn('[TinyRPG] Unable to decode shared game data from inline code.', error);
      }
    }

    // No game in the URL/inline code: restore the user's most recently saved
    // project from localStorage so a plain reload keeps their work instead of
    // resetting to the default Studio data. The editor "Save" persists there,
    // and the page URL is not kept in sync with every edit.
    try {
      const savedUrl = ProjectSaveManager.getMostRecentShareUrl();
      const restored = savedUrl ? ShareUtils.extractGameDataFromShareUrl(savedUrl) : null;
      if (restored) {
        gameEngine.importGameData(restored);
      }
    } catch (error) {
      console.warn('[TinyRPG] Unable to restore the last saved project.', error);
    }
  }

  static setupResponsiveCanvas(): void {
    const gameCanvas = document.getElementById('game-canvas');
    const gameContainer = document.getElementById('game-container');
    if (!(gameCanvas instanceof HTMLCanvasElement) || !gameContainer) {
      return;
    }

    // The .game-screen wrapper hugs the canvas; everything else inside the
    // container (mobile touch toggle, online player list, etc.) is chrome whose
    // height must be reserved so the canvas never grows underneath it.
    const gameScreen = gameCanvas.closest('.game-screen') ?? gameCanvas.parentElement;

    const isVisibleFlowChild = (el: Element): boolean => {
      const cs = getComputedStyle(el);
      if (cs.position === 'absolute' || cs.position === 'fixed') return false;
      if (cs.display === 'none') return false;
      return el === gameScreen || el.getClientRects().length > 0;
    };

    const resizeCanvas = () => {
      const cs = getComputedStyle(gameContainer);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const gap = parseFloat(cs.rowGap || cs.gap || '') || 0;
      const rect = gameContainer.getBoundingClientRect();

      // Sum the height of every visible sibling that shares the column with the
      // canvas, plus the flex gaps between them, so we can subtract it.
      let reservedY = 0;
      let flowChildren = 0;
      for (const child of Array.from(gameContainer.children)) {
        if (!isVisibleFlowChild(child)) continue;
        flowChildren += 1;
        const ccs = getComputedStyle(child);
        const marginY = (parseFloat(ccs.marginTop) || 0) + (parseFloat(ccs.marginBottom) || 0);
        // Reserve only the wrapper's margins (its size is what we are solving for).
        reservedY += child === gameScreen ? marginY : (child as HTMLElement).offsetHeight + marginY;
      }
      if (flowChildren > 1) reservedY += gap * (flowChildren - 1);

      const availableWidth = Math.max(64, (rect.width || globalThis.innerWidth) - padX);
      const availableHeight = Math.max(64, (rect.height || globalThis.innerHeight) - padY - reservedY);
      const aspectRatio = (gameCanvas.height || 1) / (gameCanvas.width || 1);

      // Fit within both axes, preserving aspect ratio, leaving a sliver of room.
      const FILL = 0.98;
      const targetWidth = Math.min(availableWidth, availableHeight / aspectRatio) * FILL;
      const targetHeight = targetWidth * aspectRatio;
      gameCanvas.style.width = `${targetWidth}px`;
      gameCanvas.style.height = `${targetHeight}px`;
    };

    const scheduleResize = () => globalThis.requestAnimationFrame(resizeCanvas);

    globalThis.addEventListener('resize', scheduleResize);
    document.addEventListener('game-tab-activated', scheduleResize);
    document.addEventListener('fullscreenchange', scheduleResize);

    // The boot rAF below can fire before the layout has fully settled (pixel font
    // reflow, the chrome the canvas must fit around). When it measures too early,
    // availableHeight collapses to its floor and the canvas locks in tiny until
    // the next event. Re-fit once boot completes — it is dispatched only after the
    // fonts, bitmap sheet and styles are ready, so the layout is final by then.
    document.addEventListener('boot-finished', scheduleResize);
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(scheduleResize).catch(() => undefined);
    }

    // Re-fit when layout-affecting body classes change — switching between
    // game/editor mode and toggling the mobile touch controls both alter the
    // chrome that surrounds the canvas.
    if (typeof MutationObserver === 'function') {
      const observer = new MutationObserver(scheduleResize);
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    // Self-correct against any later layout shift of the container itself, so the
    // canvas never stays mis-sized waiting for a resize/tab event that may not come.
    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(scheduleResize);
      resizeObserver.observe(gameContainer);
    }

    scheduleResize();
  }
}

TinyRPGApplication.boot();
export { TinyRPGApplication };
