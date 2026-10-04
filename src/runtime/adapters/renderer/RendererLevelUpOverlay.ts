import { FONT_NAME, FONT_SIZE } from '../../../config/FontConfig';
import { TextResources } from '../TextResources';
import type { LevelUpChoice, LevelUpOverlayState } from '../../../types/gameState';

const getText = (key: string, fallback = ''): string => {
    const value = TextResources.get(key, fallback) as string;
    return value || fallback || '';
};

const formatText = (key: string, params: Record<string, string | number | boolean>, fallback = ''): string => {
    const value = TextResources.format(key, params, fallback) as string;
    return value || fallback || '';
};

type LevelUpGameState = {
    isLevelUpOverlayActive?: () => boolean;
    getLevelUpOverlay?: () => LevelUpOverlayState;
    getPendingLevelUpChoices?: () => number;
};

type PaletteManagerApi = {
    getColor: (index: number) => string;
};

/**
 * Renders the level-up skill-selection screen as an HTML/CSS overlay over the
 * game canvas, the same approach as RendererDialogRenderer. DOM text is always
 * crisp (the browser handles the device pixel ratio), which avoids the blur and
 * cramping of the small canvas pixel font, and the title/descriptions wrap and
 * fit instead of being clipped.
 *
 * Each skill is a clickable card; the highlighted card tracks the keyboard
 * cursor. The overlay swallows background taps so they never reach the canvas
 * pointer handler underneath.
 */
class RendererLevelUpOverlay {
    private gameState: LevelUpGameState;
    private paletteManager: PaletteManagerApi;
    /** Internal-px height to leave uncovered at the bottom (the inventory bar). */
    private bottomReserve = 0;

    private overlay: HTMLElement | null = null;
    private containerEl: HTMLElement | null = null;
    private titleEl: HTMLElement | null = null;
    private pendingEl: HTMLElement | null = null;
    private cardsEl: HTMLElement | null = null;
    private cardEls: HTMLButtonElement[] = [];
    /** Invoked when a player taps/clicks a skill card (select + confirm). */
    private onChoose: ((index: number) => void) | null = null;

    constructor(gameState: LevelUpGameState, paletteManager: PaletteManagerApi) {
        this.gameState = gameState;
        this.paletteManager = paletteManager;
    }

    /** Registers the callback fired when a skill card is tapped/clicked. */
    setChoiceHandler(handler: ((index: number) => void) | null): void {
        this.onChoose = handler;
    }

    /** Internal-px height to leave uncovered at the bottom (the inventory bar). */
    setBottomReserve(px = 0): void {
        this.bottomReserve = Number.isFinite(px) ? Math.max(0, px) : 0;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        const canvasEl = ctx.canvas;
        if (!this.gameState.isLevelUpOverlayActive?.() || !canvasEl.parentElement) {
            this.hide();
            return;
        }
        this.ensureOverlay(canvasEl.parentElement);
        this.positionOverlay(canvasEl);
        this.fill();
    }

    destroy(): void { this.overlay?.remove(); this.overlay = null; this.onChoose = null; }

    private ensureOverlay(parent: HTMLElement): void {
        if (this.overlay && this.overlay.parentElement === parent) return;

        const overlay = document.createElement('div');
        overlay.className = 'game-levelup-overlay';
        // Swallow taps on the backdrop so they never fall through to the canvas
        // pointer handler (which would pick a card by stale canvas geometry).
        const swallow = (ev: Event) => ev.stopPropagation();
        overlay.addEventListener('click', swallow);
        overlay.addEventListener('pointerdown', swallow);
        overlay.addEventListener('touchstart', swallow, { passive: true });

        const container = document.createElement('div');
        container.className = 'game-levelup';

        const title = document.createElement('div');
        title.className = 'game-levelup-title';

        const pending = document.createElement('div');
        pending.className = 'game-levelup-pending';

        const cards = document.createElement('div');
        cards.className = 'game-levelup-cards';

        container.appendChild(title);
        container.appendChild(pending);
        container.appendChild(cards);
        overlay.appendChild(container);

        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }
        parent.appendChild(overlay);

