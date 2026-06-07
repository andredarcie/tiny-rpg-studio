
import type { GameDefinition, RuntimeState, VariableDefinition } from '../../../types/gameState';
import { TextResources } from '../../adapters/TextResources';
import { ITEM_TYPES } from '../constants/itemTypes';
import type { ObjectEntry } from './StateObjectManager';

const LOGIC_GATE_ITERATION_LIMIT = 20;

const getVariableText = (key: string, fallback = ''): string => {
    const value = TextResources.get(key, fallback) as string;
    return value || fallback || key || '';
};

type VariablePreset = {
    id: string;
    order: number;
    nameKey: string;
    fallbackName: string;
    color: string;
};

type StateVariableEntry = VariableDefinition & {
    order: number;
    name: string;
    color: string;
};

type VariableSource = Partial<StateVariableEntry> & {
    value?: unknown;
};

const createVariablePreset = (
    id: string,
    order: number,
    nameKey: string,
    fallbackName: string,
    color: string
) => Object.freeze({ id, order, nameKey, fallbackName, color });

const STATE_VARIABLE_PRESETS: ReadonlyArray<VariablePreset> = Object.freeze([
    createVariablePreset('var-1', 1, 'variables.names.var1', '', '#000000'),
    createVariablePreset('var-2', 2, 'variables.names.var2', '', '#1D2B53'),
    createVariablePreset('var-3', 3, 'variables.names.var3', '', '#7E2553'),
    createVariablePreset('var-4', 4, 'variables.names.var4', '', '#008751'),
    createVariablePreset('var-5', 5, 'variables.names.var5', '', '#AB5236'),
    createVariablePreset('var-6', 6, 'variables.names.var6', '', '#5F574F'),
    createVariablePreset('var-7', 7, 'variables.names.var7', '', '#29ADFF'),
    createVariablePreset('var-8', 8, 'variables.names.var8', '', '#FF77A8'),
    createVariablePreset('var-9', 9, 'variables.names.var9', '', '#FFFF27'),
    createVariablePreset('var-10', 10, 'variables.names.var10', '', '#C2C3C7'),
    createVariablePreset('var-11', 11, 'variables.names.var11', '', '#FFF1E8'),
    createVariablePreset('var-12', 12, 'variables.names.var12', '', '#FF004D'),
    createVariablePreset('var-13', 13, 'variables.names.var13', '', '#FFA300'),
    createVariablePreset('var-14', 14, 'variables.names.var14', '', '#00E756'),
    createVariablePreset('var-15', 15, 'variables.names.var15', '', '#83769C'),
    createVariablePreset('var-16', 16, 'variables.names.var16', '', '#FFCCAA')
]);

class StateVariableManager {
    private game: GameDefinition | null;
    private state: RuntimeState | null;
    private readonly presets: ReadonlyArray<VariablePreset>;

    constructor(
        game: GameDefinition | null = null,
        state: RuntimeState | null = null,
        presets: ReadonlyArray<VariablePreset> = STATE_VARIABLE_PRESETS
    ) {
        this.game = game;
        this.state = state;
        this.presets = presets;
    }

    setGame(game: GameDefinition | null): void {
        this.game = game;
    }

    setState(state: RuntimeState | null): void {
        this.state = state;
    }

    ensureDefaultVariables(): StateVariableEntry[] {
        if (!this.game) return [];
        this.game.variables = this.normalizeVariables(this.game.variables);
        return this.game.variables as StateVariableEntry[];
    }

    resetRuntime(): StateVariableEntry[] {
        if (!this.state) return [];
        this.state.variables = this.cloneVariables(this.game?.variables);
        return this.state.variables as StateVariableEntry[];
    }

    cloneVariables(list: StateVariableEntry[] | VariableDefinition[] | null | undefined): StateVariableEntry[] {
        const normalized = Array.isArray(list) &&
            list.every((entry) => Boolean((entry as StateVariableEntry).order) && Boolean((entry as StateVariableEntry).name))
            ? (list as StateVariableEntry[])
            : this.normalizeVariables(list);
        return normalized.map((entry) => ({
            id: entry.id,
            order: entry.order,
            name: entry.name,
            color: entry.color,
            value: Boolean(entry.value)
        }));
    }

    normalizeVariables(source: unknown): StateVariableEntry[] {
        const incoming = Array.isArray(source) ? source : [];
        const byId = new Map<string | undefined, VariableSource>();
        for (const entry of incoming) {
            const variable = entry as VariableSource;
            byId.set(variable.id, variable);
        }
        return this.presets.map((preset) => {
            const current = byId.get(preset.id) || {};
            return {
                id: preset.id,
                order: preset.order,
                name: typeof current.name === 'string' && current.name.trim()
                    ? current.name.trim()
                    : this.getPresetDefaultName(preset),
                color: typeof current.color === 'string' && current.color.trim() ? current.color.trim() : preset.color,
                value: Boolean(current.value)
            };
        });
    }

    getVariableDefinitions(): StateVariableEntry[] {
        return (this.game?.variables ?? []) as StateVariableEntry[];
    }

    getVariables(): StateVariableEntry[] {
        return (this.state?.variables ?? []) as StateVariableEntry[];
    }

    normalizeVariableId(variableId: string | number | null | undefined): string | null {
        if (typeof variableId !== 'string') return null;
        // Allow special skill-based conditions (e.g., bard dialogue)
        const allowedSpecials = new Set(['skill:bard']);
        if (allowedSpecials.has(variableId)) return variableId;
        return this.getVariableDefinitions().some((variable) => variable.id === variableId) ? variableId : null;
    }

