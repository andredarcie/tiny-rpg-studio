import { expect, test } from '@playwright/test';
import path from 'node:path';

for (const base of ['/', '/studio/']) {
  for (const mode of ['search', 'manage']) {
    test(`updates older Minimalist UI through ${mode} at ${base}`, async ({ page }, testInfo) => {
      test.skip(base !== '/' && !testInfo.project.metadata.pluginsProduction, 'Subdirectory deployment uses the production config');
      await page.goto(base);
      await page.evaluate(() => localStorage.setItem('tiny-rpg-plugins-v1', JSON.stringify([{
        id: 'minimalist-ui', title: 'Minimalist UI', shortDescription: 'Older package', fullDescription: 'Older installed Minimalist UI fixture', version: '1.0.1',
        payload: {
          apiVersion: 1,
          javascript: 'export function activate({ editorRoot, onCleanup }) { editorRoot.dataset.oldPlugin = "active"; onCleanup(() => { delete editorRoot.dataset.oldPlugin; }); }',
          css: '#tab-editor { --old-plugin-version: 1; }',
        },
      }])));
      await page.reload();
      await page.click('button[data-tab="editor"]');
      await expect(page.locator('#tab-editor')).toHaveAttribute('data-old-plugin', 'active');
      await page.click('#btn-plugins');
      if (mode === 'manage') await page.click('#plugins-manage');
      else await page.fill('#plugins-query', 'Minimalist');
      const card = page.locator('[data-plugin-id="minimalist-ui"].plugin-card');
      const update = card.locator('[data-action="update"]');
      await expect(update).toBeEnabled();
      await page.route('**/plugins/minimalist-ui/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
      await update.click();
      await expect(page.locator('#plugins-status')).not.toBeEmpty();
      await expect(update).toBeEnabled();
      await expect(page.locator('#tab-editor')).toHaveAttribute('data-old-plugin', 'active');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tiny-rpg-plugins-v1')!)[0].version)).toBe('1.0.1');
      await page.unroute('**/plugins/minimalist-ui/**');
      await update.click();
      await expect(card.locator('[data-action="update"]')).toHaveCount(0);
      await expect(card.locator(mode === 'manage' ? '[data-action="remove"]' : '.plugin-read-more')).toBeFocused();
      await expect(page.locator('#tab-editor')).not.toHaveAttribute('data-old-plugin');
      await expect(page.locator('style[data-plugin-id="minimalist-ui"]')).toHaveCount(1);
      expect(await page.locator('style[data-plugin-id="minimalist-ui"]').textContent()).not.toContain('--old-plugin-version');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tiny-rpg-plugins-v1')!).map((plugin: { id: string; version: string }) => [plugin.id, plugin.version]))).toEqual([['minimalist-ui', '1.0.3']]);
      await page.click('#plugins-search');
      await expect(card.locator('[data-action="installed"]')).toBeDisabled();
      await page.click('#plugins-manage');
      await expect(card.locator('[data-action="remove"]')).toBeEnabled();
      await page.reload();
      await page.click('button[data-tab="editor"]');
      await expect(page.locator('.editor-section--world')).toBeHidden();
      await expect(page.locator('style[data-plugin-id="minimalist-ui"]')).toHaveCount(1);
      await page.click('#btn-plugins');
      await expect(card.locator('[data-action="installed"]')).toBeDisabled();
      await page.click('#plugins-manage');
      await card.locator('[data-action="remove"]').click();
      await expect(page.locator('style[data-plugin-id="minimalist-ui"]')).toHaveCount(0);
      await page.click('#plugins-modal .tiny-modal__close');
      await expect(page.locator('.editor-section--world')).toBeVisible();
    });
  }
}

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
    await page.click('[data-plugin-id="example-plugin"] [data-action="remove"]');
    await page.click('#plugins-modal .tiny-modal__close');
    await expect(page.locator('#example-plugin-toggle')).toHaveCount(0);
    await expect(page.locator('.editor-left > .editor-section--tiles')).toHaveCount(1);
    await expect(page.locator('.editor-right > .editor-section--npcs')).toHaveCount(1);
    if (width <= 920) await page.click('[data-mobile-target="world"]');
    await expect(page.locator('.editor-section--world')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tiny-rpg-plugins-v1') ?? '[]'))).toEqual([]);
  });
}


