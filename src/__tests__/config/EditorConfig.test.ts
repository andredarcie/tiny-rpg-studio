import { describe, it, expect } from 'vitest';
import { EditorConfig } from '../../config/EditorConfig';
import { EditorConfigSchema } from '../../config/EditorConfigSchema';

describe('EditorConfig', () => {
  it('should expose the validated editor configuration', () => {
    expect(EditorConfig).toBeInstanceOf(EditorConfigSchema);
    expect(EditorConfig.canvas.width).toBe(384);
    expect(EditorConfig.canvas.height).toBe(384);
    expect(EditorConfig.preview.npcSize).toBe(48);
    expect(EditorConfig.preview.tileSize).toBe(64);
    expect(EditorConfig.grid.cellSize).toBe(48);
    expect(EditorConfig.history.maxStates).toBe(50);
    expect(EditorConfig.export.defaultFileName).toBe('my-rpg-game.html');
  });

  it('should return immutable copies from getters', () => {
    const canvas1 = EditorConfig.canvas;
    const canvas2 = EditorConfig.canvas;
    const grid1 = EditorConfig.grid;
    const grid2 = EditorConfig.grid;
    const history1 = EditorConfig.history;
    const history2 = EditorConfig.history;

    expect(canvas1).not.toBe(canvas2);
    expect(canvas1).toEqual(canvas2);
    expect(grid1).not.toBe(grid2);
    expect(grid1).toEqual(grid2);
    expect(history1).not.toBe(history2);
    expect(history1).toEqual(history2);
  });

  it('should export to JSON with expected values', () => {
    const json = EditorConfig.toJSON();

    expect(json.canvas).toEqual({ width: 384, height: 384 });
    expect(json.preview).toEqual({
      npcSize: 48,
      enemySize: 48,
      objectSize: 48,
      tileSize: 64,
    });
    expect(json.grid).toEqual({ cellSize: 48, lineColor: '#cccccc', lineWidth: 1 });
    expect(json.export).toEqual({ defaultFileName: 'my-rpg-game.html', mimeType: 'text/html' });
  });
});
