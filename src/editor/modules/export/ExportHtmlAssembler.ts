type ExportHtmlSections = {
    javascript: number;
    css: number;
    font: number;
    gameCode: number;
    markup: number;
    total: number;
};

type ExportHtmlOptions = {
    css: string;
    editableInStudio: boolean;
    fontDataUrl: string;
    gameCode: string;
    gameMarkup: string;
    locale: string;
    openStudioLabel: string;
    runtimeJavaScript: string;
    title: string;
};

type ExportHtmlResult = {
    html: string;
    sections: ExportHtmlSections;
};

const OPEN_STUDIO_URL = 'https://andredarcie.github.io/tiny-rpg-studio/#';

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeInlineScript(value: string): string {
    return value
        .replace(/<\/script/gi, '<\\/script')
        .replaceAll('\u2028', '\\u2028')
        .replaceAll('\u2029', '\\u2029');
}

function escapeInlineStyle(value: string): string {
    return value.replace(/<\/style/gi, '<\\/style');
}

function jsonForInlineScript(value: string): string {
    return JSON.stringify(value)
        .replaceAll('<', '\\u003C')
        .replaceAll('\u2028', '\\u2028')
        .replaceAll('\u2029', '\\u2029');
}

function byteLength(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}

type ExportMarkupLabels = {
    down?: string;
    left?: string;
    reset: string;
    right?: string;
    up?: string;
};

function createExportGameMarkup(labels: ExportMarkupLabels): string {
    return [
        '<div class="app"><main><div class="tab-content active" id="tab-game">',
        '<div class="game-container" id="game-container">',
        '<div id="combat-indicator" class="combat-indicator" aria-live="polite" aria-atomic="true"></div>',
        '<div class="game-screen"><canvas id="game-canvas" width="128" height="152"></canvas>',
        '<div id="screen-flash" class="screen-flash" aria-hidden="true"></div></div>',
        '<div id="mobile-touch-pad" class="game-touch-pad"><div class="gb-dpad">',
        `<button class="pad-button pad-up" data-direction="up" aria-label="${escapeHtml(labels.up || 'Up')}"></button>`,
        '<div class="pad-middle-row">',
        `<button class="pad-button pad-left" data-direction="left" aria-label="${escapeHtml(labels.left || 'Left')}"></button>`,
        '<span class="pad-button pad-center" aria-hidden="true"></span>',
        `<button class="pad-button pad-right" data-direction="right" aria-label="${escapeHtml(labels.right || 'Right')}"></button>`,
        `</div><button class="pad-button pad-down" data-direction="down" aria-label="${escapeHtml(labels.down || 'Down')}"></button>`,
        '</div></div>',
        `<button id="btn-export-reset" class="export-reset-button" type="button" aria-label="${escapeHtml(labels.reset)}">R</button>`,
        '</div></div></main></div>',
    ].join('');
}

function assembleExportHtml(options: ExportHtmlOptions): ExportHtmlResult {
    const css = escapeInlineStyle(options.css.replaceAll('pixel-operator.woff', options.fontDataUrl));
    const runtimeJavaScript = escapeInlineScript(options.runtimeJavaScript);
    const gameCodeJson = jsonForInlineScript(options.gameCode);
    const locale = escapeHtml(options.locale);
    const title = escapeHtml(options.title || 'Tiny RPG');
    const openStudioLabel = escapeHtml(options.openStudioLabel);
    const openStudioHidden = options.editableInStudio ? '' : ' hidden';
    const bootScript = escapeInlineScript(
        `globalThis.__TINY_RPG_EXPORT_MODE=true;globalThis.__TINY_RPG_SHARED_CODE=${gameCodeJson};` +
        'if(!location.hash)try{location.hash="#"+globalThis.__TINY_RPG_SHARED_CODE}catch{}',
    );
    const openStudioScript = escapeInlineScript(
        `document.getElementById("btn-open-studio")?.addEventListener("click",()=>window.open("${OPEN_STUDIO_URL}"+(globalThis.__TINY_RPG_SHARED_CODE||""),"_blank"));`,
    );
    const markup =
        `<button id="btn-open-studio" type="button"${openStudioHidden}>${openStudioLabel}</button>` +
        options.gameMarkup;
    const html =
        `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">` +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        `<title>${title}</title><style id="engine-font-config">${css}</style>` +
        `<script>${bootScript}</script></head><body class="game-mode">${markup}` +
        `<script>${openStudioScript}</script><script>${runtimeJavaScript}</script></body></html>`;

    return {
        html,
        sections: {
            javascript:
                byteLength(bootScript) +
                byteLength(openStudioScript) +
                byteLength(runtimeJavaScript) -
                byteLength(gameCodeJson),
            css: byteLength(css) - byteLength(options.fontDataUrl),
            font: byteLength(options.fontDataUrl),
            gameCode: byteLength(gameCodeJson),
            markup: byteLength(markup),
            total: byteLength(html),
        },
    };
}

export {
    assembleExportHtml,
    createExportGameMarkup,
    escapeInlineScript,
    type ExportHtmlOptions,
    type ExportHtmlResult,
    type ExportHtmlSections,
    type ExportMarkupLabels,
};
