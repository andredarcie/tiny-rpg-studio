
import { TextResources } from '../../runtime/adapters/TextResources';

type EditorModalButtonVariant = 'default' | 'move' | 'remove';

interface EditorModalButton {
    label: string;
    variant?: EditorModalButtonVariant;
    onClick: () => void;
}

interface EditorModalHeader {
    title: string;
    /** Optional neutral chip shown below the title (e.g. the "(x, y)" position). */
    subtitle?: string | null;
    /** Optional accent chip shown below the title (e.g. a category tag). */
    badge?: string | null;
    /** Optional descriptive paragraph below the title. */
    description?: string | null;
    /** Hook to paint the 48x48 preview canvas. When omitted, no preview is shown. */
    drawPreview?: (canvas: HTMLCanvasElement) => void;
}

interface EditorModalConfig {
    header: EditorModalHeader;
    /** Fully built (and classed) content area. */
    body?: HTMLElement | null;
    /** Extra footer buttons rendered after the standard close button. */
    buttons?: EditorModalButton[];
    /** Invoked by the header "✕", the footer close button and the Escape key. */
    onClose: () => void;
    /** Override the panel class (defaults to the shared object-edit-modal panel). */
    panelClassName?: string;
    /** Label for the footer close button (defaults to "Fechar"). */
    closeLabel?: string;
    /** aria-label for the header "✕" button (defaults to closeLabel). */
    closeAriaLabel?: string;
}

const PANEL_SELECTOR = '.editor-modal__panel';

/**
 * Generic edit-modal shell shared across editor contexts (objects, NPCs, ...).
 *
 * It owns nothing but the host element: each `open()` rebuilds the panel from
 * scratch from the supplied config, mirroring the existing rebuild-on-open
 * behaviour. Visual styling reuses the shared `object-edit-modal__*` classes.
 */
class EditorModal {
    private readonly getHost: () => HTMLElement | null;
    private currentOnClose: (() => void) | null = null;

    constructor(getHost: () => HTMLElement | null) {
        this.getHost = getHost;
        this.bindStaticEvents();
    }

    get host(): HTMLElement | null {
        return this.getHost();
    }

    get isOpen(): boolean {
        const host = this.host;
        return Boolean(host && !host.hidden);
    }

    open(config: EditorModalConfig): void {
        const host = this.host;
        if (!host) return;

        const existing = host.querySelector(PANEL_SELECTOR);
        if (existing) existing.remove();

        this.currentOnClose = config.onClose;
        host.appendChild(this.buildPanel(config));
        host.hidden = false;
    }

    /** Hides the modal. Cleanup logic belongs in the consumer's `onClose`. */
    close(): void {
        const host = this.host;
        if (host) host.hidden = true;
        this.currentOnClose = null;
    }

    private requestClose(): void {
        const onClose = this.currentOnClose;
        if (onClose) onClose();
        else this.close();
    }

    private bindStaticEvents(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.requestClose();
            }
        });
    }

    private buildPanel(config: EditorModalConfig): HTMLElement {
        const panel = document.createElement('div');
        panel.className = `editor-modal__panel ${config.panelClassName ?? 'object-edit-modal__panel'}`;

        panel.appendChild(this.buildHeader(config));
        if (config.body) panel.appendChild(config.body);
        panel.appendChild(this.buildFooter(config));
        return panel;
    }

    private buildHeader(config: EditorModalConfig): HTMLElement {
        const { header } = config;
        const el = document.createElement('div');
        el.className = 'object-edit-modal__header';

        if (header.drawPreview) {
            const preview = document.createElement('canvas');
            preview.width = 48;
            preview.height = 48;
            preview.className = 'object-preview object-edit-modal__preview';
            header.drawPreview(preview);
            el.appendChild(preview);
        }

        const titleGroup = document.createElement('div');
        titleGroup.className = 'object-edit-modal__title-group';

        const title = document.createElement('h3');
        title.className = 'object-edit-modal__title';
        title.textContent = header.title;
        titleGroup.appendChild(title);

        const subtitle = document.createElement('span');
        subtitle.className = 'object-position';
        subtitle.textContent = header.subtitle ?? '';
        titleGroup.appendChild(subtitle);

        if (header.badge) {
            const badge = document.createElement('span');
            badge.className = 'editor-modal__badge';
            badge.textContent = header.badge;
            titleGroup.appendChild(badge);
        }

        if (header.description) {
            const desc = document.createElement('p');
            desc.className = 'object-edit-modal__desc';
            desc.textContent = header.description;
            titleGroup.appendChild(desc);
        }

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'object-edit-modal__close';
        closeBtn.setAttribute('aria-label', config.closeAriaLabel ?? config.closeLabel ?? TextResources.get('buttons.close', 'Fechar'));
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.requestClose());

        el.append(titleGroup, closeBtn);
        return el;
    }

    private buildFooter(config: EditorModalConfig): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'object-edit-modal__footer';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-secondary';
        closeBtn.textContent = config.closeLabel ?? TextResources.get('buttons.close', 'Fechar');
        closeBtn.addEventListener('click', () => this.requestClose());
        footer.appendChild(closeBtn);

        for (const button of config.buttons ?? []) {
            footer.appendChild(this.buildButton(button));
        }

        return footer;
    }

    private buildButton(button: EditorModalButton): HTMLElement {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = this.buttonClassName(button.variant);
        el.textContent = button.label;
        el.addEventListener('click', () => button.onClick());
        return el;
    }

    private buttonClassName(variant: EditorModalButtonVariant = 'default'): string {
        switch (variant) {
            case 'move':
                return 'btn-secondary object-edit-modal__move';
            case 'remove':
                return 'btn-secondary object-edit-modal__remove';
            default:
                return 'btn-secondary';
        }
    }
}

export { EditorModal };
export type { EditorModalConfig, EditorModalButton, EditorModalHeader, EditorModalButtonVariant };
