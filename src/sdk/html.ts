import type { OnlineSessionOptions } from '../online/OnlineSession';
import { assembleExportHtml, createExportGameMarkup, type ExportHtmlResult } from '../editor/modules/export/ExportHtmlAssembler';
import { TinyRPGBuilder } from './TinyRPGBuilder';
import type { BaseProjectData } from './types';

export type HtmlExportOptions = {
    runtimeJavaScript: string;
    css: string;
    fontDataUrl: string;
    online?: OnlineSessionOptions;
    locale?: string;
    editableInStudio?: boolean;
};

export function exportHtml(project: BaseProjectData, options: HtmlExportOptions): ExportHtmlResult {
    const builder = TinyRPGBuilder.fromProjectData(project);
    return assembleExportHtml({ ...options, runtimeJavaScript: (options.online ? `globalThis.__TINY_RPG_ONLINE_OPTIONS=${JSON.stringify(options.online)};` : '') + options.runtimeJavaScript, locale: options.locale ?? 'en-US', editableInStudio: options.editableInStudio ?? true,
        title: project.title, gameCode: builder.toShareCode(), bundledProject: { game: builder.toProjectData(), plugins: [] },
        gameMarkup: createExportGameMarkup({ reset: 'Restart' }), openStudioLabel: 'Open in Studio' });
}

export { assembleExportHtml, createExportGameMarkup };
