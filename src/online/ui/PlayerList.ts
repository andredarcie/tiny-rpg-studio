import { TextResources } from '../../runtime/adapters/TextResources';
import type { PlayerInfo } from '../shared/protocol';

export class PlayerList {
    private container: HTMLElement;
    private belowCanvas: HTMLElement;

    constructor(belowCanvas: HTMLElement) {
        this.belowCanvas = belowCanvas;
        this.container = document.createElement('div');
        Object.assign(this.container.style, {
            fontFamily: 'var(--ui-font-family, monospace)',
            background: 'var(--panel, #151821)',
            borderTop: '4px solid var(--border, #232734)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0',
            width: '100%',
        });
        this.belowCanvas.appendChild(this.container);
    }

    update(players: PlayerInfo[], selfSessionToken: string): void {
        this.container.innerHTML = '';
        for (const p of players) {
            this.container.appendChild(this.buildEntry(p, p.sessionToken === selfSessionToken));
        }
    }

    private buildEntry(p: PlayerInfo, isSelf: boolean): HTMLElement {
        const el = document.createElement('div');
        Object.assign(el.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRight: '1px solid var(--border, #232734)',
            flex: '1 1 auto',
            minWidth: '0',
        });

        const dotEl = document.createElement('span');
        dotEl.textContent = '●';
        dotEl.style.color = p.alive ? 'var(--accent, #5bfa8e)' : '#ff4040';
        dotEl.style.flexShrink = '0';

        const nameEl = document.createElement('span');
        nameEl.textContent = isSelf ? TextResources.format('online.youSuffix', { name: p.name }, `${p.name} (Você)`) : p.name;
        nameEl.style.color = isSelf ? 'var(--accent, #5bfa8e)' : 'var(--text, #fff)';
        nameEl.style.fontWeight = isSelf ? 'bold' : 'normal';
        nameEl.style.overflow = 'hidden';
        nameEl.style.textOverflow = 'ellipsis';
        nameEl.style.whiteSpace = 'nowrap';

        el.append(dotEl, nameEl);

        if (p.alive) {
            const hp = Math.max(0, Math.min(p.hp, 5));
            if (hp > 0) {
                const hpEl = document.createElement('span');
                hpEl.textContent = '♥'.repeat(hp);
                hpEl.style.color = '#ff4040';
                hpEl.style.flexShrink = '0';
                el.appendChild(hpEl);
            }
        } else {
            const deadEl = document.createElement('span');
            deadEl.textContent = TextResources.get('online.playerList.dead', '✕ morto');
            deadEl.style.color = 'rgba(255,64,64,0.6)';
            deadEl.style.flexShrink = '0';
            el.appendChild(deadEl);
        }

        const roomNum = parseInt(p.room, 10);
        if (Number.isFinite(roomNum)) {
            const roomEl = document.createElement('span');
            roomEl.textContent = `S${roomNum + 1}`;
            roomEl.style.color = 'rgba(255,255,255,0.3)';
            roomEl.style.marginLeft = 'auto';
            roomEl.style.flexShrink = '0';
            el.appendChild(roomEl);
        }

        return el;
    }

    destroy(): void {
        this.container.remove();
    }
}