    getVariable(variableId: string | number | null | undefined): StateVariableEntry | null {
        if (!variableId) return null;
        return this.getVariables().find((variable) => variable.id === variableId) || null;
    }

    isVariableOn(variableId: string | number | null | undefined): boolean {
        const entry = this.getVariable(variableId);
        return entry ? Boolean(entry.value) : false;
    }

    /**
     * Updates a variable's value. Always updates the RUNTIME state.
     *
     * When `persist` is true the AUTHORED definition (`game.variables`) is updated
     * too. The definition is the editor's source of truth and the baseline that
     * `resetRuntime()` clones at the start of every playthrough, so persisting
     * makes a value the new default that survives `resetGame()`. This is meant for
     * authoring operations (e.g. the SDK's `setVariableDefault`), NOT for gameplay:
     * persisting a gameplay result would permanently mutate the author's variable.
     */
    setVariableValue(variableId: string | number, value: unknown, persist = false): boolean {
        let updated = false;
        const nextValue = Boolean(value);
        this.getVariables().forEach((variable) => {
            if (variable.id === variableId && variable.value !== nextValue) {
                variable.value = nextValue;
                updated = true;
            }
        });
        if (persist) {
            this.getVariableDefinitions().forEach((variable) => {
                if (variable.id === variableId && variable.value !== nextValue) {
                    variable.value = nextValue;
                    updated = true;
                }
            });
        }
        return updated;
    }

    /**
     * Evaluates all logic gates and writes their results to the output variables.
     * Uses the INTERNAL setVariableValue() (returning boolean) to avoid recursion
     * through the GameState hook. Iterates to support chained gates, with a cap to
     * protect against cycles. Returns the list of [variableId, value] pairs changed.
     */
    evaluateLogicGates(objects: ObjectEntry[]): Array<[string, boolean]> {
        const allChanges: Array<[string, boolean]> = [];
        if (!Array.isArray(objects) || !objects.length) return allChanges;
        const gates = objects.filter((obj) => obj.isLogicGate);
        if (!gates.length) return allChanges;

        let changed = true;
        let iterations = 0;
        while (changed && iterations < LOGIC_GATE_ITERATION_LIMIT) {
            changed = false;
            iterations++;
            for (const gate of gates) {
                const outputId = gate.outputVariableId;
                if (!outputId) continue;
                const a = this.isVariableOn(gate.inputVariableId);
                const b = this.isVariableOn(gate.inputVariableId2);
                const result = StateVariableManager.computeGate(gate.type, a, b);
                if (result === this.isVariableOn(outputId)) continue;
                if (this.setVariableValue(outputId, result)) {
                    allChanges.push([outputId, result]);
                    changed = true;
                }
            }
        }

        if (iterations >= LOGIC_GATE_ITERATION_LIMIT) {
            console.warn('[LogicGate] Iteration limit reached — possible cycle');
        }
        return allChanges;
    }

    static computeGate(type: string, a: boolean, b: boolean): boolean {
        switch (type) {
            case ITEM_TYPES.LOGIC_GATE_NOT: return !a;
            case ITEM_TYPES.LOGIC_GATE_AND: return a && b;
            case ITEM_TYPES.LOGIC_GATE_OR: return a || b;
            case ITEM_TYPES.LOGIC_GATE_NAND: return !(a && b);
            case ITEM_TYPES.LOGIC_GATE_NOR: return !(a || b);
            default: return false;
        }
    }

    getFirstVariableId(): string | null {
        const definitions = this.getVariableDefinitions();
        if (definitions.length) {
            return definitions[0].id;
        }
        return this.presets[0]?.id ?? null;
    }

    getPresetDefaultName(preset?: VariablePreset | null): string {
        if (!preset) return '';
        const fallback = preset.fallbackName || '';
        if (preset.nameKey) {
            return getVariableText(preset.nameKey, fallback);
        }
        return fallback;
    }

    getPresetTranslationSet(preset?: VariablePreset | null): Set<string> {
        const names = new Set<string>();
        if (!preset) return names;
        const maybeAdd = (value?: string) => {
            if (typeof value === 'string' && value.trim()) {
                names.add(value.trim());
            }
        };
        maybeAdd(preset.fallbackName);
        const bundles = TextResources.bundles;
        if (preset.nameKey) {
            Object.values(bundles).forEach((bundle) => {
                if (!bundle) return;
                const translation = bundle[preset.nameKey];
                maybeAdd(translation);
            });
        }
        maybeAdd(this.getPresetDefaultName(preset));
        return names;
    }

    refreshPresetNames(): void {
        const presetsById = new Map(this.presets.map((preset) => [preset.id, preset]));
        const apply = (list: StateVariableEntry[] | null | undefined) => {
            if (!Array.isArray(list)) return;
            list.forEach((variable) => {
                const preset = presetsById.get(variable.id);
                if (!preset) return;
                const defaults = this.getPresetTranslationSet(preset);
                if (!variable.name || defaults.has(variable.name)) {
                    const next = this.getPresetDefaultName(preset);
                    if (variable.name !== next) {
                        variable.name = next;
                    }
                }
            });
        };
        apply(this.game?.variables as StateVariableEntry[]);
        apply(this.state?.variables as StateVariableEntry[]);
    }

    static get PRESETS(): ReadonlyArray<VariablePreset> {
        return STATE_VARIABLE_PRESETS;
    }
}

export { StateVariableManager };