for (const base of ['/', '/studio/']) {
  test(`catalog discovery, explicit install and offline reload at ${base}`, async ({ page }, testInfo) => {
    test.skip(base !== '/' && !testInfo.project.metadata.pluginsProduction, 'Subdirectory deployment is exercised with playwright.plugins.config.ts');
    const catalogRequests: string[] = [];
    const packageRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/plugins/catalog.json')) catalogRequests.push(request.url());
      if (request.url().includes('/plugins/example-plugin/')) packageRequests.push(request.url());
    });
    await page.goto(base);
    await page.click('button[data-tab="editor"]');
    await expect(page.locator('.tile-card').first()).toBeVisible();
    await page.click('#btn-plugins');
    await expect(page.locator('.plugin-card h3')).toHaveText(['Custom Themes', 'Example plugin', 'Maps+', 'Minimalist UI']);
    await expect(page.locator('.plugin-card[data-plugin-id="maps-plus"] .plugin-capabilities')).toHaveText('editor + gameplay');
    expect(catalogRequests).toHaveLength(1);
    expect(packageRequests).toHaveLength(0);
    await page.fill('#plugins-query', 'example');
    await expect(page.locator('.plugin-card')).toHaveCount(1);
    expect(catalogRequests).toHaveLength(1);
    expect(catalogRequests[0]).toContain(`${base}plugins/catalog.json`);
    expect(packageRequests).toHaveLength(0);
    await expect(page.locator('.editor-section--world')).toBeVisible();
    await page.fill('#plugins-query', 'EXAMPLE');
    await expect(page.locator('.plugin-card')).toHaveCount(1);
    expect(catalogRequests).toHaveLength(1);
    await page.click('.plugin-action');
    await expect(page.locator('.plugin-action')).toBeDisabled();
    await expect(page.locator('.plugin-action')).toHaveText(/Installed|Instalado/);
    expect(packageRequests).toHaveLength(1);
    await page.click('#plugins-modal .tiny-modal__close');
    await expect(page.locator('.editor-right > .editor-section--tiles:first-child')).toHaveCount(1);
    await expect(page.locator('.editor-left > .editor-section--npcs:first-child')).toHaveCount(1);
    await expect(page.locator('.editor-section--world')).toBeHidden();
    await page.route('**/plugins/**', route => route.abort());
    await page.reload();
    await page.click('button[data-tab="editor"]');
    await expect(page.locator('.editor-section--world')).toBeHidden();
    await expect(page.locator('.editor-right > .editor-section--tiles:first-child')).toHaveCount(1);
    expect(packageRequests).toHaveLength(1);
    await page.click('#btn-plugins');
    await page.click('#plugins-manage');
    await page.click('[data-action="remove"]');
    await page.click('#plugins-modal .tiny-modal__close');
    await expect(page.locator('.editor-section--world')).toBeVisible();
    await expect(page.locator('.editor-left > .editor-section--tiles')).toHaveCount(1);
    await expect(page.locator('.editor-right > .editor-section--npcs')).toHaveCount(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tiny-rpg-plugins-v1') ?? '[]'))).toEqual([]);
  });
}

test('Maps+ is discoverable and installable from the catalog', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('#btn-plugins');
  await page.fill('#plugins-query', 'Maps+');
  const card = page.locator('.plugin-card[data-plugin-id="maps-plus"]');
  await expect(card).toBeVisible();
  await expect(card.locator('.plugin-capabilities')).toHaveText('editor + gameplay');
  await card.locator('[data-action="install"]').click();
  await expect(card.locator('[data-action="installed"]')).toBeDisabled();
  await expect(card.locator('.plugin-capabilities')).toHaveText('editor + gameplay');
  await page.click('#plugins-manage');
  await expect(page.locator('.plugin-card[data-plugin-id="maps-plus"] .plugin-capabilities')).toHaveText('editor + gameplay');
  await page.click('#plugins-modal .tiny-modal__close');
  await expect(page.locator('.world-panel .maps-plus-controls select[aria-label="Rows"]')).toBeVisible();
  await expect(page.locator('.project-group--development .maps-plus-controls select[aria-label="Columns"]')).toBeVisible();
});

