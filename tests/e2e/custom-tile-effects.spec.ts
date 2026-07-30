import { expect, test } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ShareDecoder } from '../../src/runtime/infra/share/ShareDecoder';

test('creates, assigns, shares, and exports a custom tile effect', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('[data-project-tab-button="appearance"]');
  await page.click('#custom-effect-open');
  await expect(page.locator('[data-base-effect-id="reflection-top"]')).toBeVisible();

  await page.click('[data-base-effect-id="caustic"]');
  await page.click('[data-base-effect-id="glow"]');
  await page.click('[data-base-effect-id="sparkle"]');
  await expect(page.locator('#custom-effect-color-control')).toBeVisible();
  await page.locator('#custom-effect-color').evaluate((input: HTMLInputElement) => {
    input.value = '#00ff7f';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const firstPreview = await page.locator('#custom-effect-preview').evaluate(
    (canvas: HTMLCanvasElement) => canvas.toDataURL(),
  );
  await page.waitForTimeout(360);
  const animatedPreview = await page.locator('#custom-effect-preview').evaluate(
    (canvas: HTMLCanvasElement) => canvas.toDataURL(),
  );
  expect(animatedPreview).not.toBe(firstPreview);
  await page.click('[data-remove-base-effect-id="glow"]');
  await page.click('[data-base-effect-id="glow"]');
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
  expect(new URL(shareUrl).hash).toMatch(/^#v\d+\./);
  const decodedShare = ShareDecoder.decodeShareCode(new URL(shareUrl).hash.slice(1)) as {
    customTileEffects?: Array<{ color?: string }>;
  } | null;
  expect(decodedShare?.customTileEffects?.[0]?.color).toBe('#00FF7F');

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
  const embeddedCode = html.match(/__TINY_RPG_SHARED_CODE\s*=\s*("[^"]+")/)?.[1];
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

test('exports and atomically imports a custom effects library without tile assignments', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('[data-project-tab-button="appearance"]');
  if (!await page.locator('#custom-effect-open').isVisible()) {
    await page.click('[data-project-tab-button="appearance"]');
  }
  await expect(page.locator('#custom-effect-open')).toBeVisible();

  const createEffect = async (name: string, baseEffectId: string) => {
    await page.click('#custom-effect-open');
    await page.click(`[data-base-effect-id="${baseEffectId}"]`);
    await page.fill('#custom-effect-name', name);
    await page.click('#custom-effect-save');
  };
  await createEffect('Ripple', 'calm-wave');
  await createEffect('Stars', 'sparkle');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#custom-effects-export-button'),
  ]);
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tiny-rpg-effects-pack-'));
  const effectsPath = path.join(temporaryDirectory, 'effects.json');
  await download.saveAs(effectsPath);
  const pack = JSON.parse(await fs.readFile(effectsPath, 'utf8')) as {
    effects: Array<Record<string, unknown>>;
  };
  expect(pack.effects.map((effect) => effect.name)).toEqual(['Ripple', 'Stars']);
  expect(pack.effects.every((effect) => !Object.hasOwn(effect, 'id'))).toBe(true);

  await page.locator('.tile-card[data-tile-id="0"] .sprite-edit-btn').click({ force: true });
  await page.selectOption('#pae-tile-effect', { label: 'Ripple' });
  await page.click('#pae-save');

  let resolveImported: (() => void) | undefined;
  const imported = new Promise<void>((resolve) => { resolveImported = resolve; });
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'alert') resolveImported?.();
    void dialog.accept();
  });
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('#custom-effects-import-button');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(effectsPath);
  await imported;

  await page.click('#custom-effect-open');
  await expect(page.locator('#custom-effect-saved .custom-effect-row > span')).toHaveText(['Ripple', 'Stars']);
  await expect(page.locator('[data-delete-custom-effect-id]')).toHaveCount(2);
  await page.click('#custom-effect-close');

  await page.locator('.tile-card[data-tile-id="0"] .sprite-edit-btn').click({ force: true });
  await expect(page.locator('#pae-tile-effect')).toHaveValue('none');
  await expect(page.locator('#pae-tile-effect option[value="custom:0"]')).toHaveText('Ripple');
  await expect(page.locator('#pae-tile-effect option[value="custom:1"]')).toHaveText('Stars');
});
