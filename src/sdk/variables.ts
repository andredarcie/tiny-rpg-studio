
/**
 * Variable system for the SDK.
 *
 * The share format addresses up to 16 boolean variables (`var-1` .. `var-16`).
 * Switches, logic gates, variable-doors, LEDs, traps and pressure-plates all
 * reference these by id. The SDK exposes them as {@link VariableRef} handles so
 * authors never have to type raw `var-N` strings.
 */

export const MAX_VARIABLES = 16;
export const MAX_VARIABLES_PLUS = 32;

export type VariableRef = {
    /** The encoded variable id, e.g. `'var-1'`. */
    readonly id: string;
    /** 1-based slot index (1..16, or 1..32 with Variables+). */
    readonly index: number;
    /** Optional human-readable label (authoring aid only — not encoded). */
    readonly name?: string;
};

/** Builds the canonical `var-N` id for a 1-based slot index. */
export function variableId(index: number, max = MAX_VARIABLES): string {
    if (!Number.isInteger(index) || index < 1 || index > max) {
        throw new Error(`variable index must be an integer in [1, ${max}], got ${index}`);
    }
    return `var-${index}`;
}

/**
 * Normalizes any accepted variable reference to its encoded id.
 * Accepts a {@link VariableRef} or a 1-based slot index up to the enabled limit.
 */
export function resolveVariableId(ref: VariableRef | number, max = MAX_VARIABLES): string {
    if (typeof ref === 'number') {
        return variableId(ref, max);
    }
    const id = (ref as { id?: unknown }).id;
    if (typeof id === 'string' && /^var-\d+$/.test(id) && Number(id.slice(4)) <= max && Number(id.slice(4)) >= 1) {
        return id;
    }
    throw new Error(`Expected a VariableRef or a variable index (1..${max})`);
}
