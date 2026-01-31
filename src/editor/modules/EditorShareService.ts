
import { FirebaseShareTracker } from '../../runtime/infra/share/FirebaseShareTracker';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';
import { TextResources } from '../../runtime/adapters/TextResources';
import type { EditorManager } from '../EditorManager';

class EditorShareService {
    manager: EditorManager;
    shareTracker: FirebaseShareTracker | null;

    constructor(editorManager: EditorManager) {
        this.manager = editorManager;
        this.shareTracker = this.createShareTracker();
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
        const gameData = this.manager.gameEngine.exportGameData();
        const url = ShareUtils.buildShareUrl(gameData as Record<string, unknown> | null | undefined);
        try {
            globalThis.history.replaceState(null, '', url);
        } catch {
            /* ignore */
        }
        return url;
    }

    updateShareUrlField(url: string | null) {
        const input = this.manager.dom.shareUrlInput;
        if (!input) return;
        input.value = url || '';
    }

    async generateShareableUrl() {
        try {
            const url = await this.buildShareUrl();
            if (!url) return;
            this.updateShareUrlField(url);

            type NavigatorWithOptionalClipboard = Navigator & Partial<{ clipboard: Clipboard }>;
            const navigatorApi =
                typeof navigator !== 'undefined'
                    ? (navigator as NavigatorWithOptionalClipboard)
                    : null;
            const clipboard = navigatorApi?.clipboard;
            if (clipboard) {
                await clipboard.writeText(url);
                alert(this.t('alerts.share.copied'));
            } else {
                prompt(this.t('alerts.share.copyPrompt'), url);
            }

            void this.trackShareUrl(url);
        } catch (error) {
            console.error(error);
            alert(this.t('alerts.share.generateError'));
        }
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
        reader.onload = () => {
            try {
                const data: Record<string, unknown> = JSON.parse(reader.result as string) as Record<string, unknown>;
                this.manager.restore(data, { skipHistory: true });
                this.manager.history.pushCurrentState();
            } catch {
                alert(this.t('alerts.share.loadError'));
            }
        };
        reader.readAsText(file);
        target.value = '';
    }
}

export { EditorShareService };
