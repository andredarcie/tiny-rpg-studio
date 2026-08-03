import { TextResources } from '../../runtime/adapters/TextResources';
import { Modal } from '../../ui/Modal';

type PlayerNameModalOptions = {
    onConfirm: (name: string) => void;
};

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 16;

/**
 * Asks for the player's name before joining an online match.
 *
 * This one is deliberately not dismissible — no close button, no backdrop, no
 * Escape: without a name there is nothing to join, so a dismissed prompt would
 * leave the player staring at an empty screen.
 */
export class PlayerNameModal {
    private modal: Modal;
    private input: HTMLInputElement;
    private options: PlayerNameModalOptions;

    constructor(options: PlayerNameModalOptions) {
        this.options = options;
        this.input = document.createElement('input');

        this.modal = new Modal({
            className: 'player-name-modal',
            size: 'sm',
            closeOnBackdrop: false,
            closeOnEscape: false,
            showCloseButton: false,
        });
        this.modal.setHeader({ title: TextResources.get('online.nameModal.title', 'Entrar na partida') });
        this.modal.setBody(this.buildBody());
        this.modal.setFooter([{
            label: TextResources.get('online.nameModal.confirm', 'Entrar'),
            className: 'player-name-modal__confirm',
            onClick: () => this.confirm(),
        }]);
    }

    private buildBody(): HTMLElement {
        const body = document.createElement('div');

        this.input.className = 'player-name-modal__input';
        this.input.maxLength = NAME_MAX_LENGTH;
        this.input.placeholder = TextResources.get('online.nameModal.placeholder', 'Seu nome (2–16 chars)');
        this.input.addEventListener('input', () => {
            this.input.classList.remove('player-name-modal__input--invalid');
        });
        this.input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') this.confirm();
        });

        const savedName = sessionStorage.getItem('tiny-rpg-player-name') || '';
        if (savedName) this.input.value = savedName;

        body.appendChild(this.input);
        return body;
    }

    private confirm(): void {
        const name = this.input.value.trim().slice(0, NAME_MAX_LENGTH);
        if (name.length < NAME_MIN_LENGTH) {
            this.input.classList.add('player-name-modal__input--invalid');
            return;
        }
        sessionStorage.setItem('tiny-rpg-player-name', name);
        this.modal.remove();
        this.options.onConfirm(name);
    }

    show(): void {
        this.modal.open();
        requestAnimationFrame(() => this.input.focus());
        if (this.input.value) this.input.select();
    }
}
