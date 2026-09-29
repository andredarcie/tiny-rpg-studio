
import { FirebaseShareTracker } from '../../runtime/infra/share/FirebaseShareTracker';
import { ensureFirebase } from '../../runtime/infra/share/FirebaseLoader';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';
import { TextResources } from '../../runtime/adapters/TextResources';
import { EditorConfig } from '../../config/EditorConfig';
import { track } from '../../analytics/track';
import type { EditorManager } from '../EditorManager';
import type { PluginManager } from '../manager/PluginManager';

class EditorShareService {
    manager: EditorManager;
    shareTracker: FirebaseShareTracker | null;

    constructor(editorManager: EditorManager, pluginManager?: PluginManager) {
        this.manager = editorManager;
        this.shareTracker = this.createShareTracker();
        this.attachPluginManager(pluginManager);
    }

    attachPluginManager(pluginManager?: PluginManager): void {
        const update = () => {
            const disabled = Boolean(pluginManager?.installed.some(plugin => plugin.capabilities?.includes('gameplay')));
            const button = document.getElementById('btn-generate-url') as HTMLButtonElement | null;
            const wrapper = document.getElementById('generate-url-wrapper');
            const help = document.getElementById('generate-url-help');
            if (button) button.disabled = disabled;
            if (wrapper) {
                const message = disabled ? this.t('project.shareUnavailableGameplay', 'Share URLs are unavailable while gameplay plugins are installed. Export HTML instead.') : '';
                wrapper.title = message;
                wrapper.dataset.disabled = String(disabled);
                wrapper.setAttribute('aria-label', message || button?.textContent || 'Generate URL');
                if (disabled) wrapper.setAttribute('aria-describedby', 'generate-url-help');
                else wrapper.removeAttribute('aria-describedby');
                if (help) help.textContent = message;
            }
            if (disabled) {
                this.updateShareUrlField('');
                try {
                    if (globalThis.location.hash) globalThis.history.replaceState(null, '', globalThis.location.pathname + globalThis.location.search);
                } catch { /* Embedded pages may restrict history. */ }
            }
        };
        pluginManager?.subscribe(update);
        update();
    }

    get text() {
        return TextResources;
    }

    t(key: string, fallback = ''): string {
        const resource = this.text as typeof TextResources & { get: (key: string, fallback: string) => string };
        const value = resource.get(key, fallback);
        if (value) return value;
        if (fallback) return fallback;
        return key || '';
    }

    buildShareUrl() {
        if (this.manager.pluginManager?.installed.some(plugin => plugin.capabilities?.includes('gameplay'))) {
            this.clearShareLink();
            return '';
        }
        const gameData = this.manager.gameEngine.exportGameData();
        const url = ShareUtils.buildShareUrl(gameData as Record<string, unknown> | null | undefined);
        if (!url) { this.clearShareLink(); return ''; }
        try {
            globalThis.history.replaceState(null, '', url);
        } catch {
            /* ignore */
        }
        return url;
    }

    private clearShareLink(): void {
        this.updateShareUrlField('');
        try {
            if (globalThis.location.hash) globalThis.history.replaceState(null, '', globalThis.location.pathname + globalThis.location.search);
        } catch { /* Embedded pages may restrict history. */ }
    }

    updateShareUrlField(url: string | null) {
        const input = this.manager.dom.shareUrlInput;
        if (!input) return;
        input.value = url || '';
    }

    async generateShareableUrl() {
        let url: string;
        try {
            url = await this.buildShareUrl();
        } catch (error) {
            // A genuine encoding failure — distinct from the clipboard being
            // blocked (handled below), which must NOT look like a failure.
            console.error(error);
            alert(this.t('alerts.share.generateError'));
            return;
        }
        if (!url) return;

        // Put the URL in the field FIRST so the user can always copy it
        // manually, even when programmatic clipboard access is blocked.
        this.updateShareUrlField(url);
        track('share_url_generated');

        // Warn (without blocking) when the game outgrew what a URL can carry.
        // The data lives in the URL fragment, so the binding limit is the
        // browser address bar (~32k in Chrome) — above it the user should
        // Export (HTML) instead, which has no URL-length limit.
        if (url.length > EditorConfig.share.maxUrlLength) {
            alert(this.t('alerts.share.tooLong'));
        }

        await this.copyShareUrlOrSelectField(url);

        // Firebase is loaded lazily here (off the boot path); the tracker
        // re-initializes from the globals once they are populated.
        void ensureFirebase().then(() => this.trackShareUrl(url));
    }

    /**
     * Best-effort clipboard copy. Sandboxed iframes (e.g. the itch.io player)
     * reject clipboard writes; when that happens we do NOT surface an error —
     * the URL is already in the share field, so we just select it so the user
     * can copy it with Ctrl+C.
     */
    async copyShareUrlOrSelectField(url: string): Promise<void> {
        type NavigatorWithOptionalClipboard = Navigator & Partial<{ clipboard: Clipboard }>;
        const navigatorApi =
            typeof navigator !== 'undefined'
                ? (navigator as NavigatorWithOptionalClipboard)
                : null;
        const clipboard = navigatorApi?.clipboard;
        if (clipboard) {
            try {
                await clipboard.writeText(url);
                return;
            } catch {
                // Clipboard blocked (common inside the itch.io sandbox) — fall
                // through and let the user copy from the field instead.
            }
        }
        this.selectShareUrlField(url);
    }

    /** Focus + select the share field so the user can copy the URL with Ctrl+C. */
    selectShareUrlField(url: string): void {
        const input = this.manager.dom.shareUrlInput;
        if (input) {
            input.focus();
            input.select();
            return;
        }
        // No field available to display the URL — last-resort copyable dialog.
        prompt(this.t('alerts.share.copyPrompt'), url);
    }

    createShareTracker(): FirebaseShareTracker | null {
        const config = (globalThis as Record<string, unknown>).TinyRPGFirebaseConfig ?? null;
        const collection = (globalThis as Record<string, unknown>).TinyRPGFirebaseCollection ?? null;
        if (!config) return null;
        return new FirebaseShareTracker(config as Record<string, unknown>, { collection: collection as string | null });
    }

    async trackShareUrl(url: string) {
        if (!this.shareTracker) return;
        console.info('[TinyRPG] Tracking share URL...', { url });
        const ok = await this.shareTracker.trackShareUrl(url, { source: 'editor' });
        console.info('[TinyRPG] Share URL tracking result:', ok ? 'ok' : 'failed');
    }

    saveGame() {
        track('game_saved_json');
        const blob = new Blob(
            [JSON.stringify(this.manager.gameEngine.exportGameData(), null, 2)],
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'tiny-rpg-maker.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    loadGameFile(ev: Event) {
        const target = ev.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const data: Record<string, unknown> = JSON.parse(reader.result as string) as Record<string, unknown>;
                if (typeof Reflect.get(this.manager, 'loadProjectData') === 'function') await this.manager.loadProjectData(data, { skipHistory: true });
                else this.manager.restore(data, { skipHistory: true });
                this.manager.history.pushCurrentState();
                track('game_loaded_json');
            } catch (error) {
                alert(error instanceof SyntaxError ? this.t('alerts.share.loadError') : error instanceof Error ? error.message : this.t('alerts.share.loadError'));
            }
        };
        reader.readAsText(file);
        target.value = '';
    }
}

export { EditorShareService };
