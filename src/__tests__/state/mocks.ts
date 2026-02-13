import type { RuntimeState } from '../../types/gameState';

const baseRuntimeState: RuntimeState = {
    player: {
        x: 1,
        y: 1,
        lastX: 1,
        roomIndex: 0,
        level: 1,
        maxLives: 3,
        currentLives: 3,
        lives: 3,
        keys: 0,
        experience: 0,
        damageShield: 0,
        damageShieldMax: 0,
        swordType: null,
        lastDamageReduction: 0,
        godMode: false,
        lastAttackTime: 0,
        stunUntil: 0
    },
    dialog: { active: false, text: '', page: 1, maxPages: 1, meta: null },
    enemies: [],
    variables: [],
    gameOver: false,
    gameOverReason: null,
    pickupOverlay: {
        active: false,
        name: '',
        spriteGroup: null,
        spriteType: null,
        effect: null
    },
    levelUpOverlay: { active: false, choices: [], cursor: 0 },
    levelUpCelebration: {
        active: false,
        level: null,
        startTime: 0,
        timeoutId: null,
        durationMs: 3000
    },
    skillRuntime: null
};

const deepClone = <T>(value: T): T => {
    const cloned = JSON.parse(JSON.stringify(value)) as T;
    return cloned;
};

export const createRuntimeStateMock = (): RuntimeState => deepClone(baseRuntimeState);
