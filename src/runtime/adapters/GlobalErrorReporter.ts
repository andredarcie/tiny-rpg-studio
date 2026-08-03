import { TextResources } from './TextResources';

/**
 * Last-resort handler for uncaught errors and rejected promises.
 *
 * The engine draws to a canvas, so an exception thrown outside a try/catch
 * leaves the player looking at a frozen or blank screen with no indication that
 * anything went wrong — and, in the editor, no hint that their work may be at
 * risk. This surfaces a single dismissible banner instead.
 *
 * Styles are inlined rather than pulled from a stylesheet because this module is
 * shared by the Studio and the exported play-only runtime, which ship different
 * CSS bundles. An error banner that depends on a stylesheet could fail to render
 * in exactly the situation it exists for.
 */

/** Only one banner at a time — a failing render loop can throw every frame. */
let bannerVisible = false;
let installed = false;

function t(key: string, fallback: string): string {
    const value = TextResources.get(key, fallback) as string;
    return value || fallback;
}

function showBanner(detail: string, options: { title?: string; body?: string } = {}): void {
    // lib.dom types document.body as non-nullable, but it genuinely is null when an
    // error is thrown before <body> is parsed — exactly when this handler runs.
    // querySelector reports the nullability honestly, so the guard is type-checked.
    const host = document.querySelector('body');
    if (bannerVisible || !host) return;
    bannerVisible = true;

    const banner = document.createElement('div');
    banner.className = 'tiny-rpg-error-banner';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = [
        'position:fixed', 'inset-inline:0', 'top:0', 'z-index:99999',
        'display:flex', 'gap:12px', 'align-items:flex-start', 'justify-content:center',
        'padding:12px 16px', 'background:#7E2553', 'color:#FFF1E8',
        'font-family:monospace', 'font-size:13px', 'line-height:1.4',
        'box-shadow:0 2px 8px rgba(0,0,0,.4)'
    ].join(';');

    const text = document.createElement('div');
    text.style.cssText = 'max-width:70ch';
    const title = document.createElement('strong');
    title.textContent = options.title ?? t('errors.unexpected.title', 'Something went wrong.');
    const body = document.createElement('div');
    body.textContent = options.body ?? t(
        'errors.unexpected.body',
        'The game hit an unexpected error. Reload the page to continue — your last saved project is kept.'
    );
    text.append(title, body);

    if (detail) {
        const technical = document.createElement('div');
        technical.style.cssText = 'margin-top:6px;opacity:.75;word-break:break-word';
        technical.textContent = detail;
        text.append(technical);
    }

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = t('errors.dismiss', 'Dismiss');
    dismiss.style.cssText = [
        'flex:0 0 auto', 'cursor:pointer', 'padding:4px 10px',
        'background:#FFF1E8', 'color:#7E2553', 'border:0', 'font-family:inherit', 'font-size:inherit'
    ].join(';');
    dismiss.addEventListener('click', () => {
        banner.remove();
        bannerVisible = false;
    });

    banner.append(text, dismiss);
    host.appendChild(banner);
}

function describe(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    if (typeof error === 'string') return error;
    return 'Unknown error';
}

/**
 * Installs the handlers. Safe to call more than once; only the first call binds.
 */
function installGlobalErrorReporter(): void {
    if (installed || typeof globalThis.addEventListener !== 'function') return;
    installed = true;

    globalThis.addEventListener('error', (event: ErrorEvent) => {
        // Resource load failures (a missing image, say) also fire "error" on the
        // window, but they carry no `error` object and should not alarm the user.
        if (!event.error) return;
        console.error('[TinyRPG] Uncaught error.', event.error);
        showBanner(describe(event.error));
    });

    globalThis.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        console.error('[TinyRPG] Unhandled promise rejection.', event.reason);
        showBanner(describe(event.reason));
    });
}

/**
 * Surfaces an expected-but-unrecoverable condition to the user in the same
 * banner, without a technical detail line. Use for cases the code already
 * handles but the player would otherwise experience as silent wrong behaviour —
 * a share link that failed to decode, for instance.
 */
function reportRecoverableError(titleKey: string, bodyKey: string, fallbacks: { title: string; body: string }): void {
    showBanner('', {
        title: t(titleKey, fallbacks.title),
        body: t(bodyKey, fallbacks.body),
    });
}

export { installGlobalErrorReporter, reportRecoverableError };
