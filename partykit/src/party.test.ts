import { describe, expect, it, vi } from 'vitest';
import GameParty from './party';

type PlayerListMessage = {
    type: string;
    players?: Array<{
        armorEquipped?: boolean;
        armorDurability?: number;
    }>;
};

function connection(id: string) {
    return {
        id,
        send: vi.fn(),
        close: vi.fn(),
    };
}

describe('PartyKit player runtime state', () => {
    it('retains armor durability and includes it in player lists', () => {
        const player = connection('player-1');
        const observer = connection('observer');
        const party = {
            broadcast: vi.fn(),
            getConnections: vi.fn(() => [player, observer]),
        };
        const server = new GameParty(party as never);

        server.onMessage(JSON.stringify({
            type: 'player-join',
            name: 'Hero',
            sessionToken: 'token-1',
        }), player as never);
        server.onMessage(JSON.stringify({
            type: 'player-position',
            playerId: 'token-1',
            roomIndex: 0,
            x: 1,
            y: 2,
            armorEquipped: true,
            armorDurability: 3,
        }), player as never);

        server.onConnect(observer as never);

        const messages = observer.send.mock.calls.map(([raw]) => JSON.parse(raw as string) as PlayerListMessage);
        const playerList = messages.find((message) => message.type === 'player-list');
        expect(playerList?.players?.[0]).toMatchObject({
            armorEquipped: true,
            armorDurability: 3,
        });
    });
});
