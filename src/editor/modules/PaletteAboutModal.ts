/**
 * PaletteAboutModal — explains how a palette preset re-colours the engine.
 *
 * Picking a palette is not "load 16 new colours in order": every engine slot has
 * a fixed job (slot 3 paints grass, slot 7 draws HUD text) and a preset states,
 * per colour, which job it takes over. That indirection is invisible in the
 * palette grid, so this modal lays the two sides next to each other — the
 * PICO-8 colour a slot starts with, and the colour the chosen palette puts there.
 *
 * Uses the shared {@link Modal} shell over a static template in index.html,
 * with the mapping body rendered from PALETTE_PRESETS on first open.
 *
 * The mapping is read through `resolvePresetSlots`, the same function the editor
 * uses to apply a preset, so this screen cannot drift away from what a click on
 * the preset dropdown actually does.
 */
import { track } from '../../analytics/track';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';
import { PALETTE_PRESETS, resolvePresetSlots } from '../../runtime/domain/definitions/PalettePresets';
import { TextResources } from '../../runtime/adapters/TextResources';
import { Modal } from '../../ui/Modal';

/**
 * What each engine slot is for. These are the PICO-8 colour names, kept in
 * English because they are the palette's own proper nouns — the pixel-art
 * community refers to "slot 8 / red" the same way in every language.
 *
 * They must stay identical to the names the PICO-8 preset gives its own colours,
 * or this screen would label a slot differently from the palette it describes.
 * A test in PalettePresets.test.ts pins the two together.
 */
const SLOT_ROLES: readonly string[] = [
    'black', 'dark blue', 'dark purple', 'dark green',
    'brown', 'dark gray', 'light gray', 'off white',
    'red', 'orange', 'yellow', 'green',
    'blue', 'lavender', 'pink', 'peach',
];

/** Slots whose job is worth calling out, because a wrong colour here is visible. */
const NOTABLE_ROLES: Readonly<Record<number, string>> = {
    3: 'paletteAbout.role.grass',
    7: 'paletteAbout.role.text',
    8: 'paletteAbout.role.hearts',
};

class PaletteAboutModal {
    private button: HTMLButtonElement | null;
    private modal: Modal | null;
    private baseHost: HTMLElement | null;
    private listHost: HTMLElement | null;
    private rendered = false;

    private boundOpen = () => this.open();
    private boundLanguageChange = () => {
        // The static shell re-hydrates itself from data-text-key, but the rows here
        // are built in code. Without this the two halves disagree while the modal is
        // open: a translated heading above English role labels.
        this.rendered = false;
        if (this.modal?.isOpen) {
            this.render();
            this.rendered = true;
        }
    };

    constructor() {
        this.button = document.getElementById('palette-about-button') as HTMLButtonElement | null;
        const root = document.getElementById('palette-about-modal');
        this.modal = root ? new Modal({ root, labelledBy: 'palette-about-title' }) : null;
        this.baseHost = document.getElementById('palette-about-base');
        this.listHost = document.getElementById('palette-about-list');
        this.bind();
    }

    private t(key: string, fallback: string): string {
        const value = TextResources.get(key, fallback) as string;
        return value || fallback;
    }

    private bind(): void {
        this.button?.addEventListener('click', this.boundOpen);
        document.addEventListener('language-changed', this.boundLanguageChange);
    }

    open(): void {
        if (!this.modal) return;
        // Rendered lazily: the mapping is static, so building it on first open keeps
        // it off the editor's initialization path.
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
        this.modal.open();
        track('palette_about_opened');
    }

    close(): void {
        this.modal?.close();
    }

    private render(): void {
        this.renderBaseSlots();
        this.renderPresetMappings();
    }

