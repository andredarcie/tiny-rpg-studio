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
  await page.click('button[data-project-tab-button="export"]');
  await page.waitForSelector('#btn-generate-html');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#btn-generate-html').click({ force: true }),
  ]);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiny-rpg-export-'));
  const filePath = path.join(tmpDir, 'index.html');
  await download.saveAs(filePath);
  const html = await fs.readFile(filePath, 'utf8');

  expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(475_000);
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
