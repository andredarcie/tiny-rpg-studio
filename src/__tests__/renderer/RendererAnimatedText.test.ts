import { describe, expect, it, vi } from 'vitest';
import { RendererAnimatedText } from '../../runtime/adapters/renderer/RendererAnimatedText';

describe('RendererAnimatedText', () => {
  it('removes matched tags and combines properly nested effects', () => {
    const renderer = new RendererAnimatedText();
    const characters = renderer.parse('{wvy}A{shk}B{shk}{rbw}[CLR3]C[CLR3]{rbw}{wvy}');

    expect(renderer.toText(characters)).toBe('ABC');
    expect(characters[0].effects).toMatchObject({ wave: true, shake: false, rainbow: false });
    expect(characters[1].effects).toMatchObject({ wave: true, shake: true, rainbow: false });
    expect(characters[2].effects).toEqual({
      wave: true,
      shake: false,
      rainbow: true,
      rainbowOffset: 0,
      colorIndex: 3,
    });
  });

  it('supports the full zero-based palette range', () => {
    const renderer = new RendererAnimatedText();
    const characters = renderer.parse('[CLR0]A[CLR0][CLR15]B[CLR15]');

    expect(characters.map(({ effects }) => effects.colorIndex)).toEqual([0, 15]);
  });

  it('keeps unmatched and invalid tags as literal text', () => {
    const renderer = new RendererAnimatedText();
    const text = '{wvy}Hello [CLR16]world[CLR16]';

    expect(renderer.toText(renderer.parse(text))).toBe(text);
  });

  it('paints text safely and advances rainbow colors from the selected start', () => {
    const renderer = new RendererAnimatedText();
    const container = document.createElement('div');
    const palette = { getColor: vi.fn((index: number) => `rgb(${index}, ${index}, ${index})`) };
    const characters = renderer.parse('X[CLR3]{rbw}<A{rbw}[CLR3]');

    renderer.paint(container, characters, palette, 0);
    expect(container.textContent).toBe('X<A');
    expect(container.querySelector('img')).toBeNull();
    expect(Array.from(container.querySelectorAll('span')).every((span) => span.style.fontSize === 'inherit'))
      .toBe(true);
    expect(palette.getColor.mock.calls.map(([index]) => index)).toEqual([3, 4]);
    expect(Array.from(container.querySelectorAll('span')).slice(1).every((span) => span.style.color !== ''))
      .toBe(true);

    palette.getColor.mockClear();
    renderer.paint(container, characters, palette, 120);
    expect(palette.getColor.mock.calls.map(([index]) => index)).toEqual([4, 5]);
  });

  it('updates shake transforms on every shake frame', () => {
    const renderer = new RendererAnimatedText();
    const container = document.createElement('div');
    const palette = { getColor: () => '#fff' };
    const characters = renderer.parse('{shk}A{shk}');

    renderer.paint(container, characters, palette, 0);
    const firstTransform = container.querySelector('span')?.style.transform;
    renderer.paint(container, characters, palette, 50);

    expect(firstTransform).toBeTruthy();
    expect(container.querySelector('span')?.style.transform).not.toBe(firstTransform);
    expect(renderer.hasAnimation(characters)).toBe(true);
  });
});
