
import { ShareBase64 } from './ShareBase64';
import { ShareConstants } from './ShareConstants';

type VariableInput = { id?: string; value?: unknown };
type VariableEntry = { id: string; order: number; name: string; color: string; value: boolean };
type VariableNibbleInput = number | null | undefined;

class ShareVariableCodec {
    static encodeVariables(variables: VariableInput[] | undefined | null): string {
        if (!Array.isArray(variables) || !variables.length) return '';

        const ids = ShareConstants.VARIABLE_IDS;
        const idToState = new Map<string, boolean>();
        variables.forEach((entry) => {
            if (typeof entry.id === 'string') {
                idToState.set(entry.id, Boolean(entry.value));
            }
        });

        const byteLength = Math.ceil(ids.length / 8);
        const encodedFlags = new Uint8Array(byteLength);
        ids.forEach((id, index) => {
            if (!idToState.get(id)) return;
            const byteIndex = index >> 3; // index / 8
            const bitIndex = index & 7;   // index % 8
            encodedFlags[byteIndex] |= (1 << bitIndex);
        });

        const hasAnyFlag = encodedFlags.some((value) => value !== 0);
        if (!hasAnyFlag) return '';
        return ShareBase64.toBase64Url(encodedFlags);
    }

    static decodeVariables(text?: string | null): boolean[] {
        const ids = ShareConstants.VARIABLE_IDS;
        const states: boolean[] = new Array<boolean>(ids.length).fill(false);
        if (!text) return states;

        const encodedFlags = ShareBase64.fromBase64Url(text);
        ids.forEach((_, index) => {
            const byteIndex = index >> 3;
            const bitIndex = index & 7;
            const byte = encodedFlags[byteIndex] ?? 0;
            states[index] = Boolean(byte & (1 << bitIndex));
        });
        return states;
    }

    static variableIdToNibble(variableId?: string | null): number {
        if (typeof variableId !== 'string') return 0;
        const index = ShareConstants.VARIABLE_IDS.indexOf(variableId);
        return index >= 0 ? (index + 1) : 0;
    }

    static nibbleToVariableId(value: number): string | null {
        if (!Number.isFinite(value) || value <= 0) return null;
        const index = value - 1;
        return ShareConstants.VARIABLE_IDS[index] || null;
    }

    static encodeVariableNibbleArray(values: VariableNibbleInput[] | undefined | null): string {
        if (!Array.isArray(values) || !values.length) return '';
        const hasData = values.some((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry > 0);
        if (!hasData) return '';
        return ShareBase64.toBase64Url(ShareVariableCodec.packNibbles(values.map((entry) => Number(entry) & 0x0f)));
    }

    static decodeVariableNibbleArray(text: string | null | undefined, expectedCount: number): number[] {
        const safeCount = Number.isFinite(expectedCount) && expectedCount > 0 ? expectedCount : 0;
        if (!text || !safeCount) return new Array<number>(safeCount).fill(0);
        const bytes = ShareBase64.fromBase64Url(text);
        const values = ShareVariableCodec.unpackNibbles(bytes, safeCount);
        return values.map((value) => (Number.isFinite(value) ? value : 0));
    }

    static buildVariableEntries(states: unknown[] | undefined | null): VariableEntry[] {
        const ids = ShareConstants.VARIABLE_IDS;
        const names = ShareConstants.VARIABLE_NAMES;
        const colors = ShareConstants.VARIABLE_COLORS;
        const normalized = Array.isArray(states) && states.length === ids.length
            ? states
            : new Array<boolean>(ids.length).fill(false);
        return ids.map((id, index) => ({
            id,
            order: index + 1,
            name: names[index] || id,
            color: colors[index] || '#000000',
            value: Boolean(normalized[index])
        }));
    }

    static packNibbles(values: number[]): Uint8Array {
        const byteLength = Math.ceil(values.length / 2);
        const bytes = new Uint8Array(byteLength);
        for (let i = 0; i < values.length; i += 2) {
            const high = values[i] & 0x0f;
            const lowValue = typeof values[i + 1] === 'number' ? values[i + 1] : 0;
            const low = lowValue & 0x0f;
            const index = i >> 1;
            bytes[index] = (high << 4) | low;
        }
        return bytes;
    }

    static unpackNibbles(bytes: Uint8Array, expectedCount: number): number[] {
        const values: number[] = new Array<number>(expectedCount);
        for (let i = 0; i < expectedCount; i++) {
            const byte = bytes[i >> 1] || 0;
            values[i] = (i % 2 === 0) ? ((byte >> 4) & 0x0f) : (byte & 0x0f);
        }
        return values;
    }

    static getFirstVariableId() {
        const ids = ShareConstants.VARIABLE_IDS;
        return ids.length ? ids[0] : null;
    }
}

export { ShareVariableCodec };
