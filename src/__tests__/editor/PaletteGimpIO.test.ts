import { describe, it, expect } from 'vitest';
import { PaletteGimpIO } from '../../editor/modules/PaletteGimpIO';

describe('PaletteGimpIO', () => {
  // ─── parseGpl ─────────────────────────────────────────────────────────────

  it('returns empty array for empty input', () => {
    expect(PaletteGimpIO.parseGpl('')).toEqual([]);
  });

  it('skips header lines and comments', () => {
    const gpl = [
      'GIMP Palette',
      'Name: Test',
      'Columns: 4',
      '# comment',
      '255   0   0\tRed',
    ].join('\n');
    const result = PaletteGimpIO.parseGpl(gpl);
    expect(result).toEqual(['#FF0000']);
  });

  it('parses multiple color lines', () => {
    const gpl = '0 255 0\tGreen\n0 0 255\tBlue\n';
    const result = PaletteGimpIO.parseGpl(gpl);
    expect(result).toEqual(['#00FF00', '#0000FF']);
  });

  it('handles Windows-style CRLF line endings', () => {
    const gpl = 'GIMP Palette\r\nName: X\r\n0 128 255\r\n';
    const result = PaletteGimpIO.parseGpl(gpl);
    expect(result).toEqual(['#0080FF']);
  });

  it('clamps channel values > 255 to 255', () => {
    const gpl = '300 255 128\t';
    const result = PaletteGimpIO.parseGpl(gpl);
    expect(result).toEqual(['#FFFF80']); // 300→FF, 255→FF, 128→80
  });

  it('skips lines without valid RGB triplets', () => {
    const gpl = 'just text\n255 0\n0 0 0\tBlack';
    const result = PaletteGimpIO.parseGpl(gpl);
    expect(result).toEqual(['#000000']);
  });

  it('produces uppercase hex output', () => {
    const gpl = '10 20 30\t';
    const [color] = PaletteGimpIO.parseGpl(gpl);
    expect(color).toBe(color.toUpperCase());
  });

  // ─── exportGpl ────────────────────────────────────────────────────────────

  it('exports correct GIMP header', () => {
    const palette: string[] = Array<string>(16).fill('#FF0000');
    const output = PaletteGimpIO.exportGpl(palette);
    expect(output).toContain('GIMP Palette');
    expect(output).toContain('Name: Tiny RPG Studio export');
    expect(output).toContain('Columns: 16');
  });

  it('exports exactly 16 color lines', () => {
    const palette: string[] = Array<string>(16).fill('#AABBCC');
    const output = PaletteGimpIO.exportGpl(palette);
    const lines = output.trim().split('\n');
    // 4 header lines + 16 color lines
    expect(lines.length).toBe(20);
  });

  it('truncates to 16 colors when palette is larger', () => {
    const palette: string[] = Array<string>(20).fill('#112233');
    const output = PaletteGimpIO.exportGpl(palette);
    const colorLines = output.split('\n').slice(4, 20);
    expect(colorLines).toHaveLength(16);
  });

  it('exports correct RGB values from hex', () => {
    const palette: string[] = Array<string>(16).fill('#FF8000');
    const output = PaletteGimpIO.exportGpl(palette);
    expect(output).toContain('255');
    expect(output).toContain('128');
    expect(output).toContain('  0');
  });

  it('handles empty/invalid hex gracefully', () => {
    const palette: string[] = Array<string>(16).fill('');
    expect(() => PaletteGimpIO.exportGpl(palette)).not.toThrow();
  });

  it('round-trip: export then parse returns same colors', () => {
    const palette = [
      '#000000', '#1D2B53', '#7E2553', '#008751',
      '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
      '#FF004D', '#FFA300', '#FFEC27', '#00E436',
      '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
    ];
    const gpl = PaletteGimpIO.exportGpl(palette);
    const parsed = PaletteGimpIO.parseGpl(gpl);
    expect(parsed).toHaveLength(16);
    palette.forEach((hex, i) => {
      expect(parsed[i]).toBe(hex.toUpperCase());
    });
  });
});


