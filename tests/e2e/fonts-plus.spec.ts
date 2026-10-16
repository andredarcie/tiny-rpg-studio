import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import type { TinyRpgApi } from '../../src/runtime/infra/TinyRpgApi';

async function install(page: Page) {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('#btn-plugins');
  await page.fill('#plugins-query', 'Fonts+');
  await page.locator('.plugin-card[data-plugin-id="fonts-plus"] [data-action="install"]').click();
  await page.click('#plugins-modal .tiny-modal__close');
  await page.click('[data-project-tab-button="plugins"]');
  await expect(page.locator('.fonts-plus')).toBeVisible();
}

async function presentation(page: Page) {
  return page.evaluate(async () => {
    const { getGameFont } = await import('/src/runtime/adapters/renderer/FontPresentation.ts');
    const { bitmapFont } = await import('/src/runtime/adapters/renderer/BitmapFont.ts');
    const canvas = document.createElement('canvas');
    canvas.width = 180; canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Missing canvas');
    bitmapFont.drawText(ctx, 'Ágj Wi Café', 10, 12, 16);
    return { game: getGameFont(), editor: getComputedStyle(document.querySelector('.fonts-plus input') as Element).fontFamily,
      narrow: bitmapFont.measureText('iiii', 16), wide: bitmapFont.measureText('WWWW', 16),
      ink: [...ctx.getImageData(0, 0, 180, 60).data].some(value => value > 0), raster: canvas.toDataURL() };
  });
}

