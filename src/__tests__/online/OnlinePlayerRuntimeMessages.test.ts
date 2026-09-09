import { describe, expect, it, vi } from 'vitest';
import { OnlineInputRelay } from '../../online/client/OnlineInputRelay';
import { OnlinePositionSender } from '../../online/client/OnlinePositionSender';
import type { OnlineMessage } from '../../online/shared/protocol';

describe('online player runtime messages', () => {
    it('sends guest attack damage with player-input attack messages', () => {
        const send = vi.fn();
        const relay = new OnlineInputRelay({ sessionToken: 'guest-token', send } as never);

        relay.sendAttack('enemy-1', 4);

        expect(send).toHaveBeenCalledWith({
            type: 'player-input',
            playerId: 'guest-token',
            action: 'attack',
            enemyId: 'enemy-1',
            damage: 4,
        });
    });

    it('includes gameplay-affecting player runtime in position messages', () => {
        const sent: OnlineMessage[] = [];
        const sender = new OnlinePositionSender(
            { sessionToken: 'player-token', send: (msg: OnlineMessage) => sent.push(msg) } as never,
            {
                getPlayer: () => ({
                    x: 2,
                    y: 3,
                    roomIndex: 1,
                    lastX: 1,
                    currentLives: 4,
                    maxLives: 5,
                    level: 3,
                    keys: 2,
                    swordType: 'sword-bronze',
                    swordDurability: 2,
                    armorEquipped: true,
                    armorDurability: 4,
                    bootsEquipped: false,
                }),
                getOwnedSkills: () => ['keyless-doors', 'water-walker'],
            },
        );

        sender.sendNow(true);

        expect(sent[0]).toMatchObject({
            type: 'player-position',
            playerId: 'player-token',
            roomIndex: 1,
            x: 2,
            y: 3,
            hp: 4,
            maxHp: 5,
            level: 3,
            keys: 2,
            swordType: 'sword-bronze',
            swordDurability: 2,
            armorEquipped: true,
            armorDurability: 4,
            bootsEquipped: false,
            skills: ['keyless-doors', 'water-walker'],
        });
    });
});
