
import { TILE_PRESETS } from '../runtime/domain/definitions/TileDefinitions';
import { ShareDecoder } from '../runtime/infra/share/ShareDecoder';

type ShareCoverOptions = {
  width?: number;
  height?: number;
  devicePixelRatio?: number;
  canvas?: HTMLCanvasElement;
};

type TilePixels = (string | null)[][];

type ShareMapData = {
  ground?: (number | null)[][];
  overlay?: (number | null)[][];
};

type ShareGameData = {
  title?: string;
  author?: string;
  tileset?: { map?: ShareMapData | null } | null;
};

class ShareCoverPreview {
  static tileCache?: Map<number, TilePixels>;
  width: number;
  height: number;
  dpr: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  gameData: ShareGameData | null;

  constructor(options: ShareCoverOptions = {}) {
    this.width = Math.max(64, options.width ?? 256);
    this.height = Math.max(64, options.height ?? this.width);
    const devicePixelRatio = options.devicePixelRatio || (globalThis.devicePixelRatio || 1);
    this.dpr = Math.max(1, Math.min(3, devicePixelRatio));
    this.canvas = options.canvas instanceof HTMLCanvasElement ? options.canvas : document.createElement('canvas');
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx && this.dpr !== 1) {
      this.ctx.scale(this.dpr, this.dpr);
    }
    this.gameData = null;
  }

    static extractShareCode(value = ''): string {
        const text = String(value || '').trim();
        if (!text) return '';
        if (text.startsWith('#')) {
            return text.slice(1);
        }
        if (text.includes('://')) {
            try {
                const baseOrigin =
                    typeof globalThis.location !== 'undefined'
                        ? globalThis.location.origin
                        : undefined;
                const parsed = new URL(text, baseOrigin);
                return parsed.hash.replace(/^#/, '');
            } catch {
                // ignore and fall through
            }
        }
        return text.includes('.') ? text : '';
    }

    static decodeShareUrl(shareUrl: string): ShareGameData {
        const code = ShareCoverPreview.extractShareCode(shareUrl);
        if (!code) {
            throw new Error('No share code found in the provided URL.');
        }
        const data = ShareDecoder.decodeShareCode(code) as ShareGameData | null;
        if (!data) {
            throw new Error('Unable to decode the provided share code.');
        }
        return data;
    }

    static ensureTileCache(): void {
        if (this.tileCache instanceof Map) return;
        const tiles = TILE_PRESETS;
        this.tileCache = new Map();
        const cache = this.tileCache;
        tiles.forEach((tile) => {
            if (typeof tile.id !== 'number') return;
            const pixels = Array.isArray(tile.pixels) ? (tile.pixels as TilePixels) : null;
            if (pixels) {
                cache.set(tile.id, pixels);
            }
        });
    }

    static getTilePixels(tileId: number | null | undefined): TilePixels | null {
        if (!Number.isFinite(tileId) || tileId === null || tileId === undefined || tileId < 0) return null;
        this.ensureTileCache();
        const cache = this.tileCache;
        if (!cache) return null;
        return cache.get(Number(tileId)) || null;
    }

    renderFromUrl(shareUrl: string): HTMLCanvasElement {
        this.gameData = ShareCoverPreview.decodeShareUrl(shareUrl);
        this.render();
        return this.canvas;
    }

    render(): HTMLCanvasElement {
        if (!this.ctx) return this.canvas;
        this.clear();
        this.drawBackdrop();
        this.drawMapPreview(this.gameData?.tileset?.map ?? undefined);
        this.drawIntroOverlay();
        return this.canvas;
    }

    clear(): void {
        this.ctx?.clearRect(0, 0, this.width, this.height);
    }

    drawBackdrop(): void {
        const ctx = this.ctx;
        if (!ctx) return;
        const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, '#04060e');
        gradient.addColorStop(1, '#101b3a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
    }

    drawMapPreview(map?: ShareMapData): void {
        const ctx = this.ctx;
        if (!ctx) return;
        const ground = Array.isArray(map?.ground) ? map.ground : [];
        const overlay = Array.isArray(map?.overlay) ? map.overlay : [];
        const rows = Math.max(ground.length, overlay.length, 8);
        const cols = Math.max(
            ground.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0),
            overlay.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0),
            8
        );
        const gridSize = Math.min(this.width * 0.85, this.height * 0.78);
        const tileWidth = gridSize / cols;
        const tileHeight = gridSize / rows;
        const mapWidth = cols * tileWidth;
        const mapHeight = rows * tileHeight;
        const offsetX = (this.width - mapWidth) / 2;
        const offsetY = (this.height - mapHeight) / 2;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = 'rgba(6, 8, 18, 0.92)';
        ctx.fillRect(offsetX - 10, offsetY - 10, mapWidth + 20, mapHeight + 20);
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(offsetX - 6, offsetY - 6, mapWidth + 12, mapHeight + 12);

        const drawLayer = (layer: (number | null)[][]): void => {
            layer.forEach((row, y) => {
                if (!Array.isArray(row)) return;
                row.forEach((tileId, x) => {
                    if (typeof tileId !== 'number' || Number.isNaN(tileId) || tileId < 0) return;
                    this.drawTile(tileId, offsetX + x * tileWidth, offsetY + y * tileHeight, tileWidth, tileHeight);
                });
            });
        };

        drawLayer(ground);
        drawLayer(overlay);

        ctx.restore();
    }

    drawTile(tileId: number, px: number, py: number, width: number, height: number): void {
        const pixels = ShareCoverPreview.getTilePixels(tileId);
        const ctx = this.ctx;
        if (!pixels || !ctx) return;
        const rows = pixels.length || 8;
        const cols = pixels[0] ? pixels[0].length : 8;
        const cellWidth = width / cols;
        const cellHeight = height / rows;
        for (let y = 0; y < rows; y++) {
            const row = pixels[y];
            if (!Array.isArray(row)) continue;
            for (let x = 0; x < cols; x++) {
                const color = row[x];
                if (!color || color === 'transparent') continue;
                ctx.fillStyle = color;
                ctx.fillRect(px + x * cellWidth, py + y * cellHeight, cellWidth, cellHeight);
            }
        }
    }

    drawIntroOverlay(): void {
        const ctx = this.ctx;
        if (!ctx) return;
        const width = this.width;
        const height = this.height;
        ctx.save();
        ctx.fillStyle = 'rgba(4, 6, 14, 0.78)';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        ctx.strokeRect(3, 3, width - 6, height - 6);

        const title = (this.gameData?.title || 'Tiny RPG Studio').trim() || 'Tiny RPG Studio';
        const author = (this.gameData?.author || '').trim();
        const centerX = width / 2;
        const centerY = height / 2;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const fitText = (text: string, maxWidth: number, baseSize: number): number => {
            let size = baseSize;
            ctx.font = `${size}px "Space Mono", monospace`;
            while (ctx.measureText(text).width > maxWidth && size > 12) {
                size -= 1;
                ctx.font = `${size}px "Space Mono", monospace`;
            }
            return size;
        };

        const titleSize = fitText(title, width * 0.9, Math.max(18, Math.floor(height / 9)));
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${titleSize}px "Space Mono", monospace`;
        ctx.fillText(title, centerX, centerY - height * 0.12);

        if (author) {
            const authorText = `por ${author}`;
            ctx.fillStyle = 'rgba(255,255,255,0.82)';
            const authorSize = fitText(authorText, width * 0.8, Math.max(14, Math.floor(height / 16)));
            ctx.font = `${authorSize}px "Space Mono", monospace`;
            ctx.fillText(authorText, centerX, centerY - height * 0.02);
        }

        ctx.fillStyle = 'rgba(100, 181, 246, 0.95)';
        ctx.font = `${Math.max(12, Math.floor(height / 18))}px "Space Mono", monospace`;
        ctx.fillText('Iniciar aventura', centerX, centerY + height * 0.16);

        ctx.restore();
    }
}

export { ShareCoverPreview };
