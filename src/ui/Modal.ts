/**
 * Modal — the one dialog shell every modal in the engine is built on.
 *
 * Before this existed the engine had five different modal looks (different
 * scrims, border widths, corner radii and close glyphs) and five different sets
 * of behaviour: some closed on Escape, some on a backdrop click, some on
 * neither, and only a few announced themselves as dialogs. This class owns all
 * of that in one place so a new modal gets the engine's look and the expected
 * keyboard/pointer behaviour for free.
 *
 * It works two ways, because the engine authors modals two ways:
 *
 * - **Adopting** existing markup (`{ root }`): the panel is already in
 *   index.html with the `tiny-modal__*` classes. The component only wires
 *   behaviour and ARIA, leaving the authored content untouched.
 * - **Building** from scratch (no `root`): the overlay and panel are created
 *   and appended to `<body>`, then filled through {@link Modal.setHeader},
 *   {@link Modal.setBody} and {@link Modal.setFooter}.
 *
 * Visibility is always the `hidden` attribute on the overlay, which is what the
 * modals used before and what the existing tests assert on.
 */
import { TextResources } from '../runtime/adapters/TextResources';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'auto';

type ModalButtonVariant = 'default' | 'primary' | 'accent' | 'danger';

interface ModalHeaderConfig {
    title: string;
    /** Neutral line under the title (e.g. the "(x, y)" position chip). */
    subtitle?: string | null;
    /** Accent chip under the title (e.g. a category tag). */
    badge?: string | null;
    /** Descriptive paragraph under the title. */
    description?: string | null;
    /** Node placed between the title group and the close button. */
    aside?: HTMLElement | null;
    /** Paints the 48x48 preview canvas shown before the title. */
    drawPreview?: ((canvas: HTMLCanvasElement) => void) | null;
    /** Renders the subtitle as a neutral chip instead of a plain line. */
    subtitleAsChip?: boolean;
}

interface ModalButtonConfig {
    label: string;
    variant?: ModalButtonVariant;
    /** Extra classes appended after the variant class. */
    className?: string;
    id?: string;
    onClick: () => void;
}

interface ModalOptions {
    /** Overlay element to adopt. When omitted, one is created and appended to <body>. */
    root?: HTMLElement | null;
    size?: ModalSize;
    /** Extra class on the overlay, for per-modal tokens (width, z-index). */
    className?: string;
    /** Extra class on the panel. */
    panelClassName?: string;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    showCloseButton?: boolean;
    closeAriaLabel?: string;
    /** id of the element that names the dialog. */
    labelledBy?: string;
    /**
     * Called when the user dismisses the modal (close button, backdrop, Escape).
     * Defaults to {@link Modal.close}; override it when the consumer needs to run
     * its own teardown, and call `close()` from there.
     */
    onClose?: () => void;
}

const CLOSE_GLYPH = '✕';

/** Fallback ids for headers on modals whose host element has none. */
let titleSeq = 0;

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Every live modal, in construction order. A single document-level key handler
 * serves all of them, so Escape closes one modal instead of every open modal at
 * once — which is what happened when each modal registered its own listener.
 */
const liveModals: Modal[] = [];
let keydownBound = false;

/** The visible modal that should receive Escape / trap focus. */
function topmostOpenModal(): Modal | null {
    for (let i = liveModals.length - 1; i >= 0; i--) {
        const modal = liveModals[i];
        if (modal.isVisible) return modal;
    }
    return null;
}

function trapFocus(modal: Modal, event: KeyboardEvent): void {
    const focusable = Array.from(
        modal.panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => !el.hidden && el.getClientRects().length > 0);

    if (focusable.length === 0) {
        event.preventDefault();
        modal.panel.focus();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === modal.panel)) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    }
}

function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' && event.key !== 'Tab') return;

    const modal = topmostOpenModal();
    if (!modal) return;

    if (event.key === 'Escape') {
        if (!modal.closeOnEscape) return;
        event.preventDefault();
        modal.requestClose();
        return;
    }

    trapFocus(modal, event);
}

function ensureKeydownBound(): void {
    if (keydownBound || typeof document === 'undefined') return;
    document.addEventListener('keydown', handleKeydown);
    keydownBound = true;
}

