
import { SkillDefinitions } from '../definitions/SkillDefinitions';
import type { LevelUpChoice, LevelUpOverlayState, RuntimeState } from '../../../types/gameState';

type PlayerLevelState = { level?: number };

class StateSkillManager {
    state: RuntimeState | null;

    constructor(state: RuntimeState | null) {
        this.state = state;
        this.resetRuntime();
    }

    setState(state: RuntimeState | null) {
        this.state = state;
        this.ensureRuntime();
        this.ensureOverlay();
    }

    ensureRuntime() {
        if (!this.state) {
            return {
                owned: [],
                bonusMaxLives: 0,
                xpBoost: 0,
                pendingSelections: 0,
                necromancerCharges: 0,
                pendingManualRevive: false,
                recentRevive: false,
                carryoverSkills: [],
                currentChoicePool: [],
                pendingLevelQueue: []
            };
        }
        if (!this.state.skillRuntime) {
            this.state.skillRuntime = {
                owned: [],
                bonusMaxLives: 0,
                xpBoost: 0,
                pendingSelections: 0,
                necromancerCharges: 0,
                pendingManualRevive: false,
                recentRevive: false,
                carryoverSkills: [],
                currentChoicePool: [],
                pendingLevelQueue: []
            };
        }
        const runtime = this.state.skillRuntime;
        runtime.owned = Array.isArray(runtime.owned)
            ? Array.from(new Set(runtime.owned.filter((id: unknown) => typeof id === 'string' && id))) as string[]
            : [];
        runtime.bonusMaxLives = Number.isFinite(runtime.bonusMaxLives)
            ? Math.max(0, Math.floor(runtime.bonusMaxLives))
            : 0;
        runtime.xpBoost = Number.isFinite(runtime.xpBoost) ? Math.max(0, runtime.xpBoost) : 0;
        runtime.pendingSelections = Number.isFinite(runtime.pendingSelections)
            ? Math.max(0, Math.floor(runtime.pendingSelections))
            : 0;
        runtime.necromancerCharges = Number.isFinite(runtime.necromancerCharges)
            ? Math.max(0, Math.floor(runtime.necromancerCharges))
            : 0;
        runtime.pendingManualRevive = Boolean(runtime.pendingManualRevive);
        runtime.recentRevive = Boolean(runtime.recentRevive);
        runtime.carryoverSkills = Array.isArray(runtime.carryoverSkills)
            ? Array.from(new Set(runtime.carryoverSkills.filter((id: unknown) => typeof id === 'string' && id))) as string[]
            : [];
        runtime.currentChoicePool = Array.isArray(runtime.currentChoicePool)
            ? Array.from(new Set(runtime.currentChoicePool.filter((id: unknown) => typeof id === 'string' && id))) as string[]
            : [];
        runtime.pendingLevelQueue = Array.isArray(runtime.pendingLevelQueue)
            ? runtime.pendingLevelQueue
                  .map((lvl: unknown) => (typeof lvl === 'number' && Number.isFinite(lvl) ? Math.max(1, Math.floor(lvl)) : null))
                  .filter((lvl: number | null): lvl is number => lvl !== null)
            : [];
        runtime.pendingSelections = runtime.pendingLevelQueue.length;
        return runtime;
    }

    ensureOverlay() {
        if (!this.state) {
            return { active: false, choices: [], cursor: 0 };
        }
        const runtimeState = this.state as RuntimeState & { levelUpOverlay?: LevelUpOverlayState };
        let overlay = runtimeState.levelUpOverlay as LevelUpOverlayState | undefined;
        if (!overlay) {
            overlay = {
                active: false,
                choices: [],
                cursor: 0
            };
            runtimeState.levelUpOverlay = overlay;
        }
        overlay.active = Boolean(overlay.active);
        overlay.choices = Array.isArray(overlay.choices) ? overlay.choices : [];
        overlay.cursor = Number.isFinite(overlay.cursor) ? Math.max(0, Math.floor(overlay.cursor)) : 0;
        return overlay;
    }

    resetRuntime() {
        const runtime = this.ensureRuntime();
        runtime.owned = [];
        runtime.bonusMaxLives = 0;
        runtime.xpBoost = 0;
        runtime.pendingSelections = 0;
        runtime.necromancerCharges = 0;
        runtime.pendingManualRevive = false;
        runtime.recentRevive = false;
        runtime.carryoverSkills = [];
        runtime.currentChoicePool = [];
        runtime.pendingLevelQueue = [];
        this.resetOverlay();
    }

