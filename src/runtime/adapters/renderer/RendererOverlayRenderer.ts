import { FONT_SIZE, LINE_HEIGHT, TITLE_FONT_SIZE } from '../../../config/FontConfig';
import { TextResources } from '../TextResources';
import { bitmapFont } from './BitmapFont';
import { RendererModuleBase } from './RendererModuleBase';
import { GameConfig } from '../../../config/GameConfig';

const getOverlayText = (key: string, fallback = ''): string => {
    const value = TextResources.get(key, fallback) as string;
    return value || fallback || '';
};

const formatOverlayText = (key: string, params: Record<string, string | number | boolean> = {}, fallback = ''): string => {
    const value = TextResources.format(key, params, fallback) as string;
    return value || fallback || '';
};

class RendererOverlayRenderer extends RendererModuleBase {
    introData: { title: string; author: string };
    pickupFx: { id: string | null; startTime: number };
    pickupAnimationHandle: number;
    levelUpAnimationHandle: number;

    constructor(renderer: ConstructorParameters<typeof RendererModuleBase>[0]) {
        super(renderer);
        this.introData = { title: 'Tiny RPG Studio', author: '' };
        this.pickupFx = { id: null, startTime: 0 };
        this.pickupAnimationHandle = 0;
        this.levelUpAnimationHandle = 0;
    }

    get overlayGameState(): OverlayGameState {
        return this.gameState as OverlayGameState;
    }

    get overlayPalette(): PaletteManagerApi {
        return this.paletteManager as PaletteManagerApi;
    }

    get overlaySpriteFactory(): SpriteFactoryApi {
        return this.spriteFactory as SpriteFactoryApi;
    }

    get overlayCanvasHelper(): CanvasHelperApi {
        return this.canvasHelper as CanvasHelperApi;
    }

    get overlayEntityRenderer(): EntityRendererApi {
        return this.entityRenderer as EntityRendererApi;
    }

    get overlayRenderer(): OverlayRendererApi {
        return this.renderer as OverlayRendererApi;
    }

    setIntroData(data: IntroDataInput = {}) {
        this.introData = {
            title: data.title || 'Tiny RPG Studio',
            author: data.author || ''
        };
    }

    drawIntroOverlay(ctx: CanvasRenderingContext2D, gameplayCanvas: { width: number; height: number }) {
        this.overlayEntityRenderer.cleanupEnemyLabels();
        const title = this.introData.title || 'Tiny RPG Studio';
        const author = (this.introData.author || '').trim();
        const width = gameplayCanvas.width;
        const height = gameplayCanvas.height;
        ctx.save();
        ctx.fillStyle = 'rgba(4, 6, 14, 0.78)';
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = width / 2;
        const centerY = height / 2;
        bitmapFont.drawText(ctx, title, centerX, centerY - height * 0.12, TITLE_FONT_SIZE, '#FFFFFF');
        if (author) {
            const byline = formatOverlayText('intro.byline', { author }, `por ${author}`);
            bitmapFont.drawText(ctx, byline, centerX, centerY, FONT_SIZE, 'rgba(255,255,255,0.8)');
        }

        const renderer = this.overlayRenderer;
        if (renderer.gameEngine?.canDismissIntroScreen) {
            const blink = ((Date.now() / GameConfig.animation.blinkInterval) % 2) > 1
                ? GameConfig.animation.blinkMinOpacity
                : GameConfig.animation.blinkMaxOpacity;
            const startLabel = getOverlayText('intro.startAdventure', 'Iniciar aventura');
            bitmapFont.drawText(ctx, startLabel, centerX, centerY + height * 0.18, FONT_SIZE, `rgba(100, 181, 246, ${blink.toFixed(2)})`);
        }

        ctx.restore();
    }

