export type FontsPlus = {
    filename: string;
    data: string;
    applyGame: boolean;
    applyEditor: boolean;
    bold: boolean;
    italic: boolean;
};
export type FontAxis = { tag: string; min: number; default: number; max: number };
export type FontCapabilities = {
    bold: { inherent: boolean; switchable: boolean };
    italic: { inherent: boolean; switchable: boolean };
    axes: FontAxis[];
    weight: number;
};
const MAX_BYTES = 1024 * 1024;

export function fontBytesToBase64(bytes: Uint8Array): string {
    if (!bytes.length || bytes.length > MAX_BYTES) throw Error('Font must be nonempty and at most 1 MiB');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
}

export function decodeFontBytes(data: string): Uint8Array {
    if (!data || data.length > Math.ceil(MAX_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) throw Error('Invalid font base64 data');
    let binary: string;
    try { binary = atob(data); } catch { throw Error('Invalid font base64 data'); }
    if (!binary.length || binary.length > MAX_BYTES || btoa(binary) !== data) throw Error('Font data is malformed or exceeds 1 MiB');
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export function inspectFont(bytes: Uint8Array): FontCapabilities {
    const fail = (): never => { throw Error('Invalid or unsupported TrueType font. Choose a complete .ttf file (at most 1 MiB).'); };
    if (bytes.length < 12 || bytes.length > MAX_BYTES) fail();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0) !== 0x00010000) fail();
    const count = view.getUint16(4);
    if (!count || count > 128 || 12 + count * 16 > bytes.length) fail();
    const tagAt = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const tables = new Map<string, { offset: number; length: number }>();
    const regions: { offset: number; length: number }[] = [];
    for (let i = 0; i < count; i++) {
        const entry = 12 + i * 16;
        const tag = tagAt(entry);
        const offset = view.getUint32(entry + 8);
        const length = view.getUint32(entry + 12);
        if (tables.has(tag) || offset < 12 + count * 16 || offset % 4 || offset + length > bytes.length) fail();
        if (length && regions.some(r => offset < r.offset + r.length && r.offset < offset + length)) fail();
        tables.set(tag, { offset, length });
        regions.push({ offset, length });
    }
    const table = (tag: string, min: number): number => {
        const value = tables.get(tag);
        if (!value || value.length < min) return fail();
        return value.offset;
    };
    const head = table('head', 54);
    if (view.getUint32(head + 12) !== 0x5f0f3cf5) fail();
    const units = view.getUint16(head + 18);
    if (units < 16 || units > 16384) fail();
    const os2 = table('OS/2', 64);
    const maxp = table('maxp', 32);
    if (view.getUint32(maxp) !== 0x10000) fail();
    const glyphs = view.getUint16(maxp + 4);
    const hhea = table('hhea', 36);
    const metrics = view.getUint16(hhea + 34);
    if (!glyphs || !metrics || metrics > glyphs) fail();
    table('hmtx', metrics * 4 + (glyphs - metrics) * 2);
    table('cmap', 4);
    table('name', 6);
    const glyf = table('glyf', 1);
    const locationFormat = view.getInt16(head + 50);
    if (locationFormat !== 0 && locationFormat !== 1) fail();
    const loca = table('loca', (glyphs + 1) * (locationFormat ? 4 : 2));
    let last = 0;
    for (let i = 0; i <= glyphs; i++) {
        const offset = locationFormat ? view.getUint32(loca + i * 4) : view.getUint16(loca + i * 2) * 2;
        if (offset < last || glyf + offset > glyf + (tables.get('glyf')?.length ?? 0)) fail();
        last = offset;
    }
    let weight = view.getUint16(os2 + 4);
    if (weight < 1 || weight > 1000) fail();
    const flags = view.getUint16(os2 + 62);
    const macStyle = view.getUint16(head + 44);
    const axes: FontAxis[] = [];
    if (tables.has('fvar')) {
        const fvar = table('fvar', 16);
        if (view.getUint32(fvar) !== 0x10000) fail();
        const start = view.getUint16(fvar + 4);
        const axisCount = view.getUint16(fvar + 8);
        const axisSize = view.getUint16(fvar + 10);
        const instances = view.getUint16(fvar + 12);
        const instanceSize = view.getUint16(fvar + 14);
        if (start < 16 || !axisCount || axisCount > 16 || axisSize !== 20 || instanceSize < axisCount * 4 + 4 || start + axisCount * axisSize + instances * instanceSize > (tables.get('fvar')?.length ?? 0)) fail();
        const gvar = table('gvar', 20);
        const gvarLength = tables.get('gvar')?.length ?? 0;
        const offsetSize = view.getUint16(gvar + 14) & 1 ? 4 : 2;
        const variationData = view.getUint32(gvar + 16);
        const sharedTuples = view.getUint16(gvar + 6);
        const sharedOffset = view.getUint32(gvar + 8);
        if (view.getUint32(gvar) !== 0x10000 || view.getUint16(gvar + 4) !== axisCount || view.getUint16(gvar + 12) !== glyphs ||
            20 + (glyphs + 1) * offsetSize > gvarLength || variationData < 20 + (glyphs + 1) * offsetSize || variationData > gvarLength ||
            sharedOffset + sharedTuples * axisCount * 2 > gvarLength) fail();
        let previous = 0;
        for (let i = 0; i <= glyphs; i++) {
            const offset = offsetSize === 4 ? view.getUint32(gvar + 20 + i * 4) : view.getUint16(gvar + 20 + i * 2) * 2;
            if (offset < previous || variationData + offset > gvarLength) fail();
            previous = offset;
        }
        for (let i = 0; i < axisCount; i++) {
            const offset = fvar + start + i * axisSize;
            const tag = tagAt(offset);
            const min = view.getInt32(offset + 4) / 65536;
            const normal = view.getInt32(offset + 8) / 65536;
            const max = view.getInt32(offset + 12) / 65536;
            if (!/^[A-Za-z0-9 ]{4}$/.test(tag) || axes.some(a => a.tag === tag) || min > normal || normal > max || min === max) fail();
            axes.push({ tag, min, default: normal, max });
        }
    }
    const contains = (tag: string, first: number, second: number) => axes.some(a => a.tag === tag && a.min <= Math.min(first, second) && a.max >= Math.max(first, second));
    weight = axes.find(a => a.tag === 'wght')?.default ?? weight;
    const styleAxes = axes.filter(a => a.tag === 'ital' || a.tag === 'slnt');
    const italic = styleAxes.length ? styleAxes.some(a => a.default !== 0) : Boolean(flags & 1 || flags & 512 || macStyle & 2);
    const canNormalize = styleAxes.every(a => a.min <= 0 && a.max >= 0);
    return {
        bold: { inherent: Boolean(flags & 32 || macStyle & 1 || weight >= 700), switchable: contains('wght', 400, 700) },
        italic: { inherent: italic, switchable: canNormalize && (contains('ital', 0, 1) || axes.some(a => a.tag === 'slnt' && (a.min < 0 || a.max > 0))) },
        axes, weight,
    };
}

