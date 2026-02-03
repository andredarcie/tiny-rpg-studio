import { describe, it, expect } from 'vitest';
import { GameConfig } from '../../config/GameConfig';
import { GameConfigSchema } from '../../config/GameConfigSchema';

describe('GameConfig', () => {
  it('should expose the validated game configuration', () => {
    expect(GameConfig).toBeInstanceOf(GameConfigSchema);
    expect(GameConfig.canvas.width).toBe(128);
    expect(GameConfig.canvas.height).toBe(152);
    expect(GameConfig.world.rows).toBe(3);
    expect(GameConfig.world.cols).toBe(3);
    expect(GameConfig.player.startLevel).toBe(1);
    expect(GameConfig.player.maxLevel).toBe(10);
    expect(GameConfig.enemy.vision.alertDuration).toBe(1000);
    expect(GameConfig.palette.colors).toHaveLength(16);
    expect(GameConfig.palette.colors[0]).toBe('#000000');
    expect(GameConfig.palette.colors[15]).toBe('#FFCCAA');
  });

  it('should return immutable copies from getters', () => {
    const canvas1 = GameConfig.canvas;
    const canvas2 = GameConfig.canvas;
    const enemy1 = GameConfig.enemy;
    const enemy2 = GameConfig.enemy;
    const palette1 = GameConfig.palette;
    const palette2 = GameConfig.palette;

    expect(canvas1).not.toBe(canvas2);
    expect(canvas1).toEqual(canvas2);
    expect(enemy1).not.toBe(enemy2);
    expect(enemy1.vision).not.toBe(enemy2.vision);
    expect(enemy1).toEqual(enemy2);
    expect(palette1).not.toBe(palette2);
    expect(palette1.colors).not.toBe(palette2.colors);
    expect(palette1.colors).toEqual(palette2.colors);
  });

  it('should export to JSON with expected values', () => {
    const json = GameConfig.toJSON();

    expect(json.canvas.width).toBe(128);
    expect(json.world.roomSize).toBe(8);
    expect(json.player.startX).toBe(1);
    expect(json.enemy.stealthMissChance).toBe(0.25);
    expect(json.hud.backgroundColor).toBe('#000000');
    expect(json.tiles.valueMax).toBe(255);
  });
});