    resetOverlay() {
        const overlay = this.ensureOverlay();
        overlay.active = false;
        overlay.choices = [];
        overlay.cursor = 0;
    }

    getOwnedSkills() {
        return this.ensureRuntime().owned.slice();
    }

    hasSkill(skillId: string) {
        if (!skillId) return false;
        const runtime = this.ensureRuntime();
        return runtime.owned.includes(skillId);
    }

    addSkill(skillId: string) {
        const runtime = this.ensureRuntime();
        const definition = SkillDefinitions.getById(skillId);
        if (!definition) return null;

        if (!runtime.owned.includes(skillId)) {
            runtime.owned.push(skillId);
            this.applyImmediateEffects(definition);
        }
        return definition;
    }

    applyImmediateEffects(definition: { id: string }) {
        const runtime = this.ensureRuntime();
        switch (definition.id) {
            case 'xp-boost':
                runtime.xpBoost = 0.5;
                break;
            case 'necromancer':
                // Only one revive for the whole game.
                runtime.necromancerCharges = Math.min(1, (runtime.necromancerCharges || 0) + 1);
                break;
            default:
                break;
        }
    }

    getBonusMaxLives() {
        const runtime = this.ensureRuntime();
        return Math.max(0, runtime.bonusMaxLives || 0);
    }

    addBonusMaxLife(amount: number = 1) {
        const runtime = this.ensureRuntime();
        const numeric = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
        if (numeric <= 0) return runtime.bonusMaxLives;
        runtime.bonusMaxLives = Math.max(0, (runtime.bonusMaxLives || 0) + numeric);
        return runtime.bonusMaxLives;
    }

    getXpBoost() {
        const runtime = this.ensureRuntime();
        return Math.max(0, Number(runtime.xpBoost) || 0);
    }

    queueLevelUps(count: number = 1, latestLevel: number | null = null) {
        const runtime = this.ensureRuntime();
        const numeric = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
        if (numeric <= 0) {
            runtime.pendingSelections = runtime.pendingLevelQueue.length;
            return runtime.pendingSelections;
        }

        const baseLevel = typeof (this.state?.player as PlayerLevelState | undefined)?.level === 'number'
            ? Math.max(1, Math.floor((this.state?.player as PlayerLevelState).level ?? 1))
            : 1;
        const finalLevel = typeof latestLevel === 'number' && Number.isFinite(latestLevel)
            ? Math.max(1, Math.floor(latestLevel))
            : null;
        const levelsCrossed: number[] = [];

        if (finalLevel !== null) {
            const start = Math.max(1, finalLevel - numeric + 1);
            for (let lvl = start; lvl <= finalLevel; lvl++) {
                levelsCrossed.push(lvl);
            }
        } else {
            for (let i = 0; i < numeric; i++) {
                levelsCrossed.push(baseLevel + i);
            }
        }

        levelsCrossed.forEach((lvl) => {
            if (lvl % 2 === 0) {
                runtime.pendingLevelQueue.push(lvl);
            }
        });
        runtime.pendingSelections = runtime.pendingLevelQueue.length;
        return runtime.pendingSelections;
    }

    getPendingSelections() {
        const runtime = this.ensureRuntime();
        runtime.pendingSelections = runtime.pendingLevelQueue.length;
        return runtime.pendingSelections;
    }

    hasPendingSelections() {
        return this.getPendingSelections() > 0;
    }

    startLevelSelection() {
        if (!this.hasPendingSelections()) return null;
        const overlay = this.ensureOverlay();
        if (overlay.active) return overlay;

        const runtime = this.ensureRuntime();
        const safetyCap = Math.max(1, runtime.pendingLevelQueue.length || 1);
        for (let i = 0; i < safetyCap; i++) {
            const queuedLevel = runtime.pendingLevelQueue.shift();
            const fallbackLevel = typeof (this.state?.player as PlayerLevelState | undefined)?.level === 'number'
                ? Math.max(1, Math.floor((this.state?.player as PlayerLevelState).level ?? 1))
                : 1;
            const levelForChoice = typeof queuedLevel === 'number' ? queuedLevel : fallbackLevel;
            const choices = this.pickChoices(2, levelForChoice);
            if (choices.length) {
                overlay.active = true;
                overlay.choices = choices.map((choice) => ({
                    id: choice.id,
                    nameKey: choice.nameKey,
                    descriptionKey: choice.descriptionKey,
                    icon: choice.icon
                }));
                overlay.cursor = 0;
                runtime.pendingSelections = runtime.pendingLevelQueue.length;
                return overlay;
            }
            // No choices for this level; discard and try next pending level.
        }

        runtime.pendingSelections = runtime.pendingLevelQueue.length;
        runtime.carryoverSkills = [];
        runtime.currentChoicePool = [];
        return null;
    }

