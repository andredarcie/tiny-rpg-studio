/**
 * Boot loading screen controller.
 *
 * The overlay markup lives statically in `index.html` so it paints on the very
 * first frame — before the JS/CSS bundle is parsed — giving users an engine
 * styled black screen instead of the unstyled "ugly" load. This module animates
 * a friendly progress bar and only removes the overlay once the engine and its
 * core assets (the pixel UI font and the bitmap font sheet) are ready.
 */
import { bitmapFont } from './runtime/adapters/renderer/BitmapFont';

const OVERLAY_ID = 'boot-loading';
const FILL_ID = 'boot-loading-fill';

/** Keep the screen up at least this long so it reads as intentional, not a flash. */
const MIN_VISIBLE_MS = 600;
/** Hard cap so a slow/failed asset never hangs the boot behind a black screen. */
const MAX_WAIT_MS = 6000;
/** Progress (%) the bar trickles toward while still waiting for assets. */
const TRICKLE_TARGET = 90;

type SafetyWindow = typeof globalThis & { __bootLoadingSafety?: number };

const now = (): number =>
    typeof performance !== 'undefined' ? performance.now() : Date.now();

export class BootLoadingScreen {
    private static startedAt = 0;
    private static rafId = 0;
    private static displayed = 0;
    private static finishing = false;

    /** Begin the progress animation. No-op if the overlay isn't present. */
    static start(): void {
        if (typeof document === 'undefined') return;
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;
        this.startedAt = now();
        this.displayed = 0;
        this.finishing = false;
        this.loop();
    }

    /** Wait for the core assets to be ready, then ramp to 100% and fade out. */
    static async finishWhenReady(): Promise<void> {
        if (typeof document === 'undefined') return;
        if (!document.getElementById(OVERLAY_ID)) return;
        await this.waitForAssets();
        this.finish();
    }

    private static loop = (): void => {
        const target = this.finishing ? 100 : TRICKLE_TARGET;
        // Asymptotic ease — fast at first, slowing as it approaches the target.
        this.displayed += (target - this.displayed) * 0.06;
        const shown = this.finishing ? this.displayed : Math.min(this.displayed, TRICKLE_TARGET);
        this.setFill(shown);

        if (this.finishing && target - this.displayed < 0.4) {
            this.setFill(100);
            this.hide();
            return;
        }
        this.rafId = this.requestFrame(this.loop);
    };

    private static finish(): void {
        if (this.finishing) return;
        this.finishing = true;
        // If start() was never called there is no running loop — kick one off.
        if (!this.rafId) this.loop();
    }

    private static hide(): void {
        if (this.rafId) this.cancelFrame(this.rafId);
        this.rafId = 0;
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;

        // Success: defuse the inline safety timeout from index.html.
        const safety = (globalThis as SafetyWindow).__bootLoadingSafety;
        if (typeof safety === 'number') clearTimeout(safety);

        // Signal that the title screen is now showing (used to play the welcome
        // jingle when audio is already unlocked).
        document.dispatchEvent(new CustomEvent('boot-finished'));

        overlay.classList.add('is-hiding');
        const remove = () => overlay.remove();
        overlay.addEventListener('transitionend', remove, { once: true });
        // Fallback in case transitionend never fires (e.g. reduced motion).
        setTimeout(remove, 500);
    }

    private static setFill(pct: number): void {
        const fill = document.getElementById(FILL_ID);
        if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }

    private static async waitForAssets(): Promise<void> {
        const start = this.startedAt || now();
        const elapsed = () => now() - start;

        const fontsReady: Promise<void> =
            typeof document !== 'undefined' && 'fonts' in document
                ? document.fonts.ready.then(() => undefined).catch(() => undefined)
                : Promise.resolve();

        const bitmapReady = new Promise<void>((resolve) => {
            // load() is idempotent: resolves immediately if loaded, registers a
            // callback if mid-load, or starts the load otherwise.
            try {
                bitmapFont.load(() => resolve());
            } catch {
                resolve();
            }
            const poll = () => {
                if (bitmapFont.isReady() || elapsed() >= MAX_WAIT_MS) {
                    resolve();
                    return;
                }
                this.requestFrame(poll);
            };
            poll();
        });

        const minVisible = new Promise<void>((r) => setTimeout(r, MIN_VISIBLE_MS));
        const hardCap = new Promise<void>((r) => setTimeout(r, MAX_WAIT_MS));

        await Promise.race([
            Promise.all([fontsReady, bitmapReady, this.stylesReady(), minVisible]).then(
                () => undefined,
            ),
            hardCap,
        ]);
    }

    /**
     * Resolves once every stylesheet `<link>` has loaded. In production the
     * bundle CSS is loaded asynchronously (see vite.config.ts), so this guards
     * against revealing the engine before its styles are applied. In dev there
     * are no stylesheet links (CSS is JS-injected) and it resolves immediately.
     */
    private static stylesReady(): Promise<void> {
        return new Promise<void>((resolve) => {
            const links = Array.from(
                document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
            );
            let pending = links.length;
            if (pending === 0) {
                resolve();
                return;
            }
            const done = () => {
                pending -= 1;
                if (pending <= 0) resolve();
            };
            for (const link of links) {
                if (link.sheet) {
                    done();
                    continue;
                }
                link.addEventListener('load', done, { once: true });
                link.addEventListener('error', done, { once: true });
            }
        });
    }

    private static requestFrame(cb: () => void): number {
        if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
        return setTimeout(cb, 16) as unknown as number;
    }

    private static cancelFrame(id: number): void {
        if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(id);
            return;
        }
        clearTimeout(id);
    }
}
