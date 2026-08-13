type AnimatedTextEffects = {
    wave: boolean;
    shake: boolean;
    rainbow: boolean;
    rainbowOffset: number;
    colorIndex: number | null;
};

type AnimatedCharacter = {
    value: string;
    effects: AnimatedTextEffects;
};

type PaletteColorApi = {
    getColor: (index: number) => string;
};

type TextToken = {
    kind: 'text';
    raw: string;
};

type TagToken = {
    kind: 'tag';
    raw: string;
    key: string;
    effect: 'wave' | 'shake' | 'rainbow' | 'color';
    colorIndex: number | null;
    matched: boolean;
    opening: boolean;
};

type Token = TextToken | TagToken;

const TAG_PATTERN = /\{(?:wvy|shk|rbw)\}|\[CLR(?:[0-9]|1[0-5])\]/g;
const RAINBOW_STEP_MS = 120;
const SHAKE_STEP_MS = 50;
const PALETTE_SIZE = 16;

const NO_EFFECTS: AnimatedTextEffects = {
    wave: false,
    shake: false,
    rainbow: false,
    rainbowOffset: 0,
    colorIndex: null,
};

function createPlainCharacter(value: string): AnimatedCharacter {
    return { value, effects: NO_EFFECTS };
}

class RendererAnimatedText {
    private container: HTMLElement | null = null;
    private renderedCharacters: AnimatedCharacter[] = [];
    private characterElements: Array<HTMLSpanElement | null> = [];

    parse(text: string): AnimatedCharacter[] {
        const tokens = this.tokenize(text);
        this.matchTags(tokens);

        let waveDepth = 0;
        let shakeDepth = 0;
        let rainbowDepth = 0;
        let rainbowOffset = 0;
        const colors: Array<{ index: number; rainbowStart: number | null }> = [];
        const characters: AnimatedCharacter[] = [];

        const appendLiteral = (value: string) => {
            for (const character of Array.from(value)) {
                characters.push({
                    value: character,
                    effects: {
                        wave: waveDepth > 0,
                        shake: shakeDepth > 0,
                        rainbow: rainbowDepth > 0,
                        rainbowOffset: rainbowDepth > 0
                            ? rainbowOffset - (colors.at(-1)?.rainbowStart ?? 0)
                            : 0,
                        colorIndex: colors.at(-1)?.index ?? null,
                    },
                });
                if (rainbowDepth > 0) rainbowOffset++;
            }
        };

        for (const token of tokens) {
            if (token.kind === 'text' || !token.matched) {
                appendLiteral(token.raw);
                continue;
            }

            const direction = token.opening ? 1 : -1;
            if (token.effect === 'wave') waveDepth += direction;
            if (token.effect === 'shake') shakeDepth += direction;
            if (token.effect === 'rainbow') {
                if (token.opening) {
                    rainbowOffset = 0;
                    colors.forEach((color) => { color.rainbowStart = 0; });
                }
                rainbowDepth += direction;
            }
            if (token.effect === 'color') {
                if (token.opening && token.colorIndex !== null) {
                    colors.push({
                        index: token.colorIndex,
                        rainbowStart: rainbowDepth > 0 ? rainbowOffset : null,
                    });
                }
                else colors.pop();
            }
        }

        return characters;
    }

    paint(
        container: HTMLElement,
        characters: AnimatedCharacter[],
        palette: PaletteColorApi,
        timestamp: number,
    ): void {
        if (this.container !== container || !this.sameCharacters(characters)) {
            this.rebuild(container, characters);
        }

        const rainbowFrame = Math.floor(timestamp / RAINBOW_STEP_MS);
        const shakeFrame = Math.floor(timestamp / SHAKE_STEP_MS);
        characters.forEach((character, index) => {
            const span = this.characterElements[index];
            if (!span) return;

            const { effects } = character;
            if (effects.rainbow) {
                const start = effects.colorIndex ?? 0;
                span.style.color = palette.getColor(
                    (start + effects.rainbowOffset + rainbowFrame) % PALETTE_SIZE,
                );
            } else if (effects.colorIndex !== null) {
                span.style.color = palette.getColor(effects.colorIndex);
            } else {
                span.style.color = '';
            }

            let x = 0;
            let y = 0;
            if (effects.wave) y += Math.sin(timestamp / 180 + index * 0.65) * 0.14;
            if (effects.shake) {
                x += this.shakeOffset(index, shakeFrame, 17) * 0.06;
                y += this.shakeOffset(index, shakeFrame, 43) * 0.06;
            }
            span.style.transform = x || y ? `translate(${x.toFixed(3)}em, ${y.toFixed(3)}em)` : '';
        });
    }

