export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type PluginData = Record<string, JsonValue>;

export function normalizePluginData(value: unknown, dependencies: { id: string; version: string }[] = []): PluginData | undefined {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid plugin data');
    let nodes = 0;
    const visit = (entry: unknown, depth: number): void => {
        if (++nodes > 16384 || depth > 16) throw Error('Plugin data is too large');
        if (entry === null || typeof entry === 'boolean') return;
        if (typeof entry === 'number' && Number.isFinite(entry)) return;
        if (typeof entry === 'string' && entry.length <= 65536) return;
        if (Array.isArray(entry)) { entry.forEach(item => visit(item, depth + 1)); return; }
        if (entry && typeof entry === 'object' && Object.getPrototypeOf(entry) === Object.prototype) {
            for (const [key, item] of Object.entries(entry)) {
                if (key === '__proto__' || key === 'constructor' || key === 'prototype' || key.length > 128) throw Error('Invalid plugin data key');
                visit(item, depth + 1);
            }
            return;
        }
        throw Error('Plugin data must contain JSON values');
    };
    visit(value, 0);
    for (const id of Object.keys(value)) {
        if (!dependencies.some(item => item.id === id)) throw Error(`Plugin data requires gameplay dependency ${id}`);
    }
    if (JSON.stringify(value).length > 262144) throw Error('Plugin data is too large');
    return Object.keys(value).length ? structuredClone(value as PluginData) : undefined;
}