        this.overlay = overlay;
        this.containerEl = container;
        this.titleEl = title;
        this.pendingEl = pending;
        this.cardsEl = cards;
        this.cardEls = [];
    }

    private positionOverlay(canvasEl: HTMLCanvasElement): void {
        const overlay = this.overlay;
        const container = this.containerEl;
        if (!overlay || !container) return;

        const displayW = canvasEl.offsetWidth || canvasEl.width;
        const displayH = canvasEl.offsetHeight || canvasEl.height;
        const ratio = displayH / (canvasEl.height || 1);

        overlay.style.left = `${canvasEl.offsetLeft}px`;
        overlay.style.top = `${canvasEl.offsetTop}px`;
        overlay.style.width = `${displayW}px`;
        overlay.style.height = `${displayH}px`;
        overlay.style.display = 'block';

        // The panel covers everything except the inventory bar at the very bottom.
        // Sizing the base font to FONT_SIZE * ratio (the same the dialog uses) keeps
        // the pixel web font crisp at the canvas' display scale.
        container.style.top = '0';
        container.style.bottom = `${this.bottomReserve * ratio}px`;
        container.style.fontFamily = `"${FONT_NAME}", monospace`;
        container.style.fontSize = `${Math.max(8, FONT_SIZE * ratio)}px`;

        const accent = this.paletteManager.getColor(7) || '#FFF1E8';
        const accentStrong = this.paletteManager.getColor(13) || accent;
        container.style.setProperty('--levelup-accent', accent);
        container.style.setProperty('--levelup-accent-strong', accentStrong);
    }

    private fill(): void {
        const overlay = this.gameState.getLevelUpOverlay?.() ?? { active: false, choices: [], cursor: 0 };
        const choices = Array.isArray(overlay.choices) ? overlay.choices : [];
        const cursor = Number.isFinite(overlay.cursor) ? overlay.cursor : 0;

        if (this.titleEl) {
            this.titleEl.textContent = getText('skills.levelUpTitle', 'Level Up!');
        }

        if (this.pendingEl) {
            const pending = Math.max(0, this.gameState.getPendingLevelUpChoices?.() || 0);
            const pendingText = pending > 0 ? formatText('skills.pendingLabel', { value: pending }, '') : '';
            this.pendingEl.textContent = pendingText;
            this.pendingEl.style.display = pendingText ? 'block' : 'none';
        }

        this.renderCards(choices, cursor);
    }

    private renderCards(choices: LevelUpChoice[], cursor: number): void {
        const container = this.cardsEl;
        if (!container) return;

        choices.forEach((choice, index) => {
            let card = this.cardEls.at(index) ?? null;
            if (!card) {
                card = this.createCard(index);
                container.appendChild(card);
                this.cardEls[index] = card;
            }
            const nameEl = card.querySelector('.game-levelup-card-name');
            const descEl = card.querySelector('.game-levelup-card-desc');
            const name = choice.resolvedName
                || (choice.nameKey ? getText(choice.nameKey, choice.id || '') : (choice.id || ''));
            const description = choice.resolvedDescription
                || (choice.descriptionKey ? getText(choice.descriptionKey, '') : '');
            if (nameEl) nameEl.textContent = choice.icon ? `${choice.icon} ${name}` : name;
            if (descEl) descEl.textContent = description;
            card.classList.toggle('game-levelup-card--selected', index === cursor);
            card.style.display = 'flex';
        });

        for (let i = choices.length; i < this.cardEls.length; i++) {
            this.cardEls[i].style.display = 'none';
        }
    }

    private createCard(index: number): HTMLButtonElement {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'game-levelup-card';
        const choose = (ev: Event) => {
            ev.stopPropagation();
            ev.preventDefault();
            this.onChoose?.(index);
        };
        card.addEventListener('click', choose);
        card.addEventListener('touchstart', choose, { passive: false });

        const name = document.createElement('div');
        name.className = 'game-levelup-card-name';
        const desc = document.createElement('div');
        desc.className = 'game-levelup-card-desc';
        card.appendChild(name);
        card.appendChild(desc);
        return card;
    }

    private hide(): void {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
    }
}

export { RendererLevelUpOverlay };
