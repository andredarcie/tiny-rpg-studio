import { GameEngine } from '../runtime/services/GameEngine';
import { createBaseRuntimeApi, type BaseRuntimeApi } from '../runtime/infra/BaseRuntimeApi';
import { createExportGameMarkup } from '../editor/modules/export/ExportHtmlAssembler';
import type { BaseProjectData } from './types';
import { validateBaseProject } from './validation';
import type { OnlineSessionOptions } from '../online/OnlineSession';

export type RuntimeOptions = {
    canvas?: HTMLCanvasElement;
    container?: HTMLElement;
    project?: BaseProjectData;
    online?: OnlineSessionOptions;
};

let modeOwners = 0;
let restoreGameMode = false;

export function createRuntime(options: RuntimeOptions): BaseRuntimeApi {
    if (options.project) validateBaseProject(options.project);
    if (!options.canvas && !options.container) throw Error('Supply a canvas or container');
    let owned: HTMLElement | undefined;
    let canvas = options.canvas;
    if (modeOwners === 0) restoreGameMode = !document.body.classList.contains('game-mode');
    modeOwners++;
    let root: HTMLElement | undefined;
    const focus = () => root?.focus();
    let engine: GameEngine | undefined;
    const cleanup = () => { root?.removeEventListener('pointerdown', focus); owned?.remove(); modeOwners--; if (modeOwners === 0 && restoreGameMode) document.body.classList.remove('game-mode'); };
    try {
        if (!canvas) {
            owned = document.createElement('div');
            owned.innerHTML = createExportGameMarkup({ reset: 'Restart' });
            options.container?.append(owned);
            canvas = owned.querySelector('canvas') ?? undefined;
        }
        if (!canvas) throw Error('Runtime canvas is missing');
        document.body.classList.add('game-mode');
        root = owned ?? canvas.parentElement ?? canvas;
        root.tabIndex = 0; root.addEventListener('pointerdown', focus);
        engine = new GameEngine(canvas, { inputRoot: root });
        if (options.project) engine.importGameData(options.project);
        const api = createBaseRuntimeApi(engine, cleanup);
        if (options.online) api.connectOnline(options.online);
        owned?.querySelector('button#btn-export-reset')?.addEventListener('click', () => api.resetGame());
        return api;
    } catch (error) {
        try { engine?.destroy(); } finally { cleanup(); }
        throw error;
    }
}

export { createBaseRuntimeApi };
export type { BaseRuntimeApi };
