export function normalizeNpcWanderSpeed(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(2, value))
        : 1;
}

const wanderFacing = new WeakMap<object, -1 | 1>();

export function getNpcWanderFacing(npc: object): -1 | 1 {
    return wanderFacing.get(npc) ?? 1;
}

export function updateNpcWanderFacing(npc: object, dx: number): void {
    if (dx !== 0) wanderFacing.set(npc, dx < 0 ? -1 : 1);
}

export function resetNpcWanderFacing(npc: object): void {
    wanderFacing.delete(npc);
}