    drawLevelUpOverlay(ctx: CanvasRenderingContext2D, gameplayCanvas: { width: number; height: number }) {
        const gameState = this.overlayGameState;
        const overlay = gameState.getLevelUpOverlay();
        if (!overlay || !overlay.active) return;
        this.overlayEntityRenderer.cleanupEnemyLabels();
        const choices = Array.isArray(overlay.choices) ? overlay.choices : [];
        const width = gameplayCanvas.width;
        const height = gameplayCanvas.height;
        const centerX = width / 2;
        const title = getOverlayText('skills.levelUpTitle', 'Level Up!');
        const pending = Math.max(0, gameState.getPendingLevelUpChoices() || 0);
        const accent = this.overlayPalette.getColor(7);
        const accentStrong = this.overlayPalette.getColor(13) || accent;
        const layout = this.getLevelUpCardLayout({
            width,
            height,
            choicesLength: choices.length,
            hasPendingText: pending > 0,
        });

        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.88)';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const topPadding = Math.floor(height * 0.05);
        const titleY = topPadding;
        bitmapFont.drawText(ctx, title, centerX, titleY, FONT_SIZE, accent);

        let nextY = titleY + FONT_SIZE + Math.floor(height * 0.02);
        if (pending > 0) {
            const pendingText = formatOverlayText('skills.pendingLabel', { value: pending }, '');
            if (pendingText) {
                bitmapFont.drawText(ctx, pendingText, centerX, nextY, FONT_SIZE, accentStrong);
                nextY += FONT_SIZE + Math.floor(height * 0.02);
            }
        }
        nextY += Math.floor(height * 0.06);

        if (!choices.length) {
            const allText = getOverlayText('skills.allUnlocked', '');
            if (allText) {
                const { cardArea } = layout;
                const centerY = cardArea.cardYStart + cardArea.cardHeight / 2;
                bitmapFont.drawText(ctx, allText, centerX, centerY, FONT_SIZE, accentStrong);
            }
            ctx.restore();
            return;
        }

        const cardRects = layout.rects;
        cardRects.forEach((rect, index) => {
            this.drawLevelUpCard(ctx, {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                active: overlay.cursor === index,
                data: choices[index]
            });
        });