test('uploads, isolates all four targets, preserves styled faces, reloads, and removes fonts', async ({ page }) => {
  await install(page);
  await page.locator('.fonts-plus input[type=file]').setInputFiles('tests/fixtures/fonts/proportional-italic.ttf');
  await expect(page.locator('.fonts-plus-filename')).toHaveText('proportional-italic.ttf');
  await expect(page.getByLabel('Italic', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Italic', { exact: true })).toBeDisabled();
  for (const applyGame of [false, true]) for (const applyEditor of [false, true]) {
    await page.getByLabel('Apply to game', { exact: true }).setChecked(applyGame);
    await expect(page.getByLabel('Apply to game', { exact: true })).toBeEnabled();
    await page.getByLabel('Apply to editor', { exact: true }).setChecked(applyEditor);
    await expect(page.getByLabel('Apply to editor', { exact: true })).toBeEnabled();
    const result = await presentation(page);
    expect(result.game.family.includes('TinyRpgFont')).toBe(applyGame);
    expect(result.editor.includes('TinyRpgFont')).toBe(applyEditor);
    expect(result.ink).toBe(true);
    if (applyGame) expect(result.narrow).toBeLessThan(result.wide);
  }
  await page.reload();
  await page.click('button[data-tab="editor"]');
  await page.click('[data-project-tab-button="plugins"]');
  await expect(page.locator('.fonts-plus-filename')).toHaveText('proportional-italic.ttf');
  expect((await presentation(page)).game.family).toContain('TinyRpgFont');
  await page.getByRole('button', { name: 'Remove font', exact: true }).click();
  await expect(page.locator('.fonts-plus-filename')).toBeHidden();
  expect((await presentation(page)).game.family).toContain('PixelOperator');
  await page.click('[data-project-tab-button="export"]');
  await expect(page.locator('#btn-generate-url')).toBeDisabled();
});

test('loads real variable styles without synthesis and exports a working font offline', async ({ page, browser }, testInfo) => {
  await install(page);
  await page.locator('.fonts-plus input[type=file]').setInputFiles('tests/fixtures/fonts/pixel-variable.ttf');
  await expect(page.locator('.fonts-plus-filename')).toHaveText('pixel-variable.ttf');
  const normal = await presentation(page);
  await page.getByLabel('Bold', { exact: true }).check();
  await expect(page.getByLabel('Bold', { exact: true })).toBeEnabled();
  await page.getByLabel('Italic', { exact: true }).check();
  await expect(page.getByLabel('Italic', { exact: true })).toBeEnabled();
  const styled = await presentation(page);
  expect(styled.game.weight).toBe('700');
  expect(styled.game.style).toBe('italic');
  expect(styled.wide).toBeGreaterThanOrEqual(normal.wide);
  expect(styled.raster).not.toBe(normal.raster);
  await page.screenshot({ path: testInfo.outputPath('fonts-plus-editor.png') });
  for (const applyGame of [false, true]) {
    await page.getByLabel('Apply to game', { exact: true }).setChecked(applyGame);
    await expect(page.getByLabel('Apply to game', { exact: true })).toBeEnabled();
    await page.click('[data-project-tab-button="export"]');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-generate-html')]);
    const filename = testInfo.outputPath(`font-game-${applyGame}.html`);
    await download.saveAs(filename);
    const offline = await browser.newContext({ offline: true });
    const exported = await offline.newPage();
    await exported.goto(`file:///${path.resolve(filename).replaceAll('\\', '/')}`);
    await exported.waitForFunction(() => Boolean((globalThis as unknown as { __TINY_RPG_API?: TinyRpgApi }).__TINY_RPG_API));
    expect(await exported.evaluate(() => [...document.fonts].some(face => face.family.startsWith('TinyRpgFont') && face.status === 'loaded'))).toBe(true);
    expect(await exported.evaluate(() => document.body.hasAttribute('data-editor-custom-font'))).toBe(false);
    await exported.evaluate(() => {
      const api = (globalThis as unknown as { __TINY_RPG_API: TinyRpgApi['runtime'] }).__TINY_RPG_API;
      api?.dismissIntroScreen();
      api?.showDialog('{rbw}Café Ágj{rbw} {shk}Wi{shk} [CLR15]é[CLR15] \\ Next page');
      api?.completeDialog();
      api?.draw();
    });
    await expect(exported.locator('.game-dialog-text')).toBeVisible();
    const family = await exported.locator('.game-dialog-text').evaluate(el => getComputedStyle(el).fontFamily);
    expect(family.includes('TinyRpgFont')).toBe(applyGame);
    await expect(exported.locator('.game-dialog-text')).toContainText('Café Ágj');
    await exported.screenshot({ path: testInfo.outputPath(`fonts-plus-offline-${applyGame}.png`) });
    await offline.close();
    await page.click('[data-project-tab-button="plugins"]');
  }
});

test('restores fonts through history and project switches, honors fallback refreshes, and cleans up uninstall', async ({ page }) => {
  await install(page);
  await page.locator('.fonts-plus input[type=file]').setInputFiles('tests/fixtures/fonts/proportional-italic.ttf');
  await expect(page.locator('.fonts-plus-filename')).toHaveText('proportional-italic.ttf');
  await page.getByLabel('Apply to editor', { exact: true }).uncheck();
  await expect(page.getByLabel('Apply to editor', { exact: true })).toBeEnabled();
  await page.locator('.fonts-plus-filename').click();
  await page.keyboard.press('Control+z');
  await expect(page.getByLabel('Apply to editor', { exact: true })).toBeChecked();
  await page.keyboard.press('Control+y');
  await expect(page.getByLabel('Apply to editor', { exact: true })).not.toBeChecked();
  await page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    const api = getTinyRpgApi();
    const saved = api?.exportGameData();
    const other = structuredClone(saved);
    delete other.fontsPlus;
    other.gameplayPlugins = [];
    await api?.loadProjectData(other);
    if (document.body.hasAttribute('data-editor-custom-font')) throw Error('Editor font leaked across projects');
    await api?.loadProjectData(saved);
    api?.runtime?.setDisablePixelFont(true);
    api?.renderAll();
    for (let i = 0; i < 3; i++) api?.draw();
  });
  expect((await presentation(page)).game.family).toContain('TinyRpgFont');
  await page.getByLabel('Apply to game', { exact: true }).uncheck();
  await expect(page.getByLabel('Apply to game', { exact: true })).toBeEnabled();
  expect((await presentation(page)).game.family).toBe('monospace');
  await page.click('#btn-plugins');
  await page.click('#plugins-manage');
  await page.locator('[data-plugin-id="fonts-plus"] [data-action="remove"]').click();
  await page.click('#plugins-modal .tiny-modal__close');
  await expect(page.locator('.fonts-plus')).toHaveCount(0);
  expect(await page.evaluate(() => [...document.fonts].some(face => face.family.startsWith('TinyRpgFont')))).toBe(false);
  await page.click('[data-project-tab-button="export"]');
  await expect(page.locator('#btn-generate-url')).toBeEnabled();
});
