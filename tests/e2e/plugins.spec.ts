import { expect, test } from '@playwright/test';
import path from 'node:path';

for (const width of [1280, 800]) {
  test(`example plugin import, reload and removal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.click('button[data-tab="editor"]');
    await expect(page.locator('.tile-card').first()).toBeVisible();
    await page.evaluate(() => {
      const root = document.querySelector('#tab-editor')!;
      const panel = root.querySelector('.editor-section--tiles')!;
      Reflect.set(window, 'originalTiles', panel);
    });
    await page.click('#btn-plugins');
    await expect(page.locator('#plugins-trust')).toBeVisible();
    await page.setInputFiles('#plugins-file', path.resolve('examples/plugin-preview.html'));
    await expect(page.locator('.plugin-card[data-plugin-id="example-plugin"]')).toBeVisible();
    await page.click('#plugins-modal .tiny-modal__close');
    await expect(page.locator('.editor-right > .editor-section--tiles:first-child')).toHaveCount(1);
    await expect(page.locator('.editor-left > .editor-section--npcs:first-child')).toHaveCount(1);
    expect(await page.evaluate(() => Reflect.get(window, 'originalTiles') === document.querySelector('.editor-section--tiles'))).toBe(true);
    await expect(page.locator('.editor-section--world')).toBeHidden();
    await expect(page.locator('#example-plugin-toggle')).toHaveCount(0);
    if (width <= 920) {
      await page.click('[data-mobile-target="npcs"]');
      await expect(page.locator('.editor-section--npcs')).toBeVisible();
      await expect(page.locator('.editor-section--tiles')).toBeHidden();
    }
    await page.locator('.npc-card .sprite-edit-btn').first().click({ force: true });
    await expect(page.locator('#pae-close')).toBeVisible();
    await page.click('#pae-close');
    if (width <= 920) await page.click('[data-mobile-target="tiles"]');
    await page.locator('.tile-card .sprite-edit-btn').first().click({ force: true });
    await expect(page.locator('#pae-close')).toBeVisible();
    await page.click('#pae-close');
    await page.reload();
    await page.click('button[data-tab="editor"]');
    await expect(page.locator('#example-plugin-toggle')).toHaveCount(0);
    await expect(page.locator('.editor-right > .editor-section--tiles:first-child')).toHaveCount(1);
    await expect(page.locator('.editor-section--world')).toBeHidden();
    await page.click('#btn-plugins');
    await page.click('#plugins-manage');
    await page.click('[data-plugin-id="example-plugin"] .plugin-action');
    await page.click('#plugins-modal .tiny-modal__close');
    await expect(page.locator('#example-plugin-toggle')).toHaveCount(0);
    await expect(page.locator('.editor-left > .editor-section--tiles')).toHaveCount(1);
    await expect(page.locator('.editor-right > .editor-section--npcs')).toHaveCount(1);
    if (width <= 920) await page.click('[data-mobile-target="world"]');
    await expect(page.locator('.editor-section--world')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tiny-rpg-plugins-v1') ?? '[]'))).toEqual([]);
  });
}
