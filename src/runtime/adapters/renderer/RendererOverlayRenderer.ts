import { TextResources } from '../TextResources';
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
        const title = this.introData?.title || 'Tiny RPG Studio';
        const author = (this.introData?.author || '').trim();
        const width = gameplayCanvas.width;
        const height = gameplayCanvas.height;
        ctx.save();
        ctx.fillStyle = 'rgba(4, 6, 14, 0.78)';
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = width / 2;
        const centerY = height / 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${Math.max(12, Math.floor(height / 12))}px monospace`;
        ctx.fillText(title, centerX, centerY - height * 0.12);
        if (author) {
            const byline = formatOverlayText('intro.byline', { author }, `por ${author}`);
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = `${Math.max(10, Math.floor(height / 18))}px monospace`;
            ctx.fillText(byline, centerX, centerY);
        }

        const renderer = this.overlayRenderer;
        if (renderer.gameEngine?.canDismissIntroScreen) {
            const blink = ((Date.now() / GameConfig.animation.blinkInterval) % 2) > 1
                ? GameConfig.animation.blinkMinOpacity
                : GameConfig.animation.blinkMaxOpacity;
            ctx.fillStyle = `rgba(100, 181, 246, ${blink.toFixed(2)})`;
            const startLabel = getOverlayText('intro.startAdventure', 'Iniciar aventura');
            ctx.font = `${Math.max(9, Math.floor(height / 20))}px monospace`;
            ctx.fillText(startLabel, centerX, centerY + height * 0.18);
        }

        ctx.restore();
    }

    drawLevelUpOverlay(ctx: CanvasRenderingContext2D, gameplayCanvas: { width: number; height: number }) {
        if (!ctx || !gameplayCanvas) return;
        const gameState = this.overlayGameState;
        const overlay = gameState.getLevelUpOverlay();
        if (!overlay?.active) return;
        this.overlayEntityRenderer.cleanupEnemyLabels();
        const choices = Array.isArray(overlay.choices) ? overlay.choices : [];
        const width = gameplayCanvas.width;
        const height = gameplayCanvas.height;
        const centerX = width / 2;
        const title = getOverlayText('skills.levelUpTitle', 'Level Up!');
        const pending = Math.max(0, gameState.getPendingLevelUpChoices() || 0);
        const accent = this.overlayPalette.getColor(7) || '#FFF1E8';
        const accentStrong = this.overlayPalette.getColor(13) || accent;
        const titleFont = Math.max(7, Math.floor(height / 42));
        const pendingFont = Math.max(5, Math.floor(height / 70));
        const layout = this.getLevelUpCardLayout({
            width,
            height,
            choicesLength: choices.length,
            hasPendingText: pending > 0,
            titleFont,
            pendingFont
        });

        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.88)';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = accent;
        const topPadding = Math.floor(height * 0.05);
        ctx.font = `${titleFont}px "Press Start 2P", "VT323", monospace`;
        const titleY = topPadding;
        ctx.fillText(title, centerX, titleY);

        let nextY = titleY + titleFont + Math.floor(height * 0.02);
        if (pending > 0) {
            const pendingText = formatOverlayText('skills.pendingLabel', { value: pending }, '');
            if (pendingText) {
                ctx.font = `${pendingFont}px monospace`;
                ctx.fillStyle = accentStrong;
                ctx.fillText(pendingText, centerX, nextY);
                nextY += pendingFont + Math.floor(height * 0.02);
            }
        }
        nextY += Math.floor(height * 0.06);

        if (!choices.length) {
            const allText = getOverlayText('skills.allUnlocked', '');
            if (allText) {
                ctx.font = `${Math.max(9, Math.floor(height / 20))}px monospace`;
                ctx.fillStyle = accentStrong;
                const centerY = layout?.cardArea
                    ? layout.cardArea.cardYStart + layout.cardArea.cardHeight / 2
                    : height / 2;
                ctx.fillText(allText, centerX, centerY);
            }
            ctx.restore();
            return;
        }

        const cardRects = layout?.rects || [];
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
        titleFont = null,
        pendingFont = null
    }: LevelUpLayoutOptions = {}) {
        const cardCount = Math.max(1, choicesLength || 1);
        const computedTitleFont = Number.isFinite(titleFont) ? (titleFont as number) : Math.max(8, Math.floor(height / 34));
        const computedPendingFont = Number.isFinite(pendingFont) ? (pendingFont as number) : Math.max(6, Math.floor(height / 58));
        const topPadding = Math.floor(height * 0.05);
        const titleY = topPadding;
        let nextY = titleY + computedTitleFont + Math.floor(height * 0.02);
        if (hasPendingText) {
            nextY += computedPendingFont + Math.floor(height * 0.02);
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
        const name = data?.nameKey
            ? getOverlayText(data.nameKey, data.id || '')
            : (data?.id || '');
        const description = data?.descriptionKey
            ? getOverlayText(data.descriptionKey, '')
            : '';

        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const nameFont = Math.max(8, Math.floor(height / 16));
        ctx.font = `${nameFont}px "Press Start 2P", "VT323", monospace`;
        ctx.fillText(name, x + padding, y + padding);

        if (data?.icon) {
            ctx.font = `${Math.max(8, Math.floor(height / 14))}px monospace`;
            ctx.textAlign = 'right';
            ctx.fillText(data.icon, x + width - padding, y + padding + Math.max(0, Math.floor(height * 0.02)));
            ctx.textAlign = 'left';
        }

        ctx.font = `${Math.max(7, Math.floor(height / 22))}px monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const descTopGap = Math.max(5, Math.floor(height * 0.06));
        const textY = y + padding + nameFont + descTopGap;
        const lineHeight = Math.max(8, Math.floor(height / 20));
        this.drawWrappedText(ctx, description, x + padding, textY, width - padding * 2, lineHeight, 2);

        ctx.restore();
    }

    drawWrappedText(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        maxLines: number | null = null
    ) {
        if (!ctx || !text) return;
        const words = text.split(/\s+/).filter(Boolean);
        let line = '';
        let offsetY = y;
        let linesDrawn = 0;
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const candidate = line ? `${line} ${word}` : word;
            const metrics = ctx.measureText(candidate);
            const wouldOverflow = metrics.width > maxWidth && line;
            const hitMaxLines = maxLines && linesDrawn >= maxLines - 1;
            if (wouldOverflow || hitMaxLines) {
                ctx.fillText(line, x, offsetY);
                line = word;
                offsetY += lineHeight;
                linesDrawn += 1;
                if (maxLines && linesDrawn >= maxLines) {
                    const remaining = words.slice(i).join(' ');
                    const truncated = `${remaining}`.slice(0, 32).trim();
                    const suffix = truncated ? `${truncated}...` : '...';
                    ctx.fillText(suffix, x, offsetY);
                    return;
                }
            } else {
                line = candidate;
            }
        }
        if (line) {
            ctx.fillText(line, x, offsetY);
        }
    }

    drawLevelUpOverlayFull(ctx: CanvasRenderingContext2D) {
        if (!ctx?.canvas) return;
        this.drawLevelUpOverlay(ctx, { width: ctx.canvas.width, height: ctx.canvas.height });
    }

    drawLevelUpCelebrationOverlay(ctx: CanvasRenderingContext2D, gameplayCanvas: { width: number; height: number }) {
        if (!ctx || !gameplayCanvas) return;
        const gameState = this.overlayGameState;
        const overlay = gameState.getLevelUpCelebration();
        if (!overlay?.active) {
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
        const titleFont = Math.max(12, Math.floor(height / 12));
        ctx.font = `${titleFont}px "Press Start 2P", "VT323", monospace`;
        ctx.fillStyle = '#FFF1E8';
        ctx.fillText(title, centerX, centerY + floatY);
        ctx.restore();
    }

    drawPickupOverlay(ctx: CanvasRenderingContext2D, gameplayCanvas: { width: number; height: number }) {
        if (!ctx || !gameplayCanvas) return;
        const gameState = this.overlayGameState;
        const overlay = gameState.getPickupOverlay();
        if (!overlay?.active) {
            this.stopPickupAnimationLoop();
            return;
        }
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

    getNow() {
        if (typeof performance !== 'undefined' && performance.now) {
            return performance.now();
        }
        return Date.now();
    }

    getPickupSprite(overlay: PickupOverlay | null = null): (number | null)[][] | null {
        if (!overlay?.spriteGroup) return null;
        const factory = this.overlaySpriteFactory;
        if (!factory) return null;
        switch (overlay.spriteGroup) {
            case 'object': {
                const sprites = factory.getObjectSprites();
                const spriteType = overlay.spriteType || '';
                return spriteType ? sprites?.[spriteType] || null : null;
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
            const messageFontSize = Math.max(7, Math.floor(this.canvas.height / 30));
            const lineHeight = Math.round(messageFontSize * 1.4);
            const textFont = `${messageFontSize}px "Press Start 2P", "VT323", monospace`;
            ctx.font = textFont;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#F8FAFC';

            const wrapLines = (text: string): string[] => {
                const sections = text
                    .replace(/\r\n/g, '\n')
                    .split(/\n+/)
                    .map((section) => section.trim())
                    .filter(Boolean);
                if (!sections.length) return [];
                const lines: string[] = [];
                sections.forEach((section, index) => {
                    const words = section.split(/\s+/);
                    let current = '';
                    words.forEach((word) => {
                        const next = current ? `${current} ${word}` : word;
                        if (ctx.measureText(next).width > availableWidth && current) {
                            lines.push(current);
                            current = word;
                        } else {
                            current = next;
                        }
                    });
                    if (current) {
                        lines.push(current);
                    }
                    if (index < sections.length - 1) {
                        lines.push('');
                    }
                });
                return lines.length ? lines : [''];
            };

            const lines = wrapLines(endingText);
            const totalHeight = lines.length * lineHeight;
            const offset = Math.max(lineHeight, Math.floor(messageFontSize * 1.2));
            let startY = Math.max(padding, Math.floor(centerY - totalHeight - offset));
            if (!Number.isFinite(startY)) {
                startY = padding;
            }
            let cursorY = startY;
            lines.forEach((line) => {
                if (line.trim().length) {
                    const alignedY = Math.round(cursorY) + 0.5;
                    ctx.fillText(line, centerX, alignedY);
                }
                cursorY += lineHeight;
            });
            ctx.restore();
        }

        ctx.fillStyle = '#FFFFFF';
        let fontSize = Math.max(5, Math.floor(this.canvas.height / 22));
        const endFont = `${fontSize}px "Press Start 2P", monospace`;
        ctx.font = endFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isVictory ? 'The End' : 'Game Over', centerX, centerY);

        if (!gameState.canResetAfterGameOver) {
            ctx.restore();
            return;
        }
        ctx.save();
        const blink = ((Date.now() / GameConfig.animation.blinkInterval) % 2) > 1
            ? GameConfig.animation.blinkMinOpacity
            : GameConfig.animation.blinkMaxOpacity;
        ctx.fillStyle = `rgba(100, 181, 246, ${blink.toFixed(2)})`;
        fontSize = Math.max(4, Math.floor(this.canvas.height / 26));
        ctx.font = `${fontSize}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const retryY = Math.round(this.canvas.height / 1.5) + 0.5;
        const reviveLabel = gameState.hasNecromancerReviveReady()
            ? getOverlayText('skills.necromancer.revivePrompt', '')
            : getOverlayText(isVictory ? 'gameOver.retryVictory' : 'gameOver.retryDefeat', '');
        ctx.fillText(reviveLabel, centerX, retryY);
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
    getObjectSprites: () => Record<string, (number | null)[][]>;
};

type CanvasHelperApi = {
    drawSprite: (ctx: CanvasRenderingContext2D, sprite: (number | null)[][] | null, x: number, y: number, step: number) => void;
};

type SkillChoice = {
    id?: string;
    nameKey?: string;
    descriptionKey?: string;
    icon?: string;
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
    titleFont?: number | null;
    pendingFont?: number | null;
};

type LevelUpCardOptions = {
    x: number;
    y: number;
    width: number;
    height: number;
    active?: boolean;
    data?: SkillChoice | null;
};