export function normalizeFontsPlus(value: unknown, dependencies: { id: string; version: string }[] = []): FontsPlus | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid Fonts+ asset');
    if (!dependencies.some(d => d.id === 'fonts-plus' && d.version === '1.0.0')) throw Error('Fonts+ gameplay dependency is required');
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).some(key => !['filename', 'data', 'applyGame', 'applyEditor', 'bold', 'italic'].includes(key))) throw Error('Invalid Fonts+ settings');
    if (typeof raw.filename !== 'string' || !raw.filename.trim() || raw.filename.length > 255 || !/\.ttf$/i.test(raw.filename)) throw Error('Choose a .ttf font file');
    if (typeof raw.data !== 'string') throw Error('Invalid font data');
    const capabilities = inspectFont(decodeFontBytes(raw.data));
    for (const key of ['applyGame', 'applyEditor', 'bold', 'italic']) if (raw[key] !== undefined && typeof raw[key] !== 'boolean') throw Error(`Invalid Fonts+ ${key} setting`);
    const result: FontsPlus = { filename: raw.filename, data: raw.data, applyGame: raw.applyGame !== false, applyEditor: raw.applyEditor !== false, bold: raw.bold as boolean | undefined ?? capabilities.bold.inherent, italic: raw.italic as boolean | undefined ?? capabilities.italic.inherent };
    for (const key of ['bold', 'italic'] as const) if (!capabilities[key].switchable && result[key] !== capabilities[key].inherent) throw Error(`This font has a fixed ${key} style; upload a variable font to switch it.`);
    return result;
}

export function fontFaceSettings(font: FontsPlus): { weight: string; style: string; variationSettings: string } {
    const c = inspectFont(decodeFontBytes(font.data));
    const weight = c.bold.switchable ? (font.bold ? 700 : 400) : c.weight;
    const ital = c.axes.find(a => a.tag === 'ital' && a.min <= 0 && a.max >= 1);
    const slnt = c.axes.find(a => a.tag === 'slnt');
    const slant = slnt ? (slnt.min < 0 ? Math.max(-12, slnt.min) : Math.min(12, slnt.max)) : 0;
    const variations = c.axes.map(a => {
        const value = a.tag === 'wght' && c.bold.switchable ? weight : a.tag === 'ital' && c.italic.switchable ? (font.italic && ital ? 1 : 0) : a.tag === 'slnt' && c.italic.switchable ? (font.italic && !ital ? slant : 0) : a.default;
        return `"${a.tag}" ${value}`;
    });
    return { weight: String(weight), style: font.italic ? (slnt && !ital ? `oblique ${-(c.italic.switchable ? slant : slnt.default)}deg` : 'italic') : 'normal', variationSettings: variations.join(', ') || 'normal' };
}