    /** The 16 PICO-8 slots the engine starts from, with the job each one holds. */
    private renderBaseSlots(): void {
        if (!this.baseHost) return;
        this.baseHost.innerHTML = '';

        TileDefinitions.PICO8_COLORS.forEach((hex, index) => {
            const cell = document.createElement('div');
            cell.className = 'palette-about__base-cell';

            const swatch = document.createElement('span');
            swatch.className = 'palette-about__swatch';
            swatch.style.backgroundColor = hex;

            const meta = document.createElement('span');
            meta.className = 'palette-about__base-meta';

            const idx = document.createElement('strong');
            idx.className = 'palette-about__slot-index';
            idx.textContent = String(index);

            const role = document.createElement('span');
            role.className = 'palette-about__role';
            role.textContent = SLOT_ROLES[index] ?? '';

            meta.append(idx, role);

            const noteKey = NOTABLE_ROLES[index];
            if (noteKey) {
                const note = document.createElement('span');
                note.className = 'palette-about__note';
                note.textContent = this.t(noteKey, '');
                meta.appendChild(note);
            }

            const hexLabel = document.createElement('span');
            hexLabel.className = 'palette-about__hex';
            hexLabel.textContent = hex;
            meta.appendChild(hexLabel);

            cell.append(swatch, meta);
            this.baseHost?.appendChild(cell);
        });
    }

    /** One block per preset: for every slot, the base colour above its replacement. */
    private renderPresetMappings(): void {
        if (!this.listHost) return;
        this.listHost.innerHTML = '';

        const unchangedLabel = this.t('paletteAbout.unchanged', 'unchanged');

        PALETTE_PRESETS.forEach((preset) => {
            const slots = resolvePresetSlots(preset, TileDefinitions.PICO8_COLORS);

            const block = document.createElement('section');
            block.className = 'palette-about__preset';

            const name = document.createElement('h4');
            name.className = 'palette-about__preset-name';
            name.textContent = preset.name;
            block.appendChild(name);

            // A preset that claims no slot at all is the base palette itself. Say so,
            // otherwise a full row of dimmed "=" cells reads as a rendering failure.
            if (slots.every((slot) => slot.sourceName === null)) {
                const note = document.createElement('span');
                note.className = 'palette-about__preset-note';
                note.textContent = this.t('paletteAbout.isBase', 'this is the base — nothing is replaced');
                name.appendChild(note);
            }

            const row = document.createElement('div');
            row.className = 'palette-about__row';

            slots.forEach((slot) => {
                const unchanged = slot.sourceName === null;

                const cell = document.createElement('div');
                cell.className = 'palette-about__map-cell';
                // The cell is a picture of one slot's before/after. Without an explicit
                // role, the aria-label below is dropped by most screen readers, which
                // would leave the whole mapping unreadable to them.
                cell.setAttribute('role', 'img');
                if (unchanged) cell.classList.add('palette-about__map-cell--unchanged');

                const from = document.createElement('span');
                from.className = 'palette-about__swatch palette-about__swatch--from';
                from.style.backgroundColor = slot.baseHex;

                const arrow = document.createElement('span');
                arrow.className = 'palette-about__arrow';
                arrow.textContent = unchanged ? '=' : '↓';

                const to = document.createElement('span');
                to.className = 'palette-about__swatch palette-about__swatch--to';
                to.style.backgroundColor = slot.hex;

                const idx = document.createElement('span');
                idx.className = 'palette-about__slot-index';
                idx.textContent = String(slot.index);

                // The whole story for one slot, for hover and for screen readers.
                const role = SLOT_ROLES[slot.index] ?? String(slot.index);
                const description = unchanged
                    ? `${preset.name} — ${role}: ${slot.baseHex} ${unchangedLabel}`
                    : `${preset.name} — ${role}: ${slot.baseHex} → ${slot.hex} (${slot.sourceName ?? ''})`;
                cell.title = description;
                cell.setAttribute('aria-label', description);

                cell.append(idx, from, arrow, to);
                row.appendChild(cell);
            });

            block.appendChild(row);
            this.listHost?.appendChild(block);
        });
    }

    destroy(): void {
        this.button?.removeEventListener('click', this.boundOpen);
        this.modal?.destroy();
        document.removeEventListener('language-changed', this.boundLanguageChange);
    }
}

export { PaletteAboutModal, SLOT_ROLES };
