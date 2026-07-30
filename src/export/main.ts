import './styles.css';
import { normalizeBackgroundMusicVolume } from '../runtime/infra/share/BackgroundMusicVideoId';
import { ShareUtils } from '../runtime/infra/share/ShareUtils';
import { TextResources } from '../runtime/adapters/TextResources';
import { GameEngine } from '../runtime/services/GameEngine';
import { soundEngine } from '../runtime/services/SoundEngine';

const text = (key: string, fallback: string): string =>
    String(TextResources.get(key, fallback) || fallback);

class ExportApplication {
    static boot(): void {
        const initialize = () => this.initialize();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize, { once: true });
        } else {
            initialize();
        }
    }

    static initialize(): void {
        const canvas = document.getElementById('game-canvas');
        if (!(canvas instanceof HTMLCanvasElement)) {
            console.error('[TinyRPG] Export canvas is missing.');
            return;
        }

        const gameEngine = new GameEngine(canvas);
        this.loadSharedGame(gameEngine);
        this.bindReset(gameEngine);
        this.bindFullscreen();
        this.bindVolume(gameEngine);
        this.setupWelcomeAudio();
        this.setupResponsiveCanvas();

        const finishBoot = () => document.dispatchEvent(new CustomEvent('boot-finished'));
        if ('fonts' in document) {
            void document.fonts.ready.then(finishBoot, finishBoot);
        } else {
            finishBoot();
        }
    }

    static loadSharedGame(gameEngine: GameEngine): void {
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

    static bindReset(gameEngine: GameEngine): void {
        const button = document.getElementById('btn-export-reset');
        if (!(button instanceof HTMLButtonElement)) return;
        button.addEventListener('click', () => {
            gameEngine.resetGame();
            button.blur();
        });
    }

    static bindFullscreen(): void {
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
        });
        document.addEventListener('fullscreenchange', sync);
        document.addEventListener('language-changed', sync);
        desktopQuery?.addEventListener('change', sync);
        sync();
    }

    static bindVolume(gameEngine: GameEngine): void {
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
        });
        updateVisibility();
    }

    static setupWelcomeAudio(): void {
        let played = false;
        const events = ['pointerdown', 'keydown', 'touchstart'] as const;
        const play = () => {
            if (played) return;
            played = true;
            soundEngine.unlock();
            soundEngine.play('gameStart');
            events.forEach((event) => globalThis.removeEventListener(event, play));
        };
        events.forEach((event) => globalThis.addEventListener(event, play, { passive: true }));
    }

    static setupResponsiveCanvas(): void {
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
        const schedule = () => requestAnimationFrame(resize);
        globalThis.addEventListener('resize', schedule);
        document.addEventListener('fullscreenchange', schedule);
        document.addEventListener('boot-finished', schedule);
        if ('fonts' in document) void document.fonts.ready.then(schedule, schedule);
        if (typeof ResizeObserver === 'function') new ResizeObserver(schedule).observe(container);
        schedule();
    }
}

ExportApplication.boot();

export { ExportApplication };
