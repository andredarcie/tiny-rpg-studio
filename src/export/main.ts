import { createBaseRuntimeApi, type BaseRuntimeApi } from '../runtime/infra/BaseRuntimeApi';
import type { OnlineSessionOptions } from '../online/OnlineSession';
import './styles.css';
import { normalizeBackgroundMusicVolume } from '../runtime/infra/share/BackgroundMusicVideoId';
import { ShareUtils } from '../runtime/infra/share/ShareUtils';
import { TextResources } from '../runtime/adapters/TextResources';
import { installGlobalErrorReporter } from '../runtime/adapters/GlobalErrorReporter';
import { GameEngine } from '../runtime/services/GameEngine';
import { soundEngine } from '../runtime/services/SoundEngine';
import { GameplayPluginHost } from '../runtime/infra/GameplayPluginHost';
import type { InstalledPlugin } from '../editor/manager/PluginManager';

const text = (key: string, fallback: string): string =>
    String(TextResources.get(key, fallback) || fallback);

class ExportApplication {
    static runtime: BaseRuntimeApi | null = null;
    private static pluginCleanup = new WeakMap<GameEngine, () => void>();
    static boot(): void {
        // Installed before anything else so failures during boot are reported too.
        installGlobalErrorReporter();
        const initialize = () => { void this.initialize(); };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize, { once: true });
        } else {
            initialize();
        }
    }

    static async initialize(): Promise<void> {
        const canvas = document.getElementById('game-canvas');
        if (!(canvas instanceof HTMLCanvasElement)) {
            console.error('[TinyRPG] Export canvas is missing.');
            return;
        }

        const gameEngine = new GameEngine(canvas);
        try {
            await this.loadSharedGame(gameEngine);
        } catch (error) {
            gameEngine.destroy();
            console.error('[TinyRPG] Unable to load bundled gameplay project.', error);
            return;
        }
        const controller = new AbortController();
        const signal = controller.signal;
        const runtime = createBaseRuntimeApi(gameEngine, () => {
            controller.abort();
            this.pluginCleanup.get(gameEngine)?.();
            if (this.runtime === runtime) this.runtime = null;
            if ((globalThis as Record<string, unknown>).__TINY_RPG_API === runtime) delete (globalThis as Record<string, unknown>).__TINY_RPG_API;
        });
        this.runtime = runtime;
        (globalThis as Record<string, unknown>).__TINY_RPG_API = runtime;
        const onlineOptions = (globalThis as Record<string, unknown>).__TINY_RPG_ONLINE_OPTIONS as OnlineSessionOptions | undefined;
        try {
            if (onlineOptions && gameEngine.gameState.game.online?.enabled) runtime.connectOnline(onlineOptions);
        } catch (error) { runtime.destroy(); throw error; }
        globalThis.addEventListener('pagehide', () => {
            runtime.destroy();
            if (this.runtime === runtime) this.runtime = null;
            if ((globalThis as Record<string, unknown>).__TINY_RPG_API === runtime) delete (globalThis as Record<string, unknown>).__TINY_RPG_API;
        }, { once: true, signal });
        this.bindReset(gameEngine, signal);
        this.bindFullscreen(signal);
        this.bindVolume(gameEngine, signal);
        this.setupWelcomeAudio(signal);
        this.setupResponsiveCanvas(signal);

        const finishBoot = () => document.dispatchEvent(new CustomEvent('boot-finished'));
        if ('fonts' in document) {
            void document.fonts.ready.then(finishBoot, finishBoot);
        } else {
            finishBoot();
        }
    }

    static async loadSharedGame(gameEngine: GameEngine): Promise<void> {
        const bundled = (globalThis as Record<string, unknown>).__TINY_RPG_BUNDLED_PROJECT as { game?: unknown; plugins?: InstalledPlugin[] } | undefined;
        if (bundled) {
            const packages = Array.isArray(bundled.plugins) ? bundled.plugins : [];
            const host = new GameplayPluginHost(gameEngine, () => packages);
            try { await host.load(bundled.game); }
            catch (error) { host.destroy(); throw error; }
            const cleanup = () => {
                globalThis.removeEventListener('pagehide', cleanup);
                this.pluginCleanup.delete(gameEngine);
                host.destroy();
            };
            this.pluginCleanup.set(gameEngine, cleanup);
            globalThis.addEventListener('pagehide', cleanup, { once: true });
            return;
        }
        const fromLocation = ShareUtils.extractGameDataFromLocation(globalThis.location);
        if (fromLocation) {
            gameEngine.importGameData(fromLocation);
            return;
        }

        const sharedCode = (globalThis as Record<string, unknown>).__TINY_RPG_SHARED_CODE;
        if (typeof sharedCode !== 'string' || !sharedCode.trim()) return;
        try {
            const decoded = ShareUtils.decode(sharedCode);
            if (decoded) gameEngine.importGameData(decoded);
        } catch (error) {
            console.error('[TinyRPG] Unable to decode exported game data.', error);
        }
    }

    static bindReset(gameEngine: GameEngine, signal?: AbortSignal): void {
        const button = document.getElementById('btn-export-reset');
        if (!(button instanceof HTMLButtonElement)) return;
        button.addEventListener('click', () => {
            gameEngine.resetGame();
            button.blur();
        }, { signal });
    }

    static bindFullscreen(signal?: AbortSignal): void {
        const gameContainer = document.getElementById('game-container');
        if (!(gameContainer instanceof HTMLElement)) return;

        const desktopQuery = typeof globalThis.matchMedia === 'function'
            ? globalThis.matchMedia('(hover: hover) and (pointer: fine)')
            : null;
        const button = document.createElement('button');
        button.id = 'game-fullscreen-toggle';
        button.type = 'button';
        button.className = 'game-fullscreen-button';
        gameContainer.appendChild(button);
        signal?.addEventListener('abort', () => button.remove(), { once: true });

        const isActive = () => document.fullscreenElement === gameContainer;
        const sync = () => {
            const active = isActive();
            const label = active
                ? text('aria.fullscreenExit', 'Exit fullscreen')
                : text('aria.fullscreenEnter', 'Enter fullscreen');
            button.hidden = !(desktopQuery?.matches ?? false);
            button.setAttribute('aria-label', label);
            button.setAttribute('aria-pressed', String(active));
            button.title = label;
            button.dataset.state = active ? 'exit' : 'enter';
            button.classList.toggle('is-active', active);
        };

        button.addEventListener('click', () => {
            if (isActive()) {
                void document.exitFullscreen();
            } else {
                void gameContainer.requestFullscreen();
            }
        }, { signal });
        document.addEventListener('fullscreenchange', sync, { signal });
        document.addEventListener('language-changed', sync, { signal });
        desktopQuery?.addEventListener('change', sync, { signal });
        sync();
    }

    static bindVolume(gameEngine: GameEngine, signal?: AbortSignal): void {
        const gameContainer = document.getElementById('game-container');
        if (!(gameContainer instanceof HTMLElement)) return;

        const controls = document.createElement('div');
        controls.id = 'game-audio-controls';
        controls.className = 'game-audio-controls game-audio-controls--mobile-export';
        const label = document.createElement('label');
        label.className = 'game-audio-controls__label';
        label.htmlFor = 'game-background-music-volume';
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
        controls.append(label);
        gameContainer.append(controls);
        signal?.addEventListener('abort', () => controls.remove(), { once: true });

        const syncValue = (volume: number) => {
            const normalized = normalizeBackgroundMusicVolume(volume);
            slider.value = String(normalized);
            value.textContent = `${normalized}%`;
        };
        const updateVisibility = () => {
            const game = gameEngine.getGame() as { backgroundMusicVideoId?: string };
            controls.hidden = !game.backgroundMusicVideoId?.trim();
            if (!controls.hidden) syncValue(gameEngine.backgroundMusicEngine.getVolume());
        };
        slider.addEventListener('input', () => {
            const volume = normalizeBackgroundMusicVolume(Number(slider.value));
            gameEngine.backgroundMusicEngine.setVolume(volume);
            syncValue(volume);
        }, { signal });
        updateVisibility();
    }

    static setupWelcomeAudio(signal?: AbortSignal): void {
        let unlocked = false;
        const events = ['pointerdown', 'keydown', 'touchstart'] as const;
        const unlock = () => {
            if (unlocked) return;
            unlocked = true;
            soundEngine.unlock();
            events.forEach((event) => globalThis.removeEventListener(event, unlock));
        };
        events.forEach((event) => globalThis.addEventListener(event, unlock, { passive: true, signal }));
    }

    static setupResponsiveCanvas(signal?: AbortSignal): void {
        const canvas = document.getElementById('game-canvas');
        const container = document.getElementById('game-container');
        if (!(canvas instanceof HTMLCanvasElement) || !(container instanceof HTMLElement)) return;
        const screen = canvas.closest('.game-screen') ?? canvas.parentElement;

        const resize = () => {
            const containerStyle = getComputedStyle(container);
            const paddingX =
                (parseFloat(containerStyle.paddingLeft) || 0) +
                (parseFloat(containerStyle.paddingRight) || 0);
            const paddingY =
                (parseFloat(containerStyle.paddingTop) || 0) +
                (parseFloat(containerStyle.paddingBottom) || 0);
            const gap = parseFloat(containerStyle.rowGap || containerStyle.gap || '') || 0;
            let reservedHeight = 0;
            let flowChildren = 0;
            for (const child of Array.from(container.children)) {
                const childStyle = getComputedStyle(child);
                if (childStyle.position === 'absolute' || childStyle.position === 'fixed' ||
                    childStyle.display === 'none') continue;
                if (child !== screen && child.getClientRects().length === 0) continue;
                flowChildren += 1;
                const margins =
                    (parseFloat(childStyle.marginTop) || 0) +
                    (parseFloat(childStyle.marginBottom) || 0);
                reservedHeight += child === screen ? margins : (child as HTMLElement).offsetHeight + margins;
            }
            if (flowChildren > 1) reservedHeight += gap * (flowChildren - 1);

            const bounds = container.getBoundingClientRect();
            const availableWidth = Math.max(64, (bounds.width || innerWidth) - paddingX);
            const availableHeight =
                Math.max(64, (bounds.height || innerHeight) - paddingY - reservedHeight);
            const aspectRatio = (canvas.height || 1) / (canvas.width || 1);
            const width = Math.min(availableWidth, availableHeight / aspectRatio) * 0.98;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${width * aspectRatio}px`;
        };
        let frame: number | undefined;
        const schedule = () => { if (signal?.aborted) return; if (frame !== undefined) cancelAnimationFrame(frame); frame = requestAnimationFrame(resize); };
        let observer: ResizeObserver | undefined;
        signal?.addEventListener('abort', () => { if (frame !== undefined) cancelAnimationFrame(frame); observer?.disconnect(); }, { once: true });
        globalThis.addEventListener('resize', schedule, { signal });
        document.addEventListener('fullscreenchange', schedule, { signal });
        document.addEventListener('boot-finished', schedule, { signal });
        if ('fonts' in document) void document.fonts.ready.then(schedule, schedule);
        if (typeof ResizeObserver === 'function') { observer = new ResizeObserver(schedule); observer.observe(container); }
        schedule();
    }
}

ExportApplication.boot();

export { ExportApplication };
