import { TextResources } from '../../runtime/adapters/TextResources';
import type { ChatEntry } from '../shared/protocol';
import type { OnlineClient } from '../client/OnlineClient';

const MAX_LOCAL_MESSAGES = 30;
// Keep in sync with the server (partykit/src/party.ts MAX_CHAT_MESSAGE_LENGTH).
const MAX_CHAT_MESSAGE_LENGTH = 180;

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
        this.toggleButton.textContent = TextResources.get('online.chat.label', 'Chat');
        this.toggleButton.setAttribute('aria-expanded', 'false');
        this.toggleButton.setAttribute('aria-controls', 'online-chat-panel');

        this.panel = document.createElement('div');
        this.panel.id = 'online-chat-panel';
        this.panel.className = 'online-chat__panel';
        this.panel.hidden = true;

        const header = document.createElement('div');
        header.className = 'online-chat__header';
        const title = document.createElement('span');
        title.textContent = TextResources.get('online.chat.label', 'Chat');
        const closeButton = document.createElement('button');
        closeButton.className = 'online-chat__close';
        closeButton.type = 'button';
        closeButton.textContent = 'X';
        closeButton.setAttribute('aria-label', TextResources.get('online.chat.closeAria', 'Fechar chat'));
        header.append(title, closeButton);

        this.list = document.createElement('div');
        this.list.className = 'online-chat__messages';
        this.list.setAttribute('aria-live', 'polite');

        this.form = document.createElement('form');
        this.form.className = 'online-chat__form';

        this.input = document.createElement('input');
        this.input.className = 'online-chat__input';
        this.input.type = 'text';
        this.input.maxLength = 180;
        this.input.placeholder = TextResources.get('online.chat.placeholder', 'Digite uma mensagem');
        this.input.autocomplete = 'off';

        const sendButton = document.createElement('button');
        sendButton.className = 'online-chat__send';
        sendButton.type = 'submit';
        sendButton.textContent = TextResources.get('online.chat.send', 'Enviar');

        this.form.append(this.input, sendButton);
        this.panel.append(header, this.list, this.form);
        this.root.append(this.toggleButton, this.panel);

        this.toggleButton.addEventListener('click', () => this.toggle());
        closeButton.addEventListener('click', () => this.close());
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

    private close(): void {
        this.panel.hidden = true;
        this.toggleButton.setAttribute('aria-expanded', 'false');
        this.toggleButton.focus();
    }

    private sendCurrentMessage(): void {
        const text = this.normalizeText(this.input.value);
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
        // Keep focus so the user can type the next message right away (and the
        // mobile keyboard stays open) without re-tapping the field.
        this.input.focus();
        // Optimistic update — show immediately without waiting for server echo
        this.addMessage({
            id: `local-${Date.now()}`,
            playerId: this.client.sessionToken,
            playerName: '',
            text,
            sentAt: Date.now(),
        });
    }

    // Normalize identically to the server so the optimistic entry and its
    // authoritative echo carry byte-identical text. The server collapses runs of
    // whitespace and clamps the length; if we skipped that here, a message with
    // double spaces would fail the dedup text match and appear twice.
    private normalizeText(raw: string): string {
        return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_CHAT_MESSAGE_LENGTH);
    }

    private addMessage(message: ChatEntry): void {
        // Deduplicate: when the server echoes back our own message, replace the
        // optimistic local entry instead of appending a second copy. Match on
        // sender + text only and take the oldest pending local entry (FIFO) —
        // NOT on timestamp: the echo's sentAt comes from the server clock while
        // the optimistic entry uses the client clock, so any skew between the two
        // would defeat a time-based match and let the duplicate through.
        const isOwnEcho = message.playerId === this.client.sessionToken && message.id !== '' && !message.id.startsWith('local-');
        if (isOwnEcho) {
            const idx = this.messages.findIndex((m) => m.id.startsWith('local-') && m.text === message.text);
            if (idx >= 0) {
                this.messages = [...this.messages.slice(0, idx), message, ...this.messages.slice(idx + 1)];
                this.renderMessages();
                return;
            }
        }
        const overflow = this.messages.length >= MAX_LOCAL_MESSAGES;
        this.messages = [...this.messages, message].slice(-MAX_LOCAL_MESSAGES);
        if (this.panel.hidden && message.playerId !== this.client.sessionToken) {
            this.unreadCount = Math.min(this.unreadCount + 1, 9);
        }
        // Incremental append — avoids rebuilding all DOM nodes for each new message.
        // Fall back to a full rebuild only when the list had to discard the oldest entry.
        if (overflow) {
            this.renderMessages();
        } else {
            this.list.querySelector('.online-chat__empty')?.remove();
            this.list.appendChild(this.buildMessageElement(message));
            this.scrollToLatest();
        }
        this.updateToggleLabel();
    }

    private buildMessageElement(message: ChatEntry): HTMLElement {
        const item = document.createElement('div');
        item.className = 'online-chat__message';
        if (message.playerId === this.client.sessionToken) {
            item.classList.add('online-chat__message--self');
        }
        const name = document.createElement('span');
        name.className = 'online-chat__name';
        name.textContent = message.playerId === this.client.sessionToken ? TextResources.get('online.chat.you', 'Você') : message.playerName;
        const text = document.createElement('span');
        text.className = 'online-chat__text';
        text.textContent = message.text;
        item.append(name, text);
        return item;
    }

    private renderMessages(): void {
        this.list.innerHTML = '';
        if (this.messages.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'online-chat__empty';
            empty.textContent = TextResources.get('online.chat.empty', 'Nenhuma mensagem ainda.');
            this.list.appendChild(empty);
            return;
        }
        for (const message of this.messages) {
            this.list.appendChild(this.buildMessageElement(message));
        }
        this.scrollToLatest();
    }

    private updateToggleLabel(): void {
        this.toggleButton.textContent = this.unreadCount > 0
            ? TextResources.format('online.chat.toggleUnread', { count: this.unreadCount }, `Chat ${this.unreadCount}`)
            : TextResources.get('online.chat.label', 'Chat');
    }

    private scrollToLatest(): void {
        requestAnimationFrame(() => {
            this.list.scrollTop = this.list.scrollHeight;
        });
    }
}