test('Maps+ controls stay synchronized with Minimalist UI hiding World', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('#btn-plugins');
  await page.setInputFiles('#plugins-file', path.resolve('examples/minimalist-ui.html'));
  await expect(page.locator('.plugin-card[data-plugin-id="minimalist-ui"]')).toBeVisible();
  await page.setInputFiles('#plugins-file', path.resolve('public/plugins/maps-plus/1.0.0/plugin.html'));
  await expect(page.locator('.plugin-card[data-plugin-id="maps-plus"]')).toBeVisible();
  await page.click('#plugins-search');
  await page.fill('#plugins-query', 'Maps+');
  const card = page.locator('.plugin-card[data-plugin-id="maps-plus"]');
  await expect(card.locator('[data-action="update"]')).toBeEnabled();
  await card.locator('[data-action="update"]').click();
  await expect(card.locator('[data-action="installed"]')).toBeDisabled();
  await page.click('#plugins-modal .tiny-modal__close');

  const world = page.locator('.world-panel .maps-plus-controls');
  const development = page.locator('.project-group--development .maps-plus-controls');
  await expect(page.locator('.editor-section--world')).toBeHidden();
  await page.locator('.editor-section--project > details > summary').click();
  await page.click('[data-project-tab-button="development"]');
  await expect(development).toBeVisible();
  await development.locator('select[aria-label="Rows"]').selectOption('4');
  await development.locator('select[aria-label="Columns"]').selectOption('3');
  await expect(world.locator('select[aria-label="Rows"]')).toHaveValue('4');
  await expect(world.locator('select[aria-label="Columns"]')).toHaveValue('3');
  await development.locator('button').click();
  await expect(page.locator('.world-cell')).toHaveCount(12);

  await page.click('#btn-plugins');
  await page.click('#plugins-manage');
  await page.locator('[data-plugin-id="minimalist-ui"] [data-action="remove"]').click();
  await page.click('#plugins-modal .tiny-modal__close');
  await expect(world).toBeVisible();
  await world.locator('select[aria-label="Columns"]').selectOption('5');
  await expect(development.locator('select[aria-label="Columns"]')).toHaveValue('5');
  await world.locator('button').click();
  await expect(page.locator('.world-cell')).toHaveCount(20);
});

test('removing Maps+ restores shareable 3×3 world and backs up trimmed rooms', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('#btn-plugins');
  await page.fill('#plugins-query', 'Maps+');
  await page.locator('[data-plugin-id="maps-plus"] [data-action="install"]').click();
  await expect(page.locator('[data-plugin-id="maps-plus"] [data-action="installed"]')).toBeDisabled();
  await page.click('#plugins-modal .tiny-modal__close');
  await page.locator('.world-panel .maps-plus-controls select[aria-label="Rows"]').selectOption('3');
  await page.locator('.world-panel .maps-plus-controls select[aria-label="Columns"]').selectOption('5');
  await page.locator('.world-panel .maps-plus-controls button').click();
  await expect(page.locator('.world-cell')).toHaveCount(15);
  await page.locator('.world-cell[data-room-index="14"]').click();
  await page.locator('.tile-card-select').first().click();
  await page.locator('#editor-canvas').click({ position: { x: 100, y: 100 } });

  await page.click('#btn-plugins');
  await page.click('#plugins-manage');
  await page.locator('[data-plugin-id="maps-plus"] [data-action="remove"]').click();
  await page.click('#plugins-modal .tiny-modal__close');
  await expect(page.locator('.world-cell')).toHaveCount(9);
  await expect(page.locator('.maps-plus-controls')).toHaveCount(0);
  await page.click('button[data-project-tab-button="export"]');
  await expect(page.locator('#btn-generate-url')).toBeEnabled();
  await page.locator('#btn-generate-url').click();
  await expect(page.locator('#project-share-url')).not.toHaveValue('');

  const backup = await page.evaluate(() => {
    const projects = (JSON.parse(localStorage.getItem('tiny-rpg-projects-history') ?? '{}') as { projects?: { shareUrl: string }[] }).projects ?? [];
    const saved = projects.find(project => project.shareUrl.startsWith('snapshot:'));
    return saved ? JSON.parse(saved.shareUrl.slice(9)) as { world: { rows: number; cols: number }; tileset: { maps: { ground: (string | number | null)[][] }[] }; gameplayPlugins: { id: string }[] } : null;
  });
  expect(backup?.world).toEqual({ rows: 3, cols: 5 });
  expect(backup?.gameplayPlugins).toEqual([{ id: 'maps-plus', version: '1.0.1' }]);
  expect(backup?.tileset.maps[14].ground.flat().some(tile => tile !== null)).toBe(true);

  await page.reload();
  await page.click('button[data-tab="editor"]');
  await expect(page.locator('.world-cell')).toHaveCount(9);
  await page.click('button[data-project-tab-button="export"]');
  await expect(page.locator('#btn-generate-url')).toBeEnabled();
});