    pickChoices(count = 2, levelOverride: number | null = null) {
        const runtime = this.ensureRuntime();
        const playerLevel = typeof levelOverride === 'number' && Number.isFinite(levelOverride)
            ? Math.max(1, Math.floor(levelOverride))
            : typeof (this.state?.player as PlayerLevelState | undefined)?.level === 'number'
            ? Math.max(1, Math.floor((this.state?.player as PlayerLevelState).level ?? 1))
            : 1;
        const queue = SkillDefinitions.buildQueueForLevel(playerLevel, runtime.carryoverSkills, runtime.owned);
        runtime.currentChoicePool = queue;
        if (!queue.length) {
            runtime.carryoverSkills = [];
            return [];
        }
        const choiceCount = Math.max(1, Math.min(count, queue.length));
        const choices = queue
            .slice(0, choiceCount)
            .map((id: string) => SkillDefinitions.getById(id))
            .filter((skill): skill is NonNullable<ReturnType<typeof SkillDefinitions.getById>> => skill !== null);
        return choices;
    }

    moveCursor(delta: number = 0) {
        const overlay = this.ensureOverlay();
        if (!overlay.active) return overlay.cursor;
        const choiceCount = overlay.choices.length;
        if (choiceCount <= 1) {
            overlay.cursor = 0;
            return overlay.cursor;
        }
        const numeric = Number.isFinite(delta) ? Math.floor(delta) : 0;
        const next = (overlay.cursor + numeric + choiceCount) % choiceCount;
        overlay.cursor = next;
        return overlay.cursor;
    }

    completeSelection(index: number | null = null) {
        const overlay = this.ensureOverlay();
        if (!overlay.active) return null;
        const effectiveIndex = typeof index === 'number' && Number.isFinite(index)
            ? Math.max(0, Math.min(overlay.choices.length - 1, Math.floor(index)))
            : overlay.cursor;
        const choice = (overlay.choices as (LevelUpChoice | null | undefined)[])[effectiveIndex] ?? null;

        overlay.active = false;
        overlay.choices = [];
        overlay.cursor = 0;

        if (choice) {
            this.addSkill(choice.id);
        }
        const runtime = this.ensureRuntime();
        const chosenId = choice ? choice.id : null;
        const pool = Array.isArray(runtime.currentChoicePool) ? runtime.currentChoicePool : [];
        runtime.carryoverSkills = pool.filter((id: string) => id && id !== chosenId && !runtime.owned.includes(id));
        runtime.currentChoicePool = [];
        runtime.pendingSelections = runtime.pendingLevelQueue.length;
        return choice;
    }

    isOverlayActive() {
        return Boolean(this.ensureOverlay().active);
    }

    getOverlay() {
        return this.ensureOverlay();
    }

    attemptRevive(player: unknown | null = null) {
        if (!player || !this.hasSkill('necromancer')) return false;
        const runtime = this.ensureRuntime();
        if (runtime.necromancerCharges <= 0) return false;
        runtime.pendingManualRevive = true;
        runtime.recentRevive = false;
        return false;
    }

    consumeRecentReviveFlag() {
        const runtime = this.ensureRuntime();
        runtime.recentRevive = false;
        return false;
    }

    hasPendingManualRevive() {
        const runtime = this.ensureRuntime();
        return this.hasSkill('necromancer') && runtime.necromancerCharges > 0 && runtime.pendingManualRevive;
    }

    consumeManualRevive() {
        const runtime = this.ensureRuntime();
        if (!this.hasPendingManualRevive()) {
            return false;
        }
        runtime.necromancerCharges = Math.max(0, runtime.necromancerCharges - 1);
        runtime.pendingManualRevive = false;
        runtime.recentRevive = false;
        return true;
    }

    clearManualReviveFlag() {
        const runtime = this.ensureRuntime();
        runtime.pendingManualRevive = false;
    }
}

export { StateSkillManager };
