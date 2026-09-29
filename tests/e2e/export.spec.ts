import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const collectErrors = () => {
  const errors: string[] = [];
  return {
    errors,
    attach(page: import('@playwright/test').Page) {
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
    },
  };
};

test('exported html boots without module import errors', async ({ page, context }) => {
  const editorErrors = collectErrors();
  editorErrors.attach(page);

  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await expect(page.locator('.tile-card').first()).toBeVisible();
  await page.click('button[data-project-tab-button="export"]');
  await expect(page.locator('#btn-generate-html')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#btn-generate-html').click({ force: true }),
  ]);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiny-rpg-export-'));
  const filePath = path.join(tmpDir, 'index.html');
  await download.saveAs(filePath);
  const html = await fs.readFile(filePath, 'utf8');

  expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(510_000);
  expect(html.match(/data:font\/woff;base64,/g)).toHaveLength(1);
  expect(html).not.toContain('project.generateHTML');
  expect(html).not.toContain('editor.mobileNav');

  const exportedPage = await context.newPage();
  const exportErrors = collectErrors();
  exportErrors.attach(exportedPage);

  await exportedPage.goto(`file://${filePath}`);
  await exportedPage.waitForFunction(() => (window as WindowWithExportMode).__TINY_RPG_EXPORT_MODE === true);

  const importError = exportErrors.errors.find((err) =>
    err.includes('Cannot use import statement outside a module'),
  );
  const relevantExportErrors = exportErrors.errors.filter(
    (err) => !(err.includes('version.json') && err.includes('file:')),
  );

  expect(await exportedPage.locator('#game-canvas').count()).toBe(1);
  expect(await exportedPage.locator('#btn-export-reset').count()).toBe(1);
  expect(await exportedPage.locator('#game-fullscreen-toggle').count()).toBe(1);
  expect(importError).toBeUndefined();
  expect(relevantExportErrors).toEqual([]);
  expect(editorErrors.errors).toEqual([]);
});

type WindowWithExportMode = Window & {
  __TINY_RPG_EXPORT_MODE?: boolean;
};

test('rectangular gameplay plugin project saves, imports and boots from offline HTML', async ({ page, context, browser }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tiny-rpg-plugins-v1', JSON.stringify([{
      id: 'test-maps', version: '1', title: 'Test maps', shortDescription: 'Maps', fullDescription: 'Maps',
      capabilities: ['editor', 'gameplay'],
      payload: {
        apiVersion: 1,
        javascript: 'export function activate({editorRoot,api,onCleanup}) { const button=document.createElement("button"); button.id="test-resize-world"; button.onclick=()=>api.resizeWorld(3,5,"test-maps"); editorRoot.append(button); onCleanup(()=>button.remove()); }',
        gameplayJavascript: 'export function activate({onCleanup}) { globalThis.__testMapsActive=true; onCleanup(()=>{delete globalThis.__testMapsActive}); }',
      },
    }]));
  });
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.locator('#test-resize-world').click();
  await expect(page.locator('.world-cell')).toHaveCount(15);
  await page.locator('#btn-manual-save').click();
  await expect.poll(() => page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem('tiny-rpg-projects-history') ?? '{}') as { projects?: { shareUrl: string }[] };
    return history.projects?.[0]?.shareUrl.startsWith('snapshot:') ?? false;
  })).toBe(true);
  await page.reload();
  await page.click('button[data-tab="editor"]');
  await expect(page.locator('.world-cell')).toHaveCount(15);
  await page.click('button[data-project-tab-button="export"]');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#btn-generate-html').click({ force: true }),
  ]);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiny-rpg-gameplay-export-'));
  const filePath = path.join(tmpDir, 'index.html');
  await download.saveAs(filePath);
  const html = await fs.readFile(filePath, 'utf8');
  expect(html).toContain('tiny-rpg-project');
  expect(html).toContain('"rows":3,"cols":5');
  expect(html).not.toContain('location.hash="#"');

  const importContext = await browser.newContext();
  const importedPage = await importContext.newPage();
  await importedPage.goto('/');
  await importedPage.click('button[data-tab="editor"]');
  await expect(importedPage.locator('.tile-card').first()).toBeVisible();
  await importedPage.locator('input[type="file"][accept=".html"]').setInputFiles(filePath);
  await expect(importedPage.locator('.world-cell')).toHaveCount(15);
  expect(await importedPage.evaluate(() => JSON.parse(localStorage.getItem('tiny-rpg-plugins-v1') ?? '[]') as { id: string }[])).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'test-maps' })]));
  await importContext.close();

  const exportedPage = await context.newPage();
  await exportedPage.goto(`file://${filePath}`);
  await exportedPage.waitForFunction(() => (window as Window & { __testMapsActive?: boolean }).__testMapsActive === true);
  await expect(exportedPage.locator('#btn-open-studio')).toBeHidden();
  await exportedPage.locator('#btn-export-reset').click();
  expect(await exportedPage.evaluate(() => (window as Window & { __testMapsActive?: boolean }).__testMapsActive)).toBe(true);
});

for (const [rows, cols] of [[3, 5], [4, 3]]) {
  test(`Maps+ exports a ${rows}×${cols} world from its size controls`, async ({ page, context }) => {
    await page.goto('/');
    await page.click('button[data-tab="editor"]');
    await page.click('#btn-plugins');
    await page.setInputFiles('#plugins-file', path.resolve('examples/maps-plus.html'));
    await expect(page.locator('.plugin-card[data-plugin-id="maps-plus"]')).toBeVisible();
    await page.click('#plugins-modal .tiny-modal__close');

    await page.locator('.world-panel .maps-plus-controls select[aria-label="Rows"]').selectOption(String(rows));
    await page.locator('.world-panel .maps-plus-controls select[aria-label="Columns"]').selectOption(String(cols));
    await page.locator('.world-panel .maps-plus-controls button').click();
    await expect(page.locator('.world-cell')).toHaveCount(rows * cols);
    await expect(page.locator('.world-panel .maps-plus-status')).toContainText(`${rows} × ${cols}`);

    await page.click('button[data-project-tab-button="export"]');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btn-generate-html').click(),
    ]);
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiny-rpg-maps-plus-'));
    const filePath = path.join(tmpDir, 'index.html');
    await download.saveAs(filePath);

    const exportedPage = await context.newPage();
    await exportedPage.addInitScript(() => document.addEventListener('boot-finished', () => {
      document.body.dataset.bootFinished = 'true';
    }, { once: true }));
    await exportedPage.goto(`file://${filePath}`);
    await exportedPage.waitForFunction(() => (window as WindowWithExportMode).__TINY_RPG_EXPORT_MODE === true);
    await expect(exportedPage.locator('body')).toHaveAttribute('data-boot-finished', 'true');
    const project = await exportedPage.evaluate(() => {
      const bundled = (globalThis as typeof globalThis & { __TINY_RPG_BUNDLED_PROJECT?: { game: { world: { rows: number; cols: number }; rooms: unknown[]; gameplayPlugins: { id: string; version: string }[] }; plugins: { id: string }[] } }).__TINY_RPG_BUNDLED_PROJECT;
      return bundled && { world: bundled.game.world, rooms: bundled.game.rooms.length, dependencies: bundled.game.gameplayPlugins, plugins: bundled.plugins.map(plugin => plugin.id) };
    });
    expect(project).toEqual({ world: { rows, cols }, rooms: rows * cols, dependencies: [{ id: 'maps-plus', version: '1.0.1' }], plugins: ['maps-plus'] });
    await expect(exportedPage.locator('#btn-export-reset')).toBeVisible();
  });
}