class Modal {
    readonly root: HTMLElement;
    readonly panel: HTMLElement;
    readonly closeOnEscape: boolean;

    private readonly closeOnBackdrop: boolean;
    private readonly onCloseHandler: (() => void) | null;
    private headerEl: HTMLElement | null = null;
    private bodyEl: HTMLElement | null = null;
    private footerEl: HTMLElement | null = null;
    private previouslyFocused: HTMLElement | null = null;

    private readonly boundBackdrop = (event: MouseEvent): void => {
        if (event.target === this.root) this.requestClose();
    };

    constructor(options: ModalOptions = {}) {
        const {
            root = null,
            size = 'md',
            className,
            panelClassName,
            closeOnBackdrop = true,
            closeOnEscape = true,
            showCloseButton = true,
            closeAriaLabel,
            labelledBy,
            onClose,
        } = options;

        this.closeOnBackdrop = closeOnBackdrop;
        this.closeOnEscape = closeOnEscape;
        this.onCloseHandler = onClose ?? null;

        this.root = root ?? document.createElement('div');
        this.root.classList.add('tiny-modal');
        if (className) this.root.classList.add(...className.split(' ').filter(Boolean));
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        if (labelledBy) this.root.setAttribute('aria-labelledby', labelledBy);

        const adopted = this.root.querySelector<HTMLElement>('.tiny-modal__panel');
        this.panel = adopted ?? document.createElement('div');
        this.panel.classList.add('tiny-modal__panel');
        // Adopted markup states its own size; adding the default on top would
        // leave two --modal-width declarations fighting on stylesheet order.
        const hasSize = Array.from(this.panel.classList)
            .some((name) => name.startsWith('tiny-modal__panel--'));
        if (!hasSize) this.panel.classList.add(`tiny-modal__panel--${size}`);
        if (panelClassName) this.panel.classList.add(...panelClassName.split(' ').filter(Boolean));
        this.panel.tabIndex = -1;

        if (adopted) {
            this.headerEl = adopted.querySelector<HTMLElement>('.tiny-modal__header');
            this.bodyEl = adopted.querySelector<HTMLElement>('.tiny-modal__body');
            this.footerEl = adopted.querySelector<HTMLElement>('.tiny-modal__footer');
            this.bindAuthoredCloseButtons();
        } else {
            this.headerEl = document.createElement('div');
            this.headerEl.className = 'tiny-modal__header';
            // Stays out of the way until setHeader() fills it, so a modal that
            // never sets one does not render an empty bordered bar.
            this.headerEl.hidden = true;
            this.panel.appendChild(this.headerEl);
            this.root.appendChild(this.panel);
        }

        if (!root) {
            this.root.hidden = true;
            document.body.appendChild(this.root);
        }

        if (showCloseButton && !adopted) {
            this.headerEl?.appendChild(this.buildCloseButton(closeAriaLabel));
        }

        if (this.closeOnBackdrop) this.root.addEventListener('click', this.boundBackdrop);

        ensureKeydownBound();
        liveModals.push(this);
    }

    get isOpen(): boolean {
        return !this.root.hidden;
    }

    /**
     * Open *and* still in the document. Connectedness matters for the shared
     * key handler: a modal whose host was torn out must not swallow Escape from
     * the modal that is actually on screen. It is deliberately not part of
     * `isOpen`, so `close()` still works on a detached host.
     */
    get isVisible(): boolean {
        return this.root.isConnected && !this.root.hidden;
    }

    /** The scrolling content area, once one exists. */
    get body(): HTMLElement | null {
        return this.bodyEl;
    }

    open(): void {
        if (this.isOpen) return;
        this.previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        this.root.hidden = false;
        this.panel.focus({ preventScroll: true });
    }

    close(): void {
        if (!this.isOpen) return;
        this.root.hidden = true;
        const restore = this.previouslyFocused;
        this.previouslyFocused = null;
        restore?.focus({ preventScroll: true });
    }

    /** Runs the consumer's dismiss handler, or closes when there is none. */
    requestClose(): void {
        if (this.onCloseHandler) this.onCloseHandler();
        else this.close();
    }