        ctx.restore();
    }

    getLevelUpCardLayout({
        width = 0,
        height = 0,
        choicesLength = 0,
        hasPendingText = false,
    }: LevelUpLayoutOptions = {}) {
        const cardCount = Math.max(1, choicesLength || 1);
        const topPadding = Math.floor(height * 0.05);
        const titleY = topPadding;
        let nextY = titleY + FONT_SIZE + Math.floor(height * 0.02);
        if (hasPendingText) {
            nextY += FONT_SIZE + Math.floor(height * 0.02);
        }
        nextY += Math.floor(height * 0.06);

        const perRow = cardCount === 2 ? 1 : cardCount;
        const rows = Math.max(1, Math.ceil(cardCount / perRow));
        const marginX = Math.max(4, Math.floor(width * 0.025));
        const gapX = Math.max(5, Math.floor(width * 0.02));
        const gapY = Math.max(6, Math.floor(height * 0.018));
        const usableWidth = Math.max(70, width - marginX * 2);
        const cardWidth = Math.max(105, Math.min(Math.floor(usableWidth / perRow), Math.floor(width * 0.9)));
        const totalCardsWidth = cardWidth * perRow + gapX * Math.max(0, perRow - 1);
        const startX = Math.round((width - totalCardsWidth) / 2);
        const cardYStart = Math.round(Math.max(nextY + Math.floor(height * 0.01), height * 0.18));
        const maxCardHeight = Math.max(100, Math.floor((height - cardYStart - gapY * (rows - 1)) / rows));
        const cardHeight = Math.min(Math.max(100, maxCardHeight), Math.floor(height * 0.36));

        const rects = Array.from({ length: cardCount }, (_, index) => {
            const row = Math.floor(index / perRow);
            const col = index % perRow;
            const px = Math.round(startX + col * (cardWidth + gapX));
            const py = Math.round(cardYStart + row * (cardHeight + gapY));
            return { x: px, y: py, width: cardWidth, height: cardHeight };
        });

        return {
            rects,
            cardArea: { startX, cardYStart, cardWidth, cardHeight, gapX, gapY, perRow, rows }
        };
    }

    drawLevelUpCard(
        ctx: CanvasRenderingContext2D,
        { x, y, width, height, active = false, data = null }: LevelUpCardOptions
    ) {
        ctx.save();
        const accent = active
            ? (this.overlayPalette.getColor(13) || '#64b5f6')
            : (this.overlayPalette.getColor(6) || '#C2C3C7');
        ctx.fillStyle = active ? 'rgba(100, 181, 246, 0.16)' : 'rgba(0, 0, 0, 0.55)';
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(2, Math.floor(width * 0.015));
        ctx.shadowColor = active ? 'rgba(100, 181, 246, 0.4)' : 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = active ? Math.max(8, Math.floor(width * 0.05)) : Math.max(4, Math.floor(width * 0.02));
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

        const padding = Math.max(6, Math.floor(width * 0.05));
        const name = data?.resolvedName
            || (data?.nameKey ? getOverlayText(data.nameKey, data.id || '') : (data?.id || ''));
        const description = data?.resolvedDescription
            || (data?.descriptionKey ? getOverlayText(data.descriptionKey, '') : '');

        ctx.shadowColor = 'transparent';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const iconReserve = data?.icon ? Math.max(18, Math.floor(height / 6)) : 0;
        const nameMaxWidth = Math.max(12, width - padding * 2 - iconReserve);
        bitmapFont.drawText(ctx, this.ellipsizeText(name, nameMaxWidth, FONT_SIZE), x + padding, y + padding, FONT_SIZE, '#FFFFFF');

        if (data?.icon) {
            ctx.textAlign = 'right';
            bitmapFont.drawText(ctx, data.icon, x + width - padding, y + padding, FONT_SIZE, '#FFFFFF');
            ctx.textAlign = 'left';
        }

        const descTopGap = Math.max(5, Math.floor(height * 0.06));
        const textY = y + padding + FONT_SIZE + descTopGap;
        this.drawWrappedText(ctx, description, x + padding, textY, width - padding * 2, LINE_HEIGHT, FONT_SIZE, 3);

        ctx.restore();
    }

    ellipsizeText(text: string, maxWidth: number, charSize: number): string {
        const source = typeof text === 'string' ? text : '';
        if (!source || bitmapFont.measureText(source, charSize) <= maxWidth) return source;
        const ellipsis = '...';
        if (bitmapFont.measureText(ellipsis, charSize) > maxWidth) return '';
        let lo = 0;
        let hi = source.length;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            const candidate = source.slice(0, mid) + ellipsis;
            if (bitmapFont.measureText(candidate, charSize) <= maxWidth) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        return source.slice(0, lo) + ellipsis;
    }

    wrapText(text: string, maxWidth: number, charSize: number, maxLines: number): string[] {
        const words = String(text || '').split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let line = '';
        let truncated = false;

        const pushLine = (value: string) => {
            if (lines.length >= maxLines) { truncated = true; return; }
            lines.push(value);
        };

        words.forEach((word) => {
            if (truncated) return;
            let rest = word;
            while (rest && bitmapFont.measureText(rest, charSize) > maxWidth) {
                if (line) { pushLine(line); line = ''; }
                let splitAt = 1;
                while (
                    splitAt < rest.length
                    && bitmapFont.measureText(rest.slice(0, splitAt + 1), charSize) <= maxWidth
                ) {
                    splitAt += 1;
                }
                pushLine(rest.slice(0, splitAt));
                rest = rest.slice(splitAt);
                if (truncated) return;
            }
            const candidate = line ? `${line} ${rest}` : rest;
            if (bitmapFont.measureText(candidate, charSize) > maxWidth && line) {
                pushLine(line);
                line = rest;
            } else {
                line = candidate;
            }
        });
        if (line && !truncated) pushLine(line);
        if (maxLines === 1 && words.length > 1) {
            truncated = true;
        }
        if (truncated && lines.length) {
            lines[lines.length - 1] = this.ellipsizeText(`${lines[lines.length - 1]}...`, maxWidth, charSize);
        }
        return lines.slice(0, maxLines);
    }

    drawWrappedText(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        charSizeOrMaxLines: number | null = FONT_SIZE,
        maxLines: number | null = null,
        color = '#FFFFFF'
    ) {
        if (!text) return;
        const legacyCall = arguments.length <= 7;
        const charSize = legacyCall ? FONT_SIZE : Math.max(1, Number(charSizeOrMaxLines) || FONT_SIZE);
        const resolvedMaxLines = legacyCall ? charSizeOrMaxLines : maxLines;
        const lines = this.wrapText(text, maxWidth, charSize, resolvedMaxLines ?? Number.MAX_SAFE_INTEGER);
        let offsetY = y;
        lines.forEach((line) => {
            bitmapFont.drawText(ctx, line, x, offsetY, charSize, color);
            offsetY += lineHeight;
        });
    }

    drawLevelUpOverlayFull(ctx: CanvasRenderingContext2D) {
        this.drawLevelUpOverlay(ctx, { width: ctx.canvas.width, height: ctx.canvas.height });
    }

    drawLevelUpCelebrationOverlay(ctx: CanvasRenderingContext2D, gameplayCanvas: { width: number; height: number }) {
        const gameState = this.overlayGameState;
        const overlay = gameState.getLevelUpCelebration();
        if (!overlay || !overlay.active) {
            this.stopLevelUpAnimationLoop();
            return;
        }
        this.ensureLevelUpAnimationLoop();
        this.overlayEntityRenderer.cleanupEnemyLabels();

        const width = gameplayCanvas.width;
        const height = gameplayCanvas.height;
        const now = this.getNow();
        const startTime = Number.isFinite(overlay.startTime) ? (overlay.startTime as number) : now;
        const elapsed = Math.max(0, (now - startTime) / 1000);
        const minSide = Math.min(width, height);
        const baseSize = Math.floor(minSide * 0.62);
        const popIn = this.easeOutBack(Math.min(1, elapsed / 0.42));
        const wobble = 1 + Math.sin(elapsed * 5.2) * 0.035;
        const size = Math.round(baseSize * (0.76 + popIn * 0.22) * wobble);
        const centerX = width / 2;
        const centerY = height / 2;
        const floatY = Math.sin(elapsed * 2.1) * 6;
        const boxX = Math.round(centerX - size / 2);
        const boxY = Math.round(centerY - size / 2 + floatY);
        const accent = this.overlayPalette.getColor(13) || '#F8E7A1';

        ctx.save();
        this.drawPickupFrame(ctx, { x: boxX, y: boxY, size, elapsed, accent });
        ctx.restore();

        const title = getOverlayText('player.levelUp', 'Level Up!');

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        bitmapFont.drawText(ctx, title, centerX, centerY + floatY, FONT_SIZE, '#FFF1E8');
        ctx.restore();
    }

    drawPickupOverlay(ctx: CanvasRenderingContext2D, gameplayCanvas: { width: number; height: number }) {
        const gameState = this.overlayGameState;
        const overlay = gameState.getPickupOverlay();
        if (!overlay || !overlay.active) {
            this.stopPickupAnimationLoop();
            return;
        }
        this.stopPickupAnimationLoop();
        this.ensurePickupAnimationLoop();

        const width = gameplayCanvas.width;
        const height = gameplayCanvas.height;
        const now = this.getNow();
        const fx = this.ensurePickupFx(overlay, now);
        const elapsed = Math.max(0, (now - fx.startTime) / 1000);
        const minSide = Math.min(width, height);
        const baseSize = Math.floor(minSide * 0.62);
        const popIn = this.easeOutBack(Math.min(1, elapsed / 0.35));
        const wobble = 1 + Math.sin(elapsed * 5.2) * 0.04;
        const size = Math.round(baseSize * (0.78 + popIn * 0.22) * wobble);
        const centerX = width / 2;
        const centerY = height / 2;
        const floatY = Math.sin(elapsed * 2.4) * 6;

        const boxX = Math.round(centerX - size / 2);
        const boxY = Math.round(centerY - size / 2 + floatY);

        ctx.save();
        this.drawPickupFrame(ctx, { x: boxX, y: boxY, size, elapsed });
        ctx.restore();

        const sprite = this.getPickupSprite(overlay);
        if (sprite) {
            const spriteArea = Math.floor(size * 0.48);
            const baseStep = Math.max(2, Math.floor(spriteArea / 8));
            const popScale = 1 + Math.sin(elapsed * 8.2) * 0.1;
            const step = Math.max(2, Math.floor(baseStep * popScale));
            const spriteSize = step * 8;
            const spriteX = Math.round(centerX - spriteSize / 2);
            const spriteY = Math.round(boxY + size / 2 - spriteSize / 2);
            this.overlayCanvasHelper.drawSprite(ctx, sprite, spriteX, spriteY, step);
        }

    }

    drawPickupFrame(
        ctx: CanvasRenderingContext2D,
        { x, y, size, elapsed = 0, accent = null }: { x: number; y: number; size: number; elapsed?: number; accent?: string | null }
    ) {
        const accentColor = accent || this.overlayPalette.getColor(2) || '#FFF1E8';
        ctx.save();
        const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
        gradient.addColorStop(0, 'rgba(7, 11, 26, 0.96)');
        gradient.addColorStop(0.55, 'rgba(14, 25, 48, 0.96)');
        gradient.addColorStop(1, 'rgba(9, 14, 32, 0.96)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, size, size);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = Math.max(10, Math.floor(size * 0.08));
        ctx.shadowOffsetY = Math.max(4, Math.floor(size * 0.02));

        const border = Math.max(2, Math.floor(size * 0.025));
        ctx.lineWidth = border;
        ctx.strokeStyle = `rgba(255, 241, 232, ${(0.35 + 0.25 * Math.sin(elapsed * 4)).toFixed(2)})`;
        ctx.strokeRect(x + border / 2, y + border / 2, size - border, size - border);

        const innerPad = Math.max(10, Math.floor(size * 0.08));
        const stripeHeight = Math.max(6, Math.floor(size * 0.05));
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = accentColor;
        ctx.fillRect(x + innerPad, y + innerPad, size - innerPad * 2, stripeHeight);
        ctx.fillRect(x + innerPad, y + size - innerPad - stripeHeight, size - innerPad * 2, stripeHeight);
        ctx.restore();
    }

    drawPickupRings(
        ctx: CanvasRenderingContext2D,
        { centerX, centerY, size, elapsed = 0 }: { centerX: number; centerY: number; size: number; elapsed?: number }
    ) {
        ctx.save();
        const primaryRadius = size * 0.35 + Math.sin(elapsed * 3.2) * size * 0.05;
        const lineWidth = Math.max(2, Math.floor(size * 0.02));
        const alpha = 0.35 + 0.15 * Math.sin(elapsed * 5.4);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = `rgba(255, 241, 232, ${alpha.toFixed(2)})`;
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, primaryRadius + i * size * 0.07, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = 'rgba(100, 181, 246, 0.5)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, primaryRadius * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ensurePickupFx(overlay: PickupOverlay, now = this.getNow()) {
        const id = `${overlay.spriteGroup || ''}:${overlay.spriteType || ''}:${overlay.name || ''}`;
        if (this.pickupFx.id !== id) {
            this.pickupFx = {
                id,
                startTime: now
            };
        }
        return this.pickupFx;
    }

    ensureLevelUpAnimationLoop() {
        if (this.levelUpAnimationHandle) return;
        const step = () => {
            if (!this.overlayGameState.isLevelUpCelebrationActive()) {
                this.stopLevelUpAnimationLoop();
                this.overlayRenderer.draw?.();
                return;
            }
            this.levelUpAnimationHandle = this.schedulePickupFrame(step);
            this.overlayRenderer.draw?.();
        };
        this.levelUpAnimationHandle = this.schedulePickupFrame(step);
    }

    stopLevelUpAnimationLoop() {
        if (!this.levelUpAnimationHandle) return;
        this.cancelPickupFrame(this.levelUpAnimationHandle);
        this.levelUpAnimationHandle = 0;
    }

    ensurePickupAnimationLoop() {
        if (this.pickupAnimationHandle) return;
        const step = () => {
            if (!this.overlayGameState.isPickupOverlayActive()) {
                this.stopPickupAnimationLoop();
                return;
            }
            this.pickupAnimationHandle = this.schedulePickupFrame(step);
            this.overlayRenderer.draw?.();
        };
        this.pickupAnimationHandle = this.schedulePickupFrame(step);
    }

    stopPickupAnimationLoop() {
        if (!this.pickupAnimationHandle) return;
        this.cancelPickupFrame(this.pickupAnimationHandle);
        this.pickupAnimationHandle = 0;
    }

    schedulePickupFrame(fn: () => void) {
        if (typeof requestAnimationFrame === 'function') {
            return requestAnimationFrame(fn);
        }
        return setTimeout(fn, 1000 / GameConfig.animation.overlayFPS);
    }

    cancelPickupFrame(id: number) {
        if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(id);
        } else {
            clearTimeout(id);
        }
    }

    easeOutBack(t = 0) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const clamped = this.clamp(t, 0, 1);
        return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
    }

    easeOutQuad(t = 0) {
        const clamped = this.clamp(t, 0, 1);
        return 1 - (1 - clamped) * (1 - clamped);
    }

    clamp(v: number, min: number, max: number) {
        return Math.max(min, Math.min(max, v));
    }

    fitBitmapText(text: string, maxWidth: number, baseSize: number, minSize: number) {
        const normalizedMin = Math.max(8, Math.ceil(minSize / 8) * 8);
        let size = Math.max(normalizedMin, Math.floor(baseSize / 8) * 8);
        while (size > normalizedMin && bitmapFont.measureText(text, size) > maxWidth) {
            size -= 8;
        }
        return size;
    }

    getNow() {
        const perf = (globalThis as Partial<typeof globalThis>).performance;
        if (perf) {
            return perf.now();
        }
        return Date.now();
    }

    getPickupSprite(overlay: PickupOverlay | null = null): (number | null)[][] | null {
        if (!overlay?.spriteGroup) return null;
        const factory = this.overlaySpriteFactory;
        switch (overlay.spriteGroup) {
            case 'object': {
                const sprites = factory.getObjectSprites();
                const spriteType = overlay.spriteType || '';
                return spriteType ? sprites[spriteType] || null : null;
            }
            default:
                return null;
        }
    }

    drawGameOverScreen() {
        const ctx = this.ctx;
        if (!ctx) return;
        this.overlayEntityRenderer.cleanupEnemyLabels();
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const gameState = this.overlayGameState;
        const reason = gameState.getGameOverReason();
        const isVictory = reason === 'victory';
        const endingText = isVictory
            ? (gameState.getActiveEndingText() || '')
            : '';
        const hasEndingText = isVictory && endingText.trim().length > 0;

        const centerX = Math.round(this.canvas.width / 2) + 0.5;
        const centerY = Math.round(this.canvas.height / 2) + 0.5;
        if (hasEndingText) {
            ctx.save();
            const padding = Math.floor(this.canvas.width * 0.08);
            const availableWidth = Math.max(32, this.canvas.width - padding * 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            const lines = this.wrapText(endingText, availableWidth, FONT_SIZE, Number.MAX_SAFE_INTEGER);
            const totalHeight = lines.length * LINE_HEIGHT;
            const offset = Math.max(LINE_HEIGHT, Math.floor(FONT_SIZE * 1.2));
            let startY = Math.max(padding, Math.floor(centerY - totalHeight - offset));
            if (!Number.isFinite(startY)) startY = padding;
            let cursorY = startY;
            lines.forEach((line) => {
                if (line.trim().length) {
                    bitmapFont.drawText(ctx, line, centerX, Math.round(cursorY), FONT_SIZE, '#F8FAFC');
                }
                cursorY += LINE_HEIGHT;
            });
            ctx.restore();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        bitmapFont.drawText(ctx, isVictory ? 'The End' : 'Game Over', centerX, centerY, FONT_SIZE, '#FFFFFF');

        if (!gameState.canResetAfterGameOver) {
            ctx.restore();
            return;
        }
        ctx.save();
        const blink = ((Date.now() / GameConfig.animation.blinkInterval) % 2) > 1
            ? GameConfig.animation.blinkMinOpacity
            : GameConfig.animation.blinkMaxOpacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const retryY = Math.round(this.canvas.height / 1.5);
        const reviveLabel = gameState.hasNecromancerReviveReady()
            ? getOverlayText('skills.necromancer.revivePrompt', '')
            : getOverlayText(isVictory ? 'gameOver.retryVictory' : 'gameOver.retryDefeat', '');
        bitmapFont.drawText(ctx, reviveLabel, centerX, retryY, FONT_SIZE, `rgba(100, 181, 246, ${blink.toFixed(2)})`);
        ctx.restore();
        ctx.restore();
    }

}

export { RendererOverlayRenderer };

type IntroDataInput = {
    title?: string;
    author?: string;
};

type OverlayRendererApi = {
    draw?: () => void;
    gameEngine?: { canDismissIntroScreen?: boolean };
};

type EntityRendererApi = {
    cleanupEnemyLabels: () => void;
};

type PaletteManagerApi = {
    getColor: (index: number) => string;
};

type SpriteFactoryApi = {
    getObjectSprites: () => Record<string, (number | null)[][] | undefined>;
};

type CanvasHelperApi = {
    drawSprite: (ctx: CanvasRenderingContext2D, sprite: (number | null)[][] | null, x: number, y: number, step: number) => void;
};

type SkillChoice = {
    id?: string;
    nameKey?: string;
    descriptionKey?: string;
    icon?: string;
    resolvedName?: string;
    resolvedDescription?: string;
};

type PickupOverlay = {
    active?: boolean;
    name?: string;
    spriteGroup?: string;
    spriteType?: string;
};

type LevelUpOverlay = {
    active?: boolean;
    choices?: SkillChoice[];
    cursor?: number;
};

type LevelUpCelebration = {
    active?: boolean;
    startTime?: number;
};

type OverlayGameState = {
    getLevelUpOverlay: () => LevelUpOverlay | null;
    getPendingLevelUpChoices: () => number;
    getLevelUpCelebration: () => LevelUpCelebration | null;
    isLevelUpCelebrationActive: () => boolean;
    getPickupOverlay: () => PickupOverlay | null;
    isPickupOverlayActive: () => boolean;
    getGameOverReason: () => string | null;
    getActiveEndingText: () => string;
    canResetAfterGameOver: boolean;
    hasNecromancerReviveReady: () => boolean;
};

type LevelUpLayoutOptions = {
    width?: number;
    height?: number;
    choicesLength?: number;
    hasPendingText?: boolean;
};

type LevelUpCardOptions = {
    x: number;
    y: number;
    width: number;
    height: number;
    active?: boolean;
    data?: SkillChoice | null;
};
