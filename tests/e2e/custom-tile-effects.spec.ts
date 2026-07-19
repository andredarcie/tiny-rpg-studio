import { expect, test } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

test('creates, assigns, shares, and exports a custom tile effect', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('[data-project-tab-button="appearance"]');
  await page.click('#custom-effect-open');
  await expect(page.locator('[data-base-effect-id="reflection-top"]')).toBeVisible();

  await page.click('[data-base-effect-id="caustic"]');
  await page.click('[data-base-effect-id="sparkle"]');
  const firstPreview = await page.locator('#custom-effect-preview').evaluate(
    (canvas: HTMLCanvasElement) => canvas.toDataURL(),
  );
  await page.waitForTimeout(360);
  const animatedPreview = await page.locator('#custom-effect-preview').evaluate(
    (canvas: HTMLCanvasElement) => canvas.toDataURL(),
  );
  expect(animatedPreview).not.toBe(firstPreview);
  await page.click('[data-remove-base-effect-id="caustic"]');
  await page.click('[data-base-effect-id="caustic"]');
  await page.fill('#custom-effect-name', 'Magic FX');
  await page.click('#custom-effect-save');

  await page.locator('.tile-card[data-tile-id="0"] .sprite-edit-btn').click({ force: true });
  await expect(page.locator('#pae-tile-effect option')).toContainText(['None', 'Water', 'Lava', 'Magic FX']);
  await page.selectOption('#pae-tile-effect', { label: 'Magic FX' });
  await page.click('#pae-save');

  await page.click('[data-project-tab-button="export"]');
  await page.click('#btn-generate-url');
  await expect(page.locator('#project-share-url')).not.toHaveValue('');
  const shareUrl = await page.locator('#project-share-url').inputValue();
  expect(shareUrl).toContain('#v11.');

  await page.goto(shareUrl);
  await page.click('button[data-tab="editor"]');
  await page.locator('.tile-card[data-tile-id="0"] .sprite-edit-btn').click({ force: true });
  await expect(page.locator('#pae-tile-effect')).toHaveValue('custom:0');
  await expect(page.locator('#pae-tile-effect option[value="custom:0"]')).toHaveText('Magic FX');
  await page.click('#pae-close');

  await page.click('[data-project-tab-button="export"]');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#btn-generate-html').click({ force: true }),
  ]);
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tiny-rpg-custom-fx-'));
  const exportedPath = path.join(temporaryDirectory, 'game.html');
  await download.saveAs(exportedPath);
  const html = await fs.readFile(exportedPath, 'utf8');
  const embeddedCode = html.match(/__TINY_RPG_SHARED_CODE = ("[^"]+")/)?.[1];
  expect(embeddedCode).toBeDefined();
  expect(JSON.parse(embeddedCode ?? '""')).toBe(new URL(shareUrl).hash.slice(1));

  await page.click('[data-project-tab-button="appearance"]');
  await page.click('#custom-effect-open');
  await page.click('[data-delete-custom-effect-id="custom:0"]');
  await expect(page.locator('[data-delete-custom-effect-id="custom:0"]')).toHaveCount(0);
  await page.click('#custom-effect-close');
  await page.locator('.tile-card[data-tile-id="0"] .sprite-edit-btn').click({ force: true });
  await expect(page.locator('#pae-tile-effect')).toHaveValue('none');
  await expect(page.locator('#pae-tile-effect option[value="custom:0"]')).toHaveCount(0);
  await page.click('#pae-close');

  await page.click('[data-project-tab-button="export"]');
  await page.click('#btn-generate-url');
  const cleanedShareUrl = await page.locator('#project-share-url').inputValue();
  await page.goto(cleanedShareUrl);
  await page.click('button[data-tab="editor"]');
  await page.click('[data-project-tab-button="appearance"]');
  await page.click('#custom-effect-open');
  await expect(page.locator('[data-delete-custom-effect-id]')).toHaveCount(0);
});
