
import { TextResources } from '../../runtime/adapters/TextResources';
import { Modal } from '../../ui/Modal';

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
    /** Invoked by the header "✕", the footer close button, the backdrop and Escape. */
    onClose: () => void;
    /** Extra class for the panel, for per-entity tweaks. */
    panelClassName?: string;
    /** Label for the footer close button (defaults to "Fechar"). */
    closeLabel?: string;
    /** aria-label for the header "✕" button (defaults to closeLabel). */
    closeAriaLabel?: string;
}

/**
 * Editor-side wrapper over the shared {@link Modal} shell.
 *
 * The entity editors (objects, NPCs, enemies) all describe themselves the same
 * way — a preview, a title with chips, a body and a row of actions — so this
 * class turns that description into the shell's header/body/footer calls and
 * keeps the per-open rebuild the editors were already written against.
 */
class EditorModal {
    private readonly getHost: () => HTMLElement | null;
    private modal: Modal | null = null;
    private currentOnClose: (() => void) | null = null;

    constructor(getHost: () => HTMLElement | null) {
        this.getHost = getHost;
    }

    get host(): HTMLElement | null {
        return this.getHost();
    }

    get isOpen(): boolean {
        return this.modal?.isOpen ?? false;
    }

    open(config: EditorModalConfig): void {
        const modal = this.ensureModal();
        if (!modal) return;

        this.currentOnClose = config.onClose;

        if (config.panelClassName) {
            modal.panel.classList.add(...config.panelClassName.split(' ').filter(Boolean));
        }

        modal.setHeader({
            title: config.header.title,
            subtitle: config.header.subtitle,
            subtitleAsChip: true,
            badge: config.header.badge,
            description: config.header.description,
            drawPreview: config.header.drawPreview,
        });
        modal.setBody(config.body ?? null);
        modal.setFooter([
            {
                label: config.closeLabel ?? TextResources.get('buttons.close', 'Fechar'),
                onClick: () => this.requestClose(),
            },
            ...(config.buttons ?? []).map((button) => ({
                label: button.label,
                variant: this.buttonVariant(button.variant),
                onClick: button.onClick,
            })),
        ]);

        modal.open();
    }

    /** Hides the modal. Cleanup logic belongs in the consumer's `onClose`. */
    close(): void {
        this.modal?.close();
        this.currentOnClose = null;
    }

    private requestClose(): void {
        const onClose = this.currentOnClose;
        if (onClose) onClose();
        else this.close();
    }

    /**
     * Built on first open, not in the constructor: the host element comes from
     * the editor's DOM cache, which is not populated yet when this class is
     * constructed.
     */
    private ensureModal(): Modal | null {
        if (this.modal) return this.modal;

        const host = this.host;
        if (!host) return null;

        this.modal = new Modal({
            root: host,
            size: 'sm',
            onClose: () => this.requestClose(),
        });
        return this.modal;
    }

    private buttonVariant(variant: EditorModalButtonVariant = 'default'): 'default' | 'accent' | 'danger' {
        switch (variant) {
            case 'move':
                return 'accent';
            case 'remove':
                return 'danger';
            default:
                return 'default';
        }
    }
}

export { EditorModal };
export type { EditorModalConfig, EditorModalButton, EditorModalHeader, EditorModalButtonVariant };
