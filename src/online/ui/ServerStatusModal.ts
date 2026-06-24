import { TextResources } from '../../runtime/adapters/TextResources';
import type { OnlineRole, PlayerInfo } from '../shared/protocol';

type ServerStatus = 'connecting' | 'connected' | 'disconnected';

type ServerStatusModalState = {
    status: ServerStatus;
    partyHost: string;
    roomId: string;
    role: OnlineRole;
    sessionToken: string;
    players: PlayerInfo[];
    pingMs?: number | null;
    onKickPlayer?: (sessionToken: string) => void;
};

const text = (key: string, fallback = ''): string => {
    const value = TextResources.get(key, fallback) as string;
    return value || fallback || key;
};

export class ServerStatusModal {
    private modal: HTMLElement;
    private panel: HTMLElement;
    private content: HTMLElement;
    private state: ServerStatusModalState;

    constructor(initialState: ServerStatusModalState) {
        this.state = initialState;
        this.modal = document.createElement('div');
        this.modal.className = 'server-status-modal';
        this.modal.hidden = true;
        this.modal.setAttribute('role', 'dialog');
        this.modal.setAttribute('aria-modal', 'true');

        this.panel = document.createElement('div');
        this.panel.className = 'server-status-modal__panel';

        const header = document.createElement('div');
        header.className = 'server-status-modal__header';

        const title = document.createElement('h2');
        title.textContent = text('server.modal.title', 'Status do Servidor');

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'server-status-modal__close';
        close.textContent = 'X';
        close.setAttribute('aria-label', text('server.modal.close', 'Fechar'));
        close.addEventListener('click', () => this.hide());

        header.append(title, close);

        this.content = document.createElement('div');
        this.content.className = 'server-status-modal__content';

        this.panel.append(header, this.content);
        this.modal.appendChild(this.panel);
        this.modal.addEventListener('click', (ev) => {
            if (ev.target === this.modal) this.hide();
        });
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' && !this.modal.hidden) this.hide();
        });
        document.body.appendChild(this.modal);
        this.render();
    }

    update(nextState: Partial<ServerStatusModalState>): void {
        this.state = { ...this.state, ...nextState };
        if (!this.modal.hidden) {
            this.render();
        }
    }

    show(): void {
        this.render();
        this.modal.hidden = false;
    }

    hide(): void {
        this.modal.hidden = true;
    }

    destroy(): void {
        this.modal.remove();
    }

    private render(): void {
        this.content.innerHTML = '';
        const statusLabel = text(`server.modal.${this.state.status}`, this.state.status);
        const roleLabel = text(`server.modal.${this.state.role}`, this.state.role);
        const ping = typeof this.state.pingMs === 'number'
            ? `${Math.round(this.state.pingMs)}ms`
            : '--';

        this.content.append(
            this.buildRow(text('server.modal.status', 'Status'), statusLabel),
            this.buildRow(text('server.modal.host', 'Host'), this.state.partyHost),
            this.buildRow(text('server.modal.room', 'Sala'), this.state.roomId),
            this.buildRow(text('server.modal.role', 'Papel'), roleLabel),
            this.buildRow(text('server.modal.session', 'Session'), this.state.sessionToken || text('server.modal.noSession', 'Sem sessão ativa')),
            this.buildRow(text('server.modal.ping', 'Ping'), ping),
            this.buildPlayersSection(),
        );
    }

    private buildRow(label: string, value: string): HTMLElement {
        const row = document.createElement('div');
        row.className = 'server-status-modal__row';

        const key = document.createElement('span');
        key.className = 'server-status-modal__label';
        key.textContent = label;

        const val = document.createElement('span');
        val.className = 'server-status-modal__value';
        val.textContent = value;

        row.append(key, val);
        return row;
    }

    private buildPlayersSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'server-status-modal__players';

        const title = document.createElement('div');
        title.className = 'server-status-modal__players-title';
        title.textContent = `${text('server.modal.players', 'Jogadores')} (${this.state.players.length})`;
        section.appendChild(title);

        if (!this.state.players.length) {
            const empty = document.createElement('div');
            empty.className = 'server-status-modal__empty';
            empty.textContent = text('server.modal.noSession', 'Sem sessão ativa');
            section.appendChild(empty);
            return section;
        }

        const isHost = this.state.role === 'host';
        for (const player of this.state.players) {
            const entry = document.createElement('div');
            entry.className = 'server-status-modal__player';

            const name = document.createElement('span');
            name.textContent = player.name;

            const meta = document.createElement('span');
            const role = text(`server.modal.${player.role}`, player.role);
            meta.textContent = `${role} - S${Number.parseInt(player.room, 10) + 1 || 1}`;
            meta.className = player.alive ? '' : 'is-dead';

            entry.append(name, meta);

            const isSelf = player.sessionToken === this.state.sessionToken;
            if (isHost && !isSelf && player.role === 'guest' && this.state.onKickPlayer) {
                const kickBtn = document.createElement('button');
                kickBtn.type = 'button';
                kickBtn.className = 'server-status-modal__kick';
                kickBtn.textContent = text('server.modal.kick', 'Kick');
                kickBtn.addEventListener('click', () => {
                    this.state.onKickPlayer?.(player.sessionToken);
                    this.hide();
                });
                entry.appendChild(kickBtn);
            }

            section.appendChild(entry);
        }

        return section;
    }
}

export type { ServerStatus, ServerStatusModalState };
