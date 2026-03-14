import type { LevelUpChoice, LevelUpOverlayState, RuntimeState } from '../../../types/gameState';
declare class StateSkillManager {
    state: RuntimeState | null;
    constructor(state: RuntimeState | null);
    setState(state: RuntimeState | null): void;
    ensureRuntime(): import("../../../types/gameState").SkillRuntimeState;
    ensureOverlay(): LevelUpOverlayState;
    resetRuntime(): void;
    resetOverlay(): void;
    getOwnedSkills(): string[];
    hasSkill(skillId: string): boolean;
    addSkill(skillId: string): import("../entities/Skill").Skill | null;
    applyImmediateEffects(definition: {
        id: string;
    }): void;
    getBonusMaxLives(): number;
    addBonusMaxLife(amount?: number): number;
    getXpBoost(): number;
    queueLevelUps(count?: number, latestLevel?: number | null): number;
    getPendingSelections(): number;
    hasPendingSelections(): boolean;
    startLevelSelection(): LevelUpOverlayState | null;
    pickChoices(count?: number, levelOverride?: number | null): import("../entities/Skill").Skill[];
    moveCursor(delta?: number): number;
    completeSelection(index?: number | null): LevelUpChoice | null;
    isOverlayActive(): boolean;
    getOverlay(): LevelUpOverlayState;
    attemptRevive(player?: unknown | null): boolean;
    consumeRecentReviveFlag(): boolean;
    hasPendingManualRevive(): boolean;
    consumeManualRevive(): boolean;
    clearManualReviveFlag(): void;
}
export { StateSkillManager };
