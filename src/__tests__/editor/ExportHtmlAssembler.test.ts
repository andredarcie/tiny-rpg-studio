import { describe, expect, it } from 'vitest';
import {
    assembleExportHtml,
    createExportGameMarkup,
} from '../../editor/modules/export/ExportHtmlAssembler';

const makeOptions = () => ({
    css: '@font-face{src:url("pixel-operator.woff")}body{color:white}',
    editableInStudio: true,
    fontDataUrl: 'data:font/woff;base64,Zm9udA==',
    gameCode: 'v11.game-code',
    gameMarkup: createExportGameMarkup({ reset: 'Restart game' }),
    locale: 'en-US',
    openStudioLabel: 'Open Studio',
    runtimeJavaScript: 'globalThis.runtimeLoaded=true;',
    title: 'Example game',
});

describe('ExportHtmlAssembler', () => {
    it('assembles a compact standalone document and reports section sizes', () => {
        const result = assembleExportHtml(makeOptions());

        expect(result.html.startsWith('<!doctype html><html')).toBe(true);
        expect(result.html).not.toContain('\n');
        expect(result.sections.total).toBe(new TextEncoder().encode(result.html).byteLength);
        expect(result.sections.javascript).toBeGreaterThan(0);
        expect(result.sections.css).toBeGreaterThan(0);
        expect(result.sections.font).toBeGreaterThan(0);
        expect(result.sections.gameCode).toBeGreaterThan(0);
        expect(result.sections.markup).toBeGreaterThan(0);
    });

    it('embeds the font exactly once and can hide Open Studio', () => {
        const options = makeOptions();
        options.editableInStudio = false;
        const { html } = assembleExportHtml(options);

        expect(html.match(/data:font\/woff;base64,Zm9udA==/g)).toHaveLength(1);
        expect(html).not.toContain('pixel-operator.woff');
        expect(html).toContain('id="btn-open-studio" type="button" hidden');
    });

    it('escapes closing script and style sequences', () => {
        const options = makeOptions();
        options.runtimeJavaScript = 'globalThis.value="</script><script>bad()</script>";';
        options.css = 'body::after{content:"</style><script>bad()</script>"}';
        options.gameCode = '</script><script>bad()</script>';
        const { html } = assembleExportHtml(options);

        expect(html).not.toContain('</script><script>bad()');
        expect(html).not.toContain('</style><script>bad()');
        expect(html).toContain('<\\/script>');
        expect(html).toContain('<\\/style>');
        expect(html).toContain('\\u003C/script>');
    });

    it('escapes markup labels and retains the import-compatible assignment', () => {
        const options = makeOptions();
        options.openStudioLabel = '<Open & edit>';
        options.title = '<Game>';
        const { html } = assembleExportHtml(options);
        const match = html.match(/__TINY_RPG_SHARED_CODE\s*=\s*([^;]+);/);

        expect(html).toContain('&lt;Open &amp; edit&gt;');
        expect(html).toContain('<title>&lt;Game&gt;</title>');
        expect(match).not.toBeNull();
        expect(JSON.parse(match?.[1] ?? '""')).toBe(options.gameCode);
    });
});