    setHeader(config: ModalHeaderConfig): void {
        const header = this.headerEl;
        if (!header) return;

        const closeBtn = header.querySelector<HTMLElement>('.tiny-modal__close');
        header.replaceChildren();
        header.hidden = false;

        if (config.drawPreview) {
            const preview = document.createElement('canvas');
            preview.width = 48;
            preview.height = 48;
            preview.className = 'tiny-modal__preview';
            config.drawPreview(preview);
            header.appendChild(preview);
        }

        const group = document.createElement('div');
        group.className = 'tiny-modal__title-group';

        const title = document.createElement('h2');
        title.className = 'tiny-modal__title';
        title.textContent = config.title;
        // Adopted markup points aria-labelledby at its own heading; a panel built
        // here has to publish one, or the dialog reaches screen readers unnamed.
        title.id = this.root.id ? `${this.root.id}-title` : `tiny-modal-title-${++titleSeq}`;
        this.root.setAttribute('aria-labelledby', title.id);
        group.appendChild(title);

        if (config.subtitle) {
            const subtitle = document.createElement('p');
            subtitle.className = config.subtitleAsChip
                ? 'tiny-modal__chip'
                : 'tiny-modal__subtitle';
            subtitle.textContent = config.subtitle;
            group.appendChild(subtitle);
        }

        if (config.badge) {
            const badge = document.createElement('span');
            badge.className = 'tiny-modal__badge';
            badge.textContent = config.badge;
            group.appendChild(badge);
        }

        if (config.description) {
            const desc = document.createElement('p');
            desc.className = 'tiny-modal__desc';
            desc.textContent = config.description;
            group.appendChild(desc);
        }

        header.appendChild(group);
        if (config.aside) header.appendChild(config.aside);
        if (closeBtn) header.appendChild(closeBtn);
    }

    /**
     * Adopts `content` as the scrolling body. The element keeps its own class,
     * so per-modal descendant selectors keep working; padding and scrolling come
     * from the shell.
     */
    setBody(content: HTMLElement | null, options: { stack?: boolean } = {}): void {
        this.bodyEl?.remove();
        this.bodyEl = null;
        if (!content) return;

        content.classList.add('tiny-modal__body');
        if (options.stack !== false) content.classList.add('tiny-modal__body--stack');

        if (this.footerEl) this.panel.insertBefore(content, this.footerEl);
        else this.panel.appendChild(content);
        this.bodyEl = content;
    }

    setFooter(buttons: readonly ModalButtonConfig[]): void {
        this.footerEl?.remove();
        this.footerEl = null;
        if (buttons.length === 0) return;

        const footer = document.createElement('div');
        footer.className = 'tiny-modal__footer';
        for (const button of buttons) footer.appendChild(this.buildButton(button));

        this.panel.appendChild(footer);
        this.footerEl = footer;
    }

    destroy(): void {
        this.root.removeEventListener('click', this.boundBackdrop);
        const index = liveModals.indexOf(this);
        if (index >= 0) liveModals.splice(index, 1);
    }

    /** Removes the overlay from the document. For modals this class created. */
    remove(): void {
        this.destroy();
        this.root.remove();
    }

    private bindAuthoredCloseButtons(): void {
        const buttons = this.root.querySelectorAll<HTMLElement>('[data-modal-close]');
        for (const button of buttons) {
            button.addEventListener('click', () => this.requestClose());
        }
    }

    private buildCloseButton(ariaLabel?: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tiny-modal__close';
        button.textContent = CLOSE_GLYPH;
        button.setAttribute('aria-label', ariaLabel ?? TextResources.get('buttons.close', 'Close'));
        button.addEventListener('click', () => this.requestClose());
        return button;
    }

    private buildButton(config: ModalButtonConfig): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = this.buttonClassName(config.variant);
        if (config.className) button.className += ` ${config.className}`;
        if (config.id) button.id = config.id;
        button.textContent = config.label;
        button.addEventListener('click', () => config.onClick());
        return button;
    }

    private buttonClassName(variant: ModalButtonVariant = 'default'): string {
        switch (variant) {
            case 'primary':
                return 'btn-primary';
            case 'accent':
                return 'btn-secondary tiny-modal__btn--accent';
            case 'danger':
                return 'btn-secondary tiny-modal__btn--danger';
            default:
                return 'btn-secondary';
        }
    }
}

export { Modal };
export type { ModalOptions, ModalHeaderConfig, ModalButtonConfig, ModalButtonVariant, ModalSize };
