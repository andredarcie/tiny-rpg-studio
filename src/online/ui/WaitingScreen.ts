import { TextResources } from '../../runtime/adapters/TextResources';

type WaitingScreenOptions = {
    onRespawn: () => void;
};

export class WaitingScreen {
    private overlay: HTMLElement;
    private countdownEl: HTMLElement;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private options: WaitingScreenOptions;

    constructor(options: WaitingScreenOptions) {
        this.options = options;
        this.overlay = document.createElement('div');
        this.countdownEl = document.createElement('div');
        this.build();
    }

    private build(): void {
        Object.assign(this.overlay.style, {
            position: 'fixed',
            inset: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(14,15,19,0.80)',
            zIndex: '9997',
            fontFamily: 'var(--ui-font-family, monospace)',
        });

        const box = document.createElement('div');
        Object.assign(box.style, {
            background: 'var(--panel, #151821)',
            border: '4px solid var(--border, #232734)',
            borderTop: '4px solid #ff4040',
            padding: 'clamp(16px, 4vw, 28px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: 'min(280px, calc(100vw - 32px))',
            textAlign: 'center',
        });

        const title = document.createElement('div');
        title.textContent = TextResources.get('online.waiting.title', 'Você foi derrotado');
        Object.assign(title.style, {
            color: '#ff4040',
            fontWeight: 'bold',
        });

        const label = document.createElement('div');
        label.textContent = TextResources.get('online.waiting.respawnIn', 'Voltando em');
        Object.assign(label.style, {
            color: 'rgba(255,255,255,0.5)',
        });

        Object.assign(this.countdownEl.style, {
            color: 'var(--accent, #5bfa8e)',
            fontWeight: 'bold',
            fontSize: 'calc(var(--engine-font-size, 8px) * 3)',
            lineHeight: '1',
        });

        box.append(title, label, this.countdownEl);
        this.overlay.appendChild(box);
    }

    show(seconds: number): void {
        document.body.appendChild(this.overlay);
        let remaining = seconds;
        this.countdownEl.textContent = String(remaining);

        this.intervalId = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                this.dismiss();
                this.options.onRespawn();
            } else {
                this.countdownEl.textContent = String(remaining);
            }
        }, 1000);
    }

    dismiss(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.overlay.remove();
    }
}
