import { decodeFontBytes, fontFaceSettings, type FontsPlus } from '../../services/FontsPlus';
import { setGameFont, type FontPresentation } from './FontPresentation';

let serial = 0;
type LoadedFont = { key: string; face: FontFace; presentation: FontPresentation };

export class FontLifecycle {
    private current?: LoadedFont;
    private prepared?: LoadedFont;
    private generation = 0;
    private pending?: { key: string; promise: Promise<void> };
    editorPresentation?: FontPresentation;

    async prepare(asset?: FontsPlus): Promise<void> {
        if (!asset) return;
        const key = JSON.stringify(asset);
        if (this.current?.key === key || this.prepared?.key === key) return;
        if (this.pending?.key === key) return this.pending.promise;
        const ticket = ++this.generation;
        const promise = (async () => {
            if (typeof FontFace === 'undefined' || !('fonts' in document)) throw Error('This browser cannot load uploaded fonts');
            const family = `TinyRpgFont${++serial}`;
            const settings = fontFaceSettings(asset);
            const bytes = decodeFontBytes(asset.data);
            const face = new FontFace(family, bytes.buffer as ArrayBuffer, settings);
            try { await face.load(); } catch { throw Error('The browser could not decode this .ttf font. Choose another font.'); }
            if (ticket !== this.generation) throw Error('Font loading was superseded by a project or font change');
            this.prepared = { key, face, presentation: { family: `"${family}"`, ...settings } };
        })();
        this.pending = { key, promise };
        try { await promise; } finally { if (ticket === this.generation) this.pending = undefined; }
    }

    sync(asset: FontsPlus | undefined, redraw: () => void): void {
        const key = asset && JSON.stringify(asset);
        if (!asset) {
            this.generation++;
            this.pending = undefined;
            this.prepared = undefined;
            if (this.current) document.fonts.delete(this.current.face);
            this.current = undefined;
            this.editorPresentation = undefined;
            setGameFont();
            return;
        }
        const loaded = this.current?.key === key ? this.current : this.prepared?.key === key ? this.prepared : undefined;
        if (loaded) {
            if (this.current !== loaded) {
                if (this.current) document.fonts.delete(this.current.face);
                document.fonts.add(loaded.face);
                this.current = loaded;
                this.prepared = undefined;
            }
            this.editorPresentation = asset.applyEditor ? loaded.presentation : undefined;
            setGameFont(asset.applyGame ? loaded.presentation : undefined);
            return;
        }
        void this.prepare(asset).then(() => { this.sync(asset, redraw); redraw(); document.dispatchEvent(new Event('tiny-rpg-font-ready')); }).catch(error => console.error('[Fonts+]', error));
    }

    destroy(): void { this.sync(undefined, () => {}); }
}
