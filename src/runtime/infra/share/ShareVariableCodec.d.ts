type VariableInput = {
    id?: string;
    value?: unknown;
};
type VariableEntry = {
    id: string;
    order: number;
    name: string;
    color: string;
    value: boolean;
};
type VariableNibbleInput = number | null | undefined;
declare class ShareVariableCodec {
    static encodeVariables(variables: VariableInput[] | undefined | null): string;
    static decodeVariables(text?: string | null): boolean[];
    static variableIdToNibble(variableId?: string | null): number;
    static nibbleToVariableId(value: number): string | null;
    static encodeVariableNibbleArray(values: VariableNibbleInput[] | undefined | null): string;
    static decodeVariableNibbleArray(text: string | null | undefined, expectedCount: number): number[];
    static buildVariableEntries(states: unknown[] | undefined | null): VariableEntry[];
    static packNibbles(values: number[]): Uint8Array;
    static unpackNibbles(bytes: Uint8Array, expectedCount: number): number[];
    static getFirstVariableId(): string | null;
}
export { ShareVariableCodec };
