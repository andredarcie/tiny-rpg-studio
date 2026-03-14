import type { GameDefinition, RuntimeState, VariableDefinition } from '../../../types/gameState';
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
declare class StateVariableManager {
    private game;
    private state;
    private readonly presets;
    constructor(game?: GameDefinition | null, state?: RuntimeState | null, presets?: ReadonlyArray<VariablePreset>);
    setGame(game: GameDefinition | null): void;
    setState(state: RuntimeState | null): void;
    ensureDefaultVariables(): StateVariableEntry[];
    resetRuntime(): StateVariableEntry[];
    cloneVariables(list: StateVariableEntry[] | VariableDefinition[] | null | undefined): StateVariableEntry[];
    normalizeVariables(source: unknown): StateVariableEntry[];
    getVariableDefinitions(): StateVariableEntry[];
    getVariables(): StateVariableEntry[];
    normalizeVariableId(variableId: string | number | null | undefined): string | null;
    getVariable(variableId: string | number | null | undefined): StateVariableEntry | null;
    isVariableOn(variableId: string | number | null | undefined): boolean;
    setVariableValue(variableId: string | number, value: unknown, persist?: boolean): boolean;
    getFirstVariableId(): string | null;
    getPresetDefaultName(preset?: VariablePreset | null): string;
    getPresetTranslationSet(preset?: VariablePreset | null): Set<string>;
    refreshPresetNames(): void;
    static get PRESETS(): ReadonlyArray<VariablePreset>;
}
export { StateVariableManager };
