import { track } from '../../analytics/track';
import { FONT_CSS_SRC } from '../../config/FontConfig';
import { TextResources } from '../../runtime/adapters/TextResources';
import { getTinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';
import {
    assembleExportHtml,
    createExportGameMarkup,
    type ExportHtmlSections,
} from './export/ExportHtmlAssembler';

type GameExportData = {
    title?: string;
};

const EXPORT_BUNDLE_SRC = 'export.bundle.js';
const EXPORT_CSS_SRC = 'tiny-rpg-studio-sdk.css';

class EditorExportService {
    btn: HTMLElement | null;
    importBtn: HTMLElement | null;
    importFileInput: HTMLInputElement | null;
    lastExportSections: ExportHtmlSections | null = null;

    constructor() {
        this.btn = typeof document !== 'undefined' ? document.getElementById('btn-generate-html') : null;
        if (this.btn) {
            this.btn.addEventListener('click', () => {
                setTimeout(() => this.exportProjectAsHtml(), 0);
            });
        }

        this.importBtn = typeof document !== 'undefined' ? document.getElementById('btn-import-html') : null;
        this.importFileInput = null;
        if (this.importBtn) {
            this.importFileInput = document.createElement('input');
            this.importFileInput.type = 'file';
            this.importFileInput.accept = '.html';
            this.importFileInput.style.display = 'none';
            document.body.appendChild(this.importFileInput);

            this.importBtn.addEventListener('click', () => this.importFileInput?.click());
            this.importFileInput.addEventListener('change', () => {
                const file = this.importFileInput?.files?.[0];
                if (file) void this.importFromHtml(file);
                if (this.importFileInput) this.importFileInput.value = '';
            });
        }
    }

    async importFromHtml(file: File): Promise<void> {
        try {
            const html = await file.text();
            const match = html.match(/__TINY_RPG_SHARED_CODE\s*=\s*([^;]+);/);
            if (!match) {
                alert(TextResources.get(
                    'alerts.importHTML.notFound',
                    'Invalid HTML file: no game data found.',
                ));
                return;
            }

            let code: string;
            try {
                code = JSON.parse(match[1].trim()) as string;
            } catch {
                alert(TextResources.get(
                    'alerts.importHTML.notFound',
                    'Invalid HTML file: no game data found.',
                ));
                return;
            }
            const gameData = ShareUtils.decode(code);
            if (!gameData) {
                alert(TextResources.get(
                    'alerts.importHTML.decodeError',
                    'Unable to decode the game data.',
                ));
                return;
            }
            const api = getTinyRpgApi();
            if (!api) {
                alert(TextResources.get(
                    'alerts.importHTML.apiUnavailable',
                    'Unable to import: engine API is not available.',
                ));
                return;
            }

            api.importGameData(gameData);
            api.draw();
            api.renderAll();

            const shareUrl = ShareUtils.buildShareUrl(gameData);
            if (!shareUrl) return;
            try {
                const hashStart = shareUrl.indexOf('#');
                if (hashStart !== -1) location.hash = shareUrl.slice(hashStart + 1);
            } catch {
                // Location is unavailable in some test/embedded environments.
            }
            const urlInput = document.getElementById('project-share-url') as HTMLInputElement | null;
            if (urlInput) urlInput.value = shareUrl;
        } catch (error) {
            console.error('Import failed', error);
            alert(TextResources.get(
                'alerts.importHTML.decodeError',
                'Unable to decode the game data.',
            ));
        }
    }

    private async fetchTextAsset(src: string, errorMessage: string): Promise<string> {
        let response: Response;
        try {
            response = await fetch(src as RequestInfo);
        } catch {
            throw new Error(errorMessage);
        }
        if (!response.ok || typeof response.text !== 'function') throw new Error(errorMessage);
        const text = await response.text();
        const normalized = text.trimStart().toLowerCase();
        if (normalized.startsWith('<!doctype html') || normalized.startsWith('<html')) {
            throw new Error(errorMessage);
        }
        return text;
    }

    private async fetchAssetAsDataUrl(src: string, downloadError: string): Promise<string> {
        let response: Response;
        try {
            response = await fetch(src as RequestInfo);
        } catch {
            throw new Error(downloadError);
        }
        if (!response.ok) throw new Error(downloadError);

        if (typeof response.blob === 'function') {
            const blob = await response.blob();
            return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error(downloadError));
                reader.readAsDataURL(blob);
            });
        }
        if (typeof response.text === 'function') {
            const value = await response.text();
            if (value.startsWith('data:')) return value;
            return `data:font/woff;base64,${btoa(value)}`;
        }
        throw new Error(downloadError);
    }

    async exportProjectAsHtml(): Promise<void> {
        try {
            track('export_html_started');
            const api = getTinyRpgApi();
            if (!api) {
                alert(TextResources.get(
                    'alerts.exportHTML.apiUnavailable',
                    'Unable to export: engine API is not available.',
                ));
                return;
            }
            const gameData = api.exportGameData();
            if (!gameData) {
                alert(TextResources.get(
                    'alerts.exportHTML.noData',
                    'Unable to read current project data.',
                ));
                return;
            }

            // Background music is a YouTube embed, so it is the one part of an
            // exported game that still needs the network. Say so before the file is
            // written rather than letting the author discover it offline.
            const musicVideoId = (gameData as { backgroundMusicVideoId?: string }).backgroundMusicVideoId;
            if (typeof musicVideoId === 'string' && musicVideoId.trim()) {
                const proceed = confirm(TextResources.get(
                    'alerts.exportHTML.musicNeedsNetwork',
                    'This game uses background music, which streams from YouTube. The exported file plays offline, but the music will not. Continue?',
                ));
                if (!proceed) return;
            }

            const downloadError = TextResources.get(
                'alerts.exportHTML.downloadError',
                'Unable to download project assets. Please run Tiny RPG Studio from an HTTP/HTTPS server (not file://) to export HTML.',
            );
            const invalidScriptError = TextResources.get(
                'alerts.exportHTML.invalidScript',
                'Export failed: the runtime bundle is missing or stale. Run "npm run build:export" and try again.',
            );
            const cacheBust = Date.now().toString(36);
            const [runtimeJavaScript, css, fontDataUrl] = await Promise.all([
                this.fetchTextAsset(`${EXPORT_BUNDLE_SRC}?v=${cacheBust}`, invalidScriptError),
                this.fetchTextAsset(`${EXPORT_CSS_SRC}?v=${cacheBust}`, downloadError),
                this.fetchAssetAsDataUrl(FONT_CSS_SRC, downloadError),
            ]);

            const code = ShareUtils.encode(gameData as Record<string, unknown>);
            const exportData = gameData as GameExportData;
            const title = typeof exportData.title === 'string' && exportData.title.trim()
                ? exportData.title.trim()
                : 'Tiny RPG';
            const locale = String(TextResources.getLocale() || 'en-US');
            const editableInStudio =
                (document.getElementById('export-editable-in-studio') as HTMLInputElement | null)
                    ?.checked ?? true;
            const result = assembleExportHtml({
                css,
                editableInStudio,
                fontDataUrl,
                gameCode: code,
                gameMarkup: createExportGameMarkup({
                    down: TextResources.get('touchControls.downLabel', 'Move down'),
                    left: TextResources.get('touchControls.leftLabel', 'Move left'),
                    reset: TextResources.get('export.resetAria', 'Restart the game'),
                    right: TextResources.get('touchControls.rightLabel', 'Move right'),
                    up: TextResources.get('touchControls.upLabel', 'Move up'),
                }),
                locale,
                openStudioLabel: TextResources.get('export.openStudio', 'Open Studio'),
                runtimeJavaScript,
                title,
            });
            this.lastExportSections = result.sections;

            const safeTitle = title
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase();
            const filename = `${safeTitle || 'tiny-rpg'}-v${ShareConstants.VERSION}.html`;
            const blob = new Blob([result.html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            track('export_html_completed', {
                bytes: result.sections.total,
                javascript_bytes: result.sections.javascript,
                css_bytes: result.sections.css,
            });
        } catch (error) {
            console.error('Export failed', error);
            alert(error instanceof Error
                ? error.message
                : TextResources.get('alerts.exportHTML.failed', 'Export failed. See console for details.'));
        }
    }
}

export { EditorExportService };
