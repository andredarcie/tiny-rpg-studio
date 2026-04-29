import { getTinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';
import { TextResources } from '../../runtime/adapters/TextResources';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';
import { FONT_BITMAP_SRC, FONT_CSS_SRC } from '../../config/FontConfig';

type GameExportData = {
    title?: string;
};

class EditorExportService {
    btn: HTMLElement | null;
    importBtn: HTMLElement | null;
    importFileInput: HTMLInputElement | null;

    constructor() {
        this.btn = typeof document !== 'undefined' ? document.getElementById('btn-generate-html') : null;
        if (this.btn) {
            this.btn.addEventListener('click', (_ev) => {
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

            this.importBtn.addEventListener('click', () => {
                this.importFileInput?.click();
            });
            this.importFileInput.addEventListener('change', () => {
                const file = this.importFileInput?.files?.[0];
                if (file) {
                    void this.importFromHtml(file);
                }
                if (this.importFileInput) {
                    this.importFileInput.value = '';
                }
            });
        }
    }

    async importFromHtml(file: File): Promise<void> {
        try {
            const html = await file.text();
            const match = html.match(/__TINY_RPG_SHARED_CODE\s*=\s*([^;]+);/);
            if (!match) {
                alert(TextResources.get('alerts.importHTML.notFound', 'Arquivo HTML inválido: nenhum dado de jogo encontrado.') as string);
                return;
            }
            let code: string;
            try {
                code = JSON.parse(match[1].trim()) as string;
            } catch {
                alert(TextResources.get('alerts.importHTML.notFound', 'Arquivo HTML inválido: nenhum dado de jogo encontrado.') as string);
                return;
            }
            const gameData = ShareUtils.decode(code);
            if (!gameData) {
                alert(TextResources.get('alerts.importHTML.decodeError', 'Não foi possível decodificar os dados do jogo.') as string);
                return;
            }
            const api = getTinyRpgApi();
            if (!api) {
                alert('Unable to import: engine API is not available.');
                return;
            }
            api.importGameData(gameData);
            api.draw();
            api.renderAll();

            const shareUrl = ShareUtils.buildShareUrl(gameData);
            if (shareUrl) {
                try {
                    const hashStart = shareUrl.indexOf('#');
                    if (hashStart !== -1) {
                        location.hash = shareUrl.slice(hashStart + 1);
                    }
                } catch { /* skip in environments without location */ }
                const urlInput = document.getElementById('project-share-url') as HTMLInputElement | null;
                if (urlInput) {
                    urlInput.value = shareUrl;
                }
            }
        } catch (error) {
            console.error('Import failed', error);
            alert(TextResources.get('alerts.importHTML.decodeError', 'Não foi possível decodificar os dados do jogo.') as string);
        }
    }

    private async fetchAssetAsDataUrl(src: string, downloadError: string): Promise<string> {
        let response: Response;
        try {
            response = await fetch(src as RequestInfo);
        } catch {
            throw new Error(downloadError);
        }

        if (!response.ok) {
            throw new Error(downloadError);
        }

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
            const text = await response.text();
            if (text.startsWith('data:')) {
                return text;
            }

            const mimeType = src.endsWith('.woff')
                ? 'font/woff'
                : src.endsWith('.png')
                    ? 'image/png'
                    : 'application/octet-stream';
            const encoded = btoa(text);
            return `data:${mimeType};base64,${encoded}`;
        }

        throw new Error(downloadError);
    }

    async exportProjectAsHtml() {
        try {
            const api = getTinyRpgApi();
            if (!api) {
                alert('Unable to export: engine API is not available.');
                return;
            }
            const gameData = api.exportGameData();

            if (!gameData) {
                alert('Unable to read current project data.');
                return;
            }

            const code = ShareUtils.encode(gameData as Record<string, unknown>);
            const downloadError = 'Unable to download project assets. Please run Tiny RPG Studio from an HTTP/HTTPS server (not file://) to export HTML.';

            let cssText = '';
            const looksLikeHtmlDocument = (text: string): boolean => {
                const trimmed = String(text || '').trimStart().toLowerCase();
                return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
            };
            const invalidScriptResponseMessage = 'Export failed: expected a JavaScript asset but received HTML. Rebuild the export bundle with "npm run build:export" and try again.';
            // Collect CSS from all active non-external stylesheets.
            // Using document.styleSheets handles both prod mode (<link rel="stylesheet"> injected
            // by Vite build) and dev mode (<style> tags injected by Vite HMR).
            const isCrossOriginStylesheet = (href: string): boolean => {
                try {
                    const stylesheetUrl = new URL(href, window.location.href);
                    return stylesheetUrl.origin !== window.location.origin;
                } catch {
                    // If URL parsing fails, treat as local and let fetch/catch handle it.
                    return false;
                }
            };
            for (const sheet of Array.from(document.styleSheets)) {
                // Skip only cross-origin stylesheets (Google Fonts, CDN, etc.).
                // Same-origin http(s) stylesheets contain the app CSS and must be embedded in exports.
                if (sheet.href && isCrossOriginStylesheet(sheet.href)) {
                    continue;
                }
                if (sheet.href) {
                    // Local <link rel="stylesheet"> — fetch the raw file content
                    try {
                        const resp = await fetch(sheet.href as RequestInfo);
                        if (resp.ok) {
                            cssText += await resp.text() + '\n';
                        } else {
                            alert(downloadError);
                            return;
                        }
                    } catch {
                        alert(downloadError);
                        return;
                    }
                } else {
                    // Inline <style> tag (Vite dev mode injects CSS as style elements)
                    try {
                        cssText += Array.from(sheet.cssRules).map((r) => r.cssText).join('\n') + '\n';
                    } catch {
                        // Skip inaccessible stylesheets (cross-origin security restrictions)
                    }
                }
            }

            const scripts: Record<string, string> = {};
            const skippedScripts: string[] = [];
            let bundleSource = '';
            const cacheBust = Date.now().toString(36);
            const bundleSrc = 'export.bundle.js';
            try {
                const bundleResp = await fetch(`${bundleSrc}?v=${cacheBust}`);
                if (bundleResp.ok) {
                    const bundleText = await bundleResp.text();
                    if (looksLikeHtmlDocument(bundleText)) {
                        console.warn('[TinyRPG Export] export.bundle.js returned HTML instead of JS. The bundle is likely missing or stale.');
                    } else {
                        bundleSource = bundleText;
                        scripts[bundleSrc] = bundleSource;
                    }
                }
            } catch {
                // fallback handled below
            }
            const locale = (TextResources.getLocale() as string) || 'en-US';
            const legacyIndexPath = 'legacy/index.html';
            const fallbackScriptSrcs = [
                'js/runtime/adapters/TextResources.js',
                'js/runtime/domain/definitions/SkillDefinitions.js',
                'js/runtime/domain/state/StateWorldManager.js',
                'js/runtime/domain/state/StateSkillManager.js',
                'js/runtime/domain/state/StatePlayerManager.js',
                'js/runtime/domain/state/StateDialogManager.js',
                'js/runtime/domain/state/StateVariableManager.js',
                'js/runtime/domain/state/StateEnemyManager.js',
                'js/runtime/domain/state/StateObjectManager.js',
                'js/runtime/domain/state/StateItemManager.js',
                'js/runtime/domain/state/GameStateLifecycle.js',
                'js/runtime/domain/state/GameStateScreenManager.js',
                'js/runtime/domain/state/GameStateWorldFacade.js',
                'js/runtime/domain/state/GameStateDataFacade.js',
                'js/runtime/domain/state/StateDataManager.js',
                'js/runtime/domain/GameState.js',
                'js/runtime/domain/sprites/PlayerSprites.js',
                'js/runtime/domain/sprites/NpcSprites.js',
                'js/runtime/domain/sprites/EnemySprites.js',
                'js/runtime/domain/sprites/ObjectSprites.js',
                'js/runtime/domain/sprites/SpriteMatrixRegistry.js',
                'js/runtime/adapters/renderer/RendererConstants.js',
                'js/runtime/adapters/renderer/RendererPalette.js',
                'js/runtime/adapters/renderer/RendererSpriteFactory.js',
                'js/runtime/adapters/renderer/RendererCanvasHelper.js',
                'js/runtime/adapters/renderer/RendererTileRenderer.js',
                'js/runtime/adapters/renderer/RendererEntityRenderer.js',
                'js/runtime/adapters/renderer/RendererDialogRenderer.js',
                'js/runtime/adapters/renderer/RendererHudRenderer.js',
                'js/runtime/adapters/renderer/RendererMinimapRenderer.js',
                'js/runtime/adapters/renderer/RendererModuleBase.js',
                'js/runtime/adapters/renderer/RendererEffectsManager.js',
                'js/runtime/adapters/renderer/RendererTransitionManager.js',
                'js/runtime/adapters/renderer/RendererOverlayRenderer.js',
                'js/runtime/infra/share/ShareConstants.js',
                'js/runtime/infra/share/ShareMath.js',
                'js/runtime/infra/share/ShareBase64.js',
                'js/runtime/infra/share/ShareTextCodec.js',
                'js/runtime/infra/share/ShareVariableCodec.js',
                'js/runtime/infra/share/ShareMatrixCodec.js',
                'js/runtime/infra/share/SharePositionCodec.js',
                'js/runtime/infra/share/ShareDataNormalizer.js',
                'js/runtime/infra/share/ShareSpriteCatalog.js',
                'js/runtime/infra/share/ShareEncoder.js',
                'js/runtime/infra/share/ShareDecoder.js',
                'js/runtime/infra/share/ShareUrlHelper.js',
                'js/runtime/domain/definitions/TileDefinitions.js',
                'js/runtime/domain/definitions/NPCDefinitions.js',
                'js/runtime/domain/definitions/EnemyDefinitions.js',
                'js/runtime/domain/definitions/ItemDefinitions.js',
                'js/editor/modules/EditorConstants.js',
                'js/editor/modules/EditorDomCache.js',
                'js/editor/modules/EditorState.js',
                'js/editor/modules/EditorHistoryManager.js',
                'js/editor/modules/EditorShareService.js',
                'js/editor/manager/EditorManagerModule.js',
                'js/editor/manager/EditorEventBinder.js',
                'js/editor/manager/EditorUIController.js',
                'js/editor/manager/EditorInteractionController.js',
                'js/editor/modules/renderers/EditorRendererBase.js',
                'js/editor/modules/renderers/EditorCanvasRenderer.js',
                'js/editor/modules/renderers/EditorTilePanelRenderer.js',
                'js/editor/modules/renderers/EditorNpcRenderer.js',
                'js/editor/modules/renderers/EditorEnemyRenderer.js',
                'js/editor/modules/renderers/EditorObjectRenderer.js',
                'js/editor/modules/renderers/EditorWorldRenderer.js',
                'js/editor/modules/EditorRenderService.js',
                'js/editor/modules/EditorTileService.js',
                'js/editor/modules/EditorNpcService.js',
                'js/editor/modules/EditorEnemyService.js',
                'js/editor/modules/EditorObjectService.js',
                'js/editor/modules/EditorVariableService.js',
                'js/editor/modules/EditorWorldService.js',
                'js/editor/EditorManager.js',
                'js/runtime/infra/share/ShareUtils.js',
                'js/runtime/services/TileManager.js',
                'js/runtime/services/NPCManager.js',
                'js/runtime/adapters/InputManager.js',
                'js/runtime/adapters/Renderer.js',
                'js/runtime/services/engine/DialogManager.js',
                'js/runtime/services/engine/InteractionManager.js',
                'js/runtime/services/engine/EnemyManager.js',
                'js/runtime/services/engine/MovementManager.js',
                'js/runtime/services/GameEngine.js',
                'js/main.js',
                'js/editor/modules/EditorExportService.js',
                'js/runtime/domain/sprites/CustomSpriteLookup.js',
                'js/editor/modules/PixelArtEditorController.js'
            ];
            const legacyScriptSrcs: (string | null)[] = [];
            if (!bundleSource) try {
                const legacyResp = await fetch(legacyIndexPath);
                if (legacyResp.ok) {
                    const legacyHtml = await legacyResp.text();
                    const doc = new DOMParser().parseFromString(legacyHtml, 'text/html');
                    legacyScriptSrcs.push(
                        ...Array.from(doc.querySelectorAll('script[src]'))
                            .filter((script) => script.getAttribute('type') !== 'module')
                            .map((s) => s.getAttribute('src'))
                            .filter((src): src is string => {
                                if (!src) return false;
                                return (src.startsWith('js/') || src.startsWith('./js/')) &&
                                    !src.includes('/editor/');
                            })
                    );
                }
            } catch {
                // fallback handled below
            }

            const scriptSrcs = (legacyScriptSrcs.length && legacyScriptSrcs.some((src) => src && src.includes('js/main.js'))
                ? legacyScriptSrcs.filter((src): src is string => Boolean(src))
                : fallbackScriptSrcs);
            for (const src of scriptSrcs) {
                if (bundleSource) break;
                if (!src) continue;
                try {
                    const resp = await fetch(`${src}?v=${cacheBust}` as RequestInfo);
                    if (resp.ok) {
                        const text = await resp.text();
                        if (looksLikeHtmlDocument(text)) {
                            alert(invalidScriptResponseMessage);
                            return;
                        }
                        const hasModuleSyntax = /^(?:\s*import\s+[\w*{]|\s*export\s+)/m.test(text);
                        if (hasModuleSyntax) {
                            skippedScripts.push(src);
                        } else {
                            scripts[src] = text;
                        }
                    } else {
                        alert(downloadError);
                        return;
                    }
                } catch {
                    alert(downloadError);
                    return;
                }
            }

            const gameContainer = document.getElementById('game-container');
            if (!gameContainer) {
                alert('game-container not found');
                return;
            }
            const containerClone = gameContainer.cloneNode(true) as HTMLElement;

            // Clone reset button
            const resetButton = document.getElementById('btn-reset');
            const resetClone = resetButton ? (resetButton.cloneNode(true) as HTMLElement) : null;

            const allScripts = Object.values(scripts).join('');
            if (!allScripts.trim()) {
                alert(invalidScriptResponseMessage);
                return;
            }
            const fontWoffDataUrl = await this.fetchAssetAsDataUrl(FONT_CSS_SRC, downloadError);
            const fontBitmapDataUrl = await this.fetchAssetAsDataUrl(FONT_BITMAP_SRC, downloadError);
            const exportCssText = cssText
                .replaceAll(FONT_CSS_SRC, fontWoffDataUrl)
                .replaceAll(FONT_BITMAP_SRC, fontBitmapDataUrl);
            const exportScriptsText = allScripts
                .replaceAll(FONT_CSS_SRC, fontWoffDataUrl)
                .replaceAll(FONT_BITMAP_SRC, fontBitmapDataUrl);

            const html = `<!DOCTYPE html>
                <html lang="${locale}">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Tiny RPG</title>
                <style>${exportCssText}
                body{background-color:#000}
                #game-container{position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;background-color:#000;overflow:hidden}
                .game-controls{display:flex;justify-content:center;margin-top:1rem}
                canvas{image-rendering:pixelated;image-rendering:crisp-edges}
                .touch-controls-toggle{display:inline-flex !important;align-items:center;gap:6px}
                body.touch-controls-visible .touch-controls-toggle{display:none !important}
                </style>
                <script>
                console.log('[TinyRPG Export] Booting exported build');
                globalThis.__TINY_RPG_EXPORT_MODE = true;
                globalThis.__TINY_RPG_SHARED_CODE = ${JSON.stringify(code)};
                console.log('[TinyRPG Export] Share code ready', { length: (globalThis.__TINY_RPG_SHARED_CODE || '').length });
                if(!location.hash) try{ location.hash = '#' + globalThis.__TINY_RPG_SHARED_CODE; }catch{}
                </script>
                </head>
                <body class="game-mode">
                <button id="btn-open-studio" style="position:absolute;top:10px;right:10px;z-index:9999;">Open Studio</button>
                <script>
                document.getElementById('btn-open-studio')?.addEventListener('click', function(){
                    const url = 'https://andredarcie.github.io/tiny-rpg-studio/#' + (globalThis.__TINY_RPG_SHARED_CODE|| '');
                    window.open(url, '_blank');
                });
                </script>
                <div class="app">
                <main>
                <div class="tabs">
                    <div class="tabs-links">
                        ${resetClone ? resetClone.outerHTML : ''}
                    </div>
                </div>
                <div class="tab-content active" id="tab-game">
                ${containerClone.outerHTML}
                </div>
                </main>
                </div>
                <script>
            console.log('[TinyRPG Export] Loading scripts', { count: ${Object.keys(scripts).length}, requested: ${scriptSrcs.length}, skipped: ${JSON.stringify(skippedScripts)}, bundle: ${Boolean(bundleSource)} });
                ${exportScriptsText}
                console.log('[TinyRPG Export] Scripts executed');
                </script>
                </body>
            </html>`;

            const exportData = gameData as GameExportData;
            const rawTitle = typeof exportData.title === 'string' ? exportData.title : '';
            const safeTitle = rawTitle
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase();
            const versionValue = ShareConstants.VERSION;
            const filename = `${safeTitle || 'tiny-rpg'}-v${versionValue}.html`;
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed', error);
            alert('Export failed. See console for details.');
        }
    }
}

export { EditorExportService };