test('failed and cancelled catalog downloads never install, and retry works', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('#btn-plugins');
  await page.fill('#plugins-query', 'example');
  await expect(page.locator('.plugin-card')).toHaveCount(1);
  await page.route('**/plugins/example-plugin/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.click('.plugin-action');
  await expect(page.locator('#plugins-status')).not.toBeEmpty();
  await expect(page.locator('.plugin-action')).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('tiny-rpg-plugins-v1'))).toBeNull();
  await page.unroute('**/plugins/example-plugin/**');
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/plugins/example-plugin/**', async route => {
    await waiting;
    await route.continue().catch(() => {});
  });
  await page.click('.plugin-action');
  await expect(page.locator('.plugin-action')).toBeDisabled();
  await page.click('#plugins-modal .tiny-modal__close');
  release();
  await page.unrouteAll({ behavior: 'wait' });
  expect(await page.evaluate(() => localStorage.getItem('tiny-rpg-plugins-v1'))).toBeNull();
  await page.click('#btn-plugins');
  await expect(page.locator('#plugins-query')).toHaveValue('');
  await page.fill('#plugins-query', 'example');
  await expect(page.locator('.plugin-card')).toHaveCount(1);
  await page.click('.plugin-action');
  await expect(page.locator('.editor-section--world')).toBeHidden();
});


test('Minimalist UI simplifies catalogs and pixel editing, then restores on removal', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('#btn-plugins');
  await page.fill('#plugins-query', 'Minimalist');
  await expect(page.locator('[data-plugin-id="minimalist-ui"]')).toBeVisible();
  await page.click('.plugin-action');
  await expect(page.locator('.plugin-action')).toHaveText(/Installed|Instalado/);
  await page.click('#plugins-modal .tiny-modal__close');
  for (const selector of ['.enemy-xp-block', '.npc-card .meta', '.enemy-meta', '.object-type-meta', '.editor-section--world']) await expect(page.locator(selector).first()).toBeHidden();
  const project = page.locator('details').filter({ has: page.locator('summary[data-text-key="sections.project"]') });
  await expect(project).not.toHaveAttribute('open');
  await project.locator(':scope > summary').click();
  await expect(page.locator('[data-project-tab-button="development"]')).toHaveAccessibleName('Development');
  await expect(page.locator('[data-project-tab-button="info"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-project-tab-panel="info"]')).toBeVisible();
  await page.click('[data-project-tab-button="development"]');
  await expect(page.locator('[data-project-tab-panel="development"]')).toBeVisible();
  for (const selector of ['.npc-preview', '.enemy-preview', '.object-type-preview']) await expect(page.locator(selector).first()).toBeVisible();
  await page.locator('.tile-card .sprite-edit-btn').first().click({ force: true });
  for (const selector of ['#pixel-art-editor-modal .tiny-modal__header', '#pae-sprite-meta', '.pae-tile-effect-label', '#pae-tool-paint', '#pae-tool-erase']) await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator('#pae-canvas')).toBeVisible();
  await expect(page.locator('label[for="pae-tile-merge-edges"]')).toHaveText(/merge/i);
  await page.locator('#pae-tile-merge-edges').check();
  await expect(page.locator('#pae-tile-merge-edges')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pixel-art-editor-modal')).toBeHidden();
  await page.click('#btn-plugins');
  await page.click('#plugins-manage');
  await page.click('[data-plugin-id="minimalist-ui"] [data-action="remove"]');
  await page.click('#plugins-modal .tiny-modal__close');
  for (const selector of ['.enemy-xp-block', '.npc-card .meta', '.enemy-meta', '.object-type-meta', '.editor-section--world']) await expect(page.locator(selector).first()).toBeVisible();
  await page.locator('.tile-card .sprite-edit-btn').first().click({ force: true });
  await expect(page.locator('#pae-close')).toBeVisible();
  await expect(page.locator('#pae-tool-paint')).toBeVisible();
  await expect(page.locator('#pae-tool-erase')).toBeVisible();
  await expect(page.locator('[data-text-key="pixelArtEditor.mergeEdges"]')).toBeVisible();
});
