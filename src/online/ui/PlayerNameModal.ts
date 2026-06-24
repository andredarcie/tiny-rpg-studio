import { TextResources } from '../../runtime/adapters/TextResources';

type PlayerNameModalOptions = {
    onConfirm: (name: string) => void;
};

export class PlayerNameModal {
    private overlay: HTMLElement;
    private input: HTMLInputElement;
    private btn: HTMLButtonElement;
    private options: PlayerNameModalOptions;

    constructor(options: PlayerNameModalOptions) {
        this.options = options;
        this.overlay = document.createElement('div');
        this.input = document.createElement('input');
        this.btn = document.createElement('button');
        this.build();
    }

    private build(): void {
        Object.assign(this.overlay.style, {
            position: 'fixed',
            inset: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(14,15,19,0.92)',
            zIndex: '9999',
            padding: '16px',
        });

        const box = document.createElement('div');
        Object.assign(box.style, {
            background: 'var(--panel, #151821)',
            border: '4px solid var(--border, #232734)',
            padding: 'clamp(16px, 4vw, 24px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: 'min(300px, calc(100vw - 32px))',
            fontFamily: 'var(--ui-font-family, monospace)',
        });

        const title = document.createElement('div');
        title.textContent = TextResources.get('online.nameModal.title', 'Entrar na partida');
        Object.assign(title.style, {
            color: 'var(--accent, #5bfa8e)',
            fontWeight: 'bold',
            borderBottom: '1px solid var(--border, #232734)',
            paddingBottom: '8px',
            marginBottom: '2px',
        });

        Object.assign(this.input.style, {
            background: 'var(--bg, #0e0f13)',
            border: '2px solid var(--border, #232734)',
            color: 'var(--text, #fff)',
            padding: '7px 8px',
            width: '100%',
            fontFamily: 'var(--ui-font-family, monospace)',
            outline: 'none',
        });
        this.input.maxLength = 16;
        this.input.placeholder = TextResources.get('online.nameModal.placeholder', 'Seu nome (2–16 chars)');
        this.input.addEventListener('focus', () => {
            this.input.style.borderColor = 'var(--accent, #5bfa8e)';
        });
        this.input.addEventListener('blur', () => {
            this.input.style.borderColor = 'var(--border, #232734)';
        });

        const savedName = sessionStorage.getItem('tiny-rpg-player-name') || '';
        if (savedName) this.input.value = savedName;

        Object.assign(this.btn.style, {
            background: 'var(--accent, #5bfa8e)',
            border: 'none',
            color: 'var(--bg, #0e0f13)',
            padding: '8px',
            width: '100%',
            fontFamily: 'var(--ui-font-family, monospace)',
            fontWeight: 'bold',
            cursor: 'pointer',
        });
        this.btn.textContent = TextResources.get('online.nameModal.confirm', 'Entrar');

        this.btn.addEventListener('click', () => this.confirm());
        this.input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') this.confirm();
        });

        box.append(title, this.input, this.btn);
        this.overlay.appendChild(box);
    }

    private confirm(): void {
        const name = this.input.value.trim().slice(0, 16);
        if (name.length < 2) {
            this.input.style.borderColor = '#ff4040';
            return;
        }
        sessionStorage.setItem('tiny-rpg-player-name', name);
        this.remove();
        this.options.onConfirm(name);
    }

    show(): void {
        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.input.focus());
        if (this.input.value) this.input.select();
    }

    private remove(): void {
        this.overlay.remove();
    }
}
