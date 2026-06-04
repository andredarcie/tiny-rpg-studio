import type { ChatEntry } from '../shared/protocol';
import type { OnlineClient } from '../client/OnlineClient';

const MAX_LOCAL_MESSAGES = 30;

export class ChatPanel {
    private client: OnlineClient;
    private root: HTMLDivElement;
    private toggleButton: HTMLButtonElement;
    private panel: HTMLDivElement;
    private list: HTMLDivElement;
    private form: HTMLFormElement;
    private input: HTMLInputElement;
    private messages: ChatEntry[] = [];
    private unreadCount = 0;

    constructor(client: OnlineClient) {
        this.client = client;
        this.root = document.createElement('div');
        this.root.className = 'online-chat';

        this.toggleButton = document.createElement('button');
        this.toggleButton.id = 'online-chat-toggle';
        this.toggleButton.className = 'online-chat__toggle';
        this.toggleButton.type = 'button';
        this.toggleButton.textContent = 'Chat';
        this.toggleButton.setAttribute('aria-expanded', 'false');
        this.toggleButton.setAttribute('aria-controls', 'online-chat-panel');

        this.panel = document.createElement('div');
        this.panel.id = 'online-chat-panel';
        this.panel.className = 'online-chat__panel';
        this.panel.hidden = true;

        const header = document.createElement('div');
        header.className = 'online-chat__header';
        header.textContent = 'Chat';

        this.list = document.createElement('div');
        this.list.className = 'online-chat__messages';
        this.list.setAttribute('aria-live', 'polite');

        this.form = document.createElement('form');
        this.form.className = 'online-chat__form';

        this.input = document.createElement('input');
        this.input.className = 'online-chat__input';
        this.input.type = 'text';
        this.input.maxLength = 180;
        this.input.placeholder = 'Digite uma mensagem';
        this.input.autocomplete = 'off';

        const sendButton = document.createElement('button');
        sendButton.className = 'online-chat__send';
        sendButton.type = 'submit';
        sendButton.textContent = 'Enviar';

        this.form.append(this.input, sendButton);
        this.panel.append(header, this.list, this.form);
        this.root.append(this.toggleButton, this.panel);

        this.toggleButton.addEventListener('click', () => this.toggle());
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.sendCurrentMessage();
        });
    }

    mountNearControls(): void {
        const controlsToggle = document.getElementById('touch-controls-toggle');
        if (controlsToggle?.parentElement) {
            const actions = document.createElement('div');
            actions.className = 'online-chat-actions';
            controlsToggle.parentElement.insertBefore(actions, controlsToggle);
            actions.append(controlsToggle, this.root);
            return;
        }
        document.getElementById('game-container')?.appendChild(this.root);
    }

    bind(): void {
        this.client.on('chat-history', (msg) => {
            this.messages = msg.messages.slice(-MAX_LOCAL_MESSAGES);
            this.renderMessages();
        });
        this.client.on('chat-message', (msg) => {
            this.addMessage(msg.message);
        });
    }

    private toggle(): void {
        const open = this.panel.hidden;
        this.panel.hidden = !open;
        this.toggleButton.setAttribute('aria-expanded', String(open));
        if (open) {
            this.unreadCount = 0;
            this.updateToggleLabel();
            this.input.focus();
            this.scrollToLatest();
        }
    }

    private sendCurrentMessage(): void {
        const text = this.input.value.trim();
        if (!text) return;
        if (!this.client.isConnected) {
            this.input.style.borderColor = '#ff4d4d';
            setTimeout(() => { this.input.style.borderColor = ''; }, 1000);
            return;
        }
        this.client.send({
            type: 'chat-message',
            message: { id: '', playerId: this.client.sessionToken, playerName: '', text, sentAt: Date.now() },
        });
        this.input.value = '';
        // Optimistic update — show immediately without waiting for server echo
        this.addMessage({
            id: `local-${Date.now()}`,
            playerId: this.client.sessionToken,
            playerName: '',
            text,
            sentAt: Date.now(),
        });
    }

    private addMessage(message: ChatEntry): void {
        // Deduplicate: if the server echo matches a locally-optimistic message
        // (same sender, same text, within 5s), replace it with the authoritative entry.
        const isOwnEcho = message.playerId === this.client.sessionToken && message.id !== '' && !message.id.startsWith('local-');
        if (isOwnEcho) {
            const idx = this.messages.reduceRight((found: number, m: ChatEntry, i: number) =>
                found === -1 && m.id.startsWith('local-') && m.text === message.text ? i : found, -1);
            if (idx >= 0) {
                this.messages = [...this.messages.slice(0, idx), message, ...this.messages.slice(idx + 1)];
                this.renderMessages();
                return;
            }
        }
        this.messages = [...this.messages, message].slice(-MAX_LOCAL_MESSAGES);
        if (this.panel.hidden && message.playerId !== this.client.sessionToken) {
            this.unreadCount = Math.min(this.unreadCount + 1, 9);
        }
        this.renderMessages();
        this.updateToggleLabel();
    }

    private renderMessages(): void {
        this.list.innerHTML = '';
        if (this.messages.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'online-chat__empty';
            empty.textContent = 'Nenhuma mensagem ainda.';
            this.list.appendChild(empty);
            return;
        }

        for (const message of this.messages) {
            const item = document.createElement('div');
            item.className = 'online-chat__message';
            if (message.playerId === this.client.sessionToken) {
                item.classList.add('online-chat__message--self');
            }

            const name = document.createElement('span');
            name.className = 'online-chat__name';
            name.textContent = message.playerId === this.client.sessionToken ? 'Você' : message.playerName;

            const text = document.createElement('span');
            text.className = 'online-chat__text';
            text.textContent = message.text;

            item.append(name, text);
            this.list.appendChild(item);
        }
        this.scrollToLatest();
    }

    private updateToggleLabel(): void {
        this.toggleButton.textContent = this.unreadCount > 0 ? `Chat ${this.unreadCount}` : 'Chat';
    }

    private scrollToLatest(): void {
        requestAnimationFrame(() => {
            this.list.scrollTop = this.list.scrollHeight;
        });
    }
}