    clear(container?: HTMLElement): void {
        const target = container ?? this.container;
        target?.replaceChildren();
        this.container = target ?? null;
        this.renderedCharacters = [];
        this.characterElements = [];
    }

    hasAnimation(characters: AnimatedCharacter[]): boolean {
        return characters.some(({ effects }) => effects.wave || effects.shake || effects.rainbow);
    }

    toText(characters: AnimatedCharacter[]): string {
        return characters.map(({ value }) => value).join('');
    }

    private tokenize(text: string): Token[] {
        const tokens: Token[] = [];
        let cursor = 0;
        TAG_PATTERN.lastIndex = 0;
        for (const match of text.matchAll(TAG_PATTERN)) {
            const index = match.index;
            if (index > cursor) tokens.push({ kind: 'text', raw: text.slice(cursor, index) });
            tokens.push(this.createTagToken(match[0]));
            cursor = index + match[0].length;
        }
        if (cursor < text.length) tokens.push({ kind: 'text', raw: text.slice(cursor) });
        return tokens;
    }

    private createTagToken(raw: string): TagToken {
        if (raw === '{wvy}') {
            return { kind: 'tag', raw, key: 'wave', effect: 'wave', colorIndex: null, matched: false, opening: false };
        }
        if (raw === '{shk}') {
            return { kind: 'tag', raw, key: 'shake', effect: 'shake', colorIndex: null, matched: false, opening: false };
        }
        if (raw === '{rbw}') {
            return { kind: 'tag', raw, key: 'rainbow', effect: 'rainbow', colorIndex: null, matched: false, opening: false };
        }
        const colorIndex = Number(raw.slice(4, -1));
        return {
            kind: 'tag',
            raw,
            key: `color:${colorIndex}`,
            effect: 'color',
            colorIndex,
            matched: false,
            opening: false,
        };
    }

    private matchTags(tokens: Token[]): void {
        const stack: Array<{ key: string; token: TagToken }> = [];
        for (const token of tokens) {
            if (token.kind !== 'tag') continue;
            const top = stack.at(-1);
            if (top?.key === token.key) {
                top.token.matched = true;
                top.token.opening = true;
                token.matched = true;
                stack.pop();
                continue;
            }
            if (!stack.some(({ key }) => key === token.key)) {
                stack.push({ key: token.key, token });
            }
        }
    }

    private sameCharacters(characters: AnimatedCharacter[]): boolean {
        return characters.length === this.renderedCharacters.length
            && characters.every((character, index) => character === this.renderedCharacters[index]);
    }

    private rebuild(container: HTMLElement, characters: AnimatedCharacter[]): void {
        const fragment = document.createDocumentFragment();
        const elements: Array<HTMLSpanElement | null> = [];
        for (const character of characters) {
            if (character.value === '\n') {
                fragment.appendChild(document.createTextNode('\n'));
                elements.push(null);
                continue;
            }
            const span = document.createElement('span');
            span.textContent = character.value;
            span.style.fontSize = 'inherit';
            if (character.effects.wave || character.effects.shake) span.style.display = 'inline-block';
            fragment.appendChild(span);
            elements.push(span);
        }
        container.replaceChildren(fragment);
        this.container = container;
        this.renderedCharacters = characters.slice();
        this.characterElements = elements;
    }

    private shakeOffset(index: number, frame: number, salt: number): number {
        return (index * 17 + frame * salt) % 3 - 1;
    }
}

export { RendererAnimatedText, createPlainCharacter };
export type { AnimatedCharacter, PaletteColorApi };
