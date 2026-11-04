import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type { TinyRpgApi } from '../../src/runtime/infra/TinyRpgApi';

async function turn(page: Page, key: 'ArrowLeft' | 'ArrowRight') {
  await page.keyboard.press(key);
  await page.waitForTimeout(330);
}

test('3D Renderer keeps keyboard dialogue, HUD+, pickups, doors and D-pad controls', async ({ page }, testInfo) => {
  await page.goto('/'); await page.click('button[data-tab="editor"]');
  await page.click('#btn-plugins');
  for (const [id, query] of [['3d-renderer', '3D Renderer'], ['hud-plus', 'HUD+'], ['dialogue-plus', 'Dialogue+']]) {
    await page.fill('#plugins-query', query);
    await page.locator(`[data-plugin-id="${id}"] [data-action="install"]`).click();
    await expect(page.locator(`[data-plugin-id="${id}"] [data-action="installed"]`)).toBeDisabled();
  }
  await page.click('#plugins-modal .tiny-modal__close');
  await page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    const api = getTinyRpgApi(); const game = api.exportGameData();
    game.title = 'First person interactions'; game.start = { x: 2, y: 2, roomIndex: 0 };
    game.sprites = [{ id: 'guide', type: 'old-mage', x: 3, y: 2, roomIndex: 0, placed: true, text: 'Welcome', disappearAfterDialog: true }];
    game.objects = [{ id: 'key', type: 'key', roomIndex: 0, x: 4, y: 2 }, { id: 'door', type: 'door', roomIndex: 0, x: 5, y: 2 }];
    game.enemies = []; game.items = []; game.exits = [];
    const brick = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => y % 4 === 0 || (x + (y < 4 ? 0 : 4)) % 8 === 0 ? '#5f574f' : '#ab5236'));
    game.tileset.tiles.push({ id: 'test-brick', name: 'Brick', collision: true, frames: [brick] });
    for (let x = 0; x < 8; x++) { game.tileset.maps[0].ground[1][x] = 'test-brick'; game.tileset.maps[0].ground[3][x] = 'test-brick'; }
    await api.loadProjectData(game);
    await api.setPluginData('hud-plus', { mode: 'overlay' });
    await api.setNpcDialogueBlocks('guide', [{ id: 'greeting', kind: 'alternative', conditionVariableId: null, text: 'Welcome', rewardVariableId: null, disappearAfterDialog: true }], 'dialogue-plus');
  });
  await page.click('button[data-tab="game"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(50);
  const state = () => page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    const api = getTinyRpgApi(); const state = api.getState();
    return { x: state.player.x, y: state.player.y, dialog: state.dialog.active, pickup: api.runtime.isPickupOverlayActive(),
      opened: api.runtime.getObjects().find(object => object.id === 'door')?.opened };
  });
  await turn(page, 'ArrowRight'); await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await state()).dialog).toBe(true);
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await state()).dialog).toBe(false);
  await page.keyboard.press('ArrowUp'); await expect.poll(async () => (await state()).x).toBe(3);
  await page.keyboard.press('ArrowUp'); await expect.poll(async () => (await state()).pickup).toBe(true);
  await page.keyboard.press('Enter'); await expect.poll(async () => (await state()).pickup).toBe(false);
  await page.keyboard.press('ArrowUp'); await expect.poll(async () => (await state()).opened).toBe(true);
  await expect.poll(async () => (await state()).x).toBe(5);
  await page.screenshot({ path: testInfo.outputPath('3d-renderer-textured-corridor.png') });
  await page.setViewportSize({ width: 480, height: 800 });
  const left = page.locator('.game-touch-pad .pad-button[data-direction="left"]');
  await left.dispatchEvent('pointerdown', { button: 0, pointerId: 1 });
  await left.dispatchEvent('pointerup', { button: 0, pointerId: 1 });
  await page.waitForTimeout(330);
  await page.keyboard.press('ArrowDown'); await expect.poll(async () => (await state()).y).toBe(2);
  await expect.poll(async () => (await state()).x).toBe(5);
  await turn(page, 'ArrowRight'); await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await state()).x).toBe(4);
  const enemyLives = () => page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    return getTinyRpgApi().runtime.getActiveEnemies().reduce((sum, enemy) => sum + Math.max(0, enemy.lives ?? 1), 0);
  });
  await page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    const api = getTinyRpgApi(); const game = api.exportGameData();
    game.sprites = []; game.objects = [];
    game.start = { x: 4, y: 2, roomIndex: 0 };
    game.enemies = [{ id: 'rat', type: 'giant-rat', x: 4, y: 1, roomIndex: 0 }];
    game.tileset.maps[0].ground[1][4] = null; game.rooms[0].walls[1][4] = false;
    await api.loadProjectData(game);
  });
  await page.keyboard.press('Enter'); await page.waitForTimeout(50);
  const lives = await enemyLives();
  await page.keyboard.press('ArrowUp');
  await expect.poll(enemyLives).toBeLessThan(lives);
});

test('3D Renderer installs from the catalog, preserves authoring, navigates by keyboard, reloads and exports offline', async ({ page, browser }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    const api = getTinyRpgApi();
    const data = api.exportGameData();
    data.title = 'Raycast test'; data.start = { x: 3, y: 3, roomIndex: 0 };
    data.sprites = []; data.enemies = []; data.objects = []; data.items = []; data.exits = [];
    data.rooms.forEach(room => { room.walls = Array.from({ length: 8 }, () => Array(8).fill(false)); });
    data.rooms[0].walls[1][3] = true;
    await api.loadProjectData(data); api.renderAll();
    Reflect.set(window, 'before3d', document.querySelector('#editor-canvas'));
  });
  const editorImage = () => page.locator('#editor-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const image = document.createElement('canvas'); image.width = 128; image.height = 128;
    const ctx = image.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, 128, 128); return image.toDataURL();
  });
  await page.waitForTimeout(400);
  const editorBefore = await editorImage();
  await page.click('#btn-plugins');
  await page.fill('#plugins-query', '3D Renderer');
  await page.locator('[data-plugin-id="3d-renderer"] [data-action="install"]').click();
  await page.click('#plugins-modal .tiny-modal__close');
  const dependency = () => page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    return getTinyRpgApi().exportGameData().gameplayPlugins ?? [];
  });
  await expect.poll(dependency).toEqual([{ id: '3d-renderer', version: '1.0.0' }]);
  expect(await editorImage()).toBe(editorBefore);
  expect(await page.evaluate(() => Reflect.get(window, 'before3d') === document.querySelector('#editor-canvas'))).toBe(true);
  await page.click('[data-project-tab-button="plugins"]');
  await expect(page.locator('[data-plugin-settings-group="3d-renderer"] > summary')).toHaveText('3D Renderer');
  await page.getByLabel('Top void', { exact: true }).selectOption('8');
  await expect(page.getByLabel('Top void', { exact: true })).toBeEnabled();
  await page.getByLabel('Bottom void', { exact: true }).selectOption('12');
  await expect(page.getByLabel('Bottom void', { exact: true })).toBeEnabled();
  await page.click('[data-project-tab-button="export"]');
  await expect(page.locator('#btn-generate-url')).toBeDisabled();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-generate-html')]);
  const filename = testInfo.outputPath('3d-renderer.html'); await download.saveAs(filename);
  await page.click('button[data-tab="game"]');
  await page.keyboard.press('Enter');
  const position = () => page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    const p = getTinyRpgApi().getState().player; return { x: p.x, y: p.y, roomIndex: p.roomIndex };
  });
  await expect.poll(position).toEqual({ x: 3, y: 3, roomIndex: 0 });
  await page.keyboard.press('ArrowUp'); await expect.poll(position).toEqual({ x: 3, y: 2, roomIndex: 0 });
  await page.keyboard.press('ArrowUp'); await expect.poll(position).toEqual({ x: 3, y: 2, roomIndex: 0 });
  await turn(page, 'ArrowRight'); await expect.poll(position).toEqual({ x: 3, y: 2, roomIndex: 0 });
  await page.keyboard.press('ArrowDown'); await expect.poll(position).toEqual({ x: 2, y: 2, roomIndex: 0 });
  await page.keyboard.press('w'); await expect.poll(position).toEqual({ x: 3, y: 2, roomIndex: 0 });
  for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowUp');
  await expect.poll(position).toEqual({ x: 0, y: 2, roomIndex: 1 });
  await page.keyboard.press('ArrowUp'); await expect.poll(position).toEqual({ x: 1, y: 2, roomIndex: 1 });
  await page.click('#btn-reset'); await page.keyboard.press('Enter'); await page.waitForTimeout(50);
  await page.keyboard.press('ArrowUp'); await expect.poll(position).toEqual({ x: 3, y: 2, roomIndex: 0 });
  await page.screenshot({ path: testInfo.outputPath('3d-renderer-wide.png') });
  await page.setViewportSize({ width: 480, height: 800 });
  await page.screenshot({ path: testInfo.outputPath('3d-renderer-narrow.png') });

  const offline = await browser.newContext({ offline: true });
  const exported = await offline.newPage(); exported.on('pageerror', error => errors.push(error.message));
  await exported.goto(`file:///${path.resolve(filename).replaceAll('\\', '/')}`);
  await exported.waitForFunction(() => Boolean((globalThis as unknown as { __TINY_RPG_API?: unknown }).__TINY_RPG_API));
  await exported.keyboard.press('Enter'); await exported.waitForTimeout(50);
  const exportedPosition = () => exported.evaluate(() => {
    const api = (globalThis as unknown as { __TINY_RPG_API: NonNullable<TinyRpgApi['runtime']> }).__TINY_RPG_API;
    const p = api.getState().player; return { x: p.x, y: p.y };
  });
  await turn(exported, 'ArrowRight'); await expect.poll(exportedPosition).toEqual({ x: 3, y: 3 });
  await exported.keyboard.press('ArrowDown'); await expect.poll(exportedPosition).toEqual({ x: 2, y: 3 });
  await exported.keyboard.press('ArrowUp'); await expect.poll(exportedPosition).toEqual({ x: 3, y: 3 });
  const voidPixel = await exported.evaluate(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    return [...canvas.getContext('2d')!.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height * 0.3), 1, 1).data];
  });
  expect(voidPixel[0]).toBeGreaterThan(41); expect(voidPixel[0]).toBeLessThan(255);
  expect(voidPixel[1]).toBeGreaterThan(0); expect(voidPixel[1]).toBeLessThan(173);
  expect(voidPixel[2]).toBeGreaterThan(77); expect(voidPixel[2]).toBeLessThan(255);
  expect(voidPixel[3]).toBe(255);
  await exported.screenshot({ path: testInfo.outputPath('3d-renderer-offline.png') });
  await offline.close();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload(); await page.click('button[data-tab="editor"]');
  await expect.poll(dependency).toEqual([{ id: '3d-renderer', version: '1.0.0' }]);
  await page.click('[data-project-tab-button="plugins"]');
  await expect(page.getByLabel('Top void', { exact: true })).toHaveValue('8');
  await expect(page.getByLabel('Bottom void', { exact: true })).toHaveValue('12');
  await page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    const api = getTinyRpgApi(); const other = api.exportGameData();
    other.gameplayPlugins = []; delete other.pluginData; other.title = 'Another project';
    await api.loadProjectData(other);
  });
  await expect.poll(dependency).toEqual([{ id: '3d-renderer', version: '1.0.0' }]);
  await expect(page.getByLabel('Top void', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Bottom void', { exact: true })).toHaveValue('');
  await page.click('#btn-reset');
  await expect.poll(async () => page.evaluate(async () => {
    const { getTinyRpgApi } = await import('/src/runtime/infra/TinyRpgApi.ts');
    return getTinyRpgApi().exportGameData().title;
  })).not.toBe('Another project');
  await expect.poll(dependency).toEqual([{ id: '3d-renderer', version: '1.0.0' }]);
  await page.click('#btn-plugins'); await page.click('#plugins-manage');
  await page.locator('[data-plugin-id="3d-renderer"] [data-action="remove"]').click();
  await page.click('#plugins-modal .tiny-modal__close');
  await expect.poll(dependency).toEqual([]);
  await page.click('[data-project-tab-button="export"]'); await expect(page.locator('#btn-generate-url')).toBeEnabled();
  await page.click('#btn-plugins'); await page.fill('#plugins-query', '3D Renderer');
  await page.locator('[data-plugin-id="3d-renderer"] [data-action="install"]').click();
  await page.click('#plugins-modal .tiny-modal__close');
  await expect.poll(dependency).toEqual([{ id: '3d-renderer', version: '1.0.0' }]);
  expect(errors).toEqual([]);
});

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
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tiny-rpg-plugins-v1')!).map((plugin: { id: string; version: string }) => [plugin.id, plugin.version]))).toEqual([['minimalist-ui', '1.0.4']]);
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
    await expect(page.locator('#plugins-trust')).toHaveCount(0);
    await page.setInputFiles('#plugins-file', path.resolve('examples/plugin-preview.html'));
    await expect(page.locator('.plugin-card[data-plugin-id="example-plugin"]')).toBeVisible();
    await page.click('#plugins-modal .tiny-modal__close');
    await expect(page.locator('.editor-right > .editor-section--tiles:first-child')).toHaveCount(1);
    await expect(page.locator('.editor-left > .editor-section--npcs:first-child')).toHaveCount(1);
    expect(await page.evaluate(() => Reflect.get(window, 'originalTiles') === document.querySelector('.editor-section--tiles'))).toBe(true);
    await expect(page.locator('.editor-section--world')).toBeHidden();
    if (width <= 920) await page.click('[data-mobile-target="project"]');
    await page.click('[data-project-tab-button="plugins"]');
    const flip = page.getByRole('checkbox', { name: 'Flip' });
    await expect(flip).toBeChecked();
    await flip.uncheck();
    await expect(page.locator('.editor-left > .editor-section--tiles')).toHaveCount(1);
    await expect(page.locator('.editor-right > .editor-section--npcs')).toHaveCount(1);
    await flip.check();
    await expect(page.locator('.editor-right > .editor-section--tiles:first-child')).toHaveCount(1);
    if (width <= 920) await page.click('[data-mobile-target="tiles"]');
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
    await expect(page.locator('#example-plugin-flip')).toBeChecked();
    await expect(page.locator('.editor-right > .editor-section--tiles:first-child')).toHaveCount(1);
    await expect(page.locator('.editor-section--world')).toBeHidden();
    await page.click('#btn-plugins');
    await page.click('#plugins-manage');
    await page.click('[data-plugin-id="example-plugin"] [data-action="remove"]');
    await page.click('#plugins-modal .tiny-modal__close');
    await expect(page.locator('#example-plugin-flip')).toHaveCount(0);
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
    await expect(page.locator('.plugin-card h3')).toHaveText(['3D Renderer', 'Custom Themes', 'Dialogue+', 'Example plugin', 'Fonts+', 'HUD+', 'Maps+', 'Minimalist UI', 'Music+', 'Sounds+']);
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
  await expect(page.locator('.project-group--development .maps-plus-controls')).toHaveCount(0);
  await page.click('[data-project-tab-button="plugins"]');
  await expect(page.locator('[data-plugin-settings-group="maps-plus"] > summary')).toHaveText('Maps+');
  await expect(page.locator('[data-plugin-settings-group="maps-plus"] .maps-plus-controls select[aria-label="Columns"]')).toBeVisible();
  await page.locator('[data-plugin-settings-group="maps-plus"] > summary').click();
  await expect(page.locator('[data-plugin-settings-group="maps-plus"] .maps-plus-controls')).toBeHidden();
  await page.locator('[data-plugin-settings-group="maps-plus"] > summary').click();
  await expect(page.locator('[data-plugin-settings-group="maps-plus"] .maps-plus-controls')).toBeVisible();
});

test('Dialogue+ edits repeated NPC blocks and restores the native modal after removal', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('#btn-plugins');
  await page.fill('#plugins-query', 'Dialogue+');
  const plugin = page.locator('.plugin-card[data-plugin-id="dialogue-plus"]');
  await expect(plugin).toBeVisible();
  await plugin.locator('[data-action="install"]').click();
  await page.click('#plugins-modal .tiny-modal__close');

  await page.locator('.npc-card').first().click();
  await page.locator('#editor-canvas').click({ position: { x: 100, y: 100 } });
  await page.locator('#editor-canvas').click({ position: { x: 100, y: 100 } });
  await expect(page.locator('.dialogue-plus__add')).toBeVisible();
  await expect(page.locator('.npc-edit-modal__toggle').first()).toBeHidden();
  await page.locator('.dialogue-plus__add').click();
  await page.locator('.dialogue-plus__popup button').first().click();
  await page.locator('.dialogue-plus__add').click();
  await page.locator('.dialogue-plus__popup button').last().click();
  await expect(page.locator('.dialogue-plus__block')).toHaveCount(2);
  await expect(page.locator('#btn-generate-url')).toBeDisabled();
  await page.locator('#npc-disappear-after-dialog').check();
  await expect(page.locator('.dialogue-plus')).toBeHidden();
  await page.locator('#npc-disappear-after-dialog').uncheck();
  await expect(page.locator('.dialogue-plus__block')).toHaveCount(2);

  await page.keyboard.press('Escape');
  await page.click('#btn-plugins');
  await page.click('#plugins-manage');
  await page.locator('[data-plugin-id="dialogue-plus"] [data-action="remove"]').click();
  await page.click('#plugins-modal .tiny-modal__close');
  await page.locator('#editor-canvas').click({ position: { x: 100, y: 100 } });
  await expect(page.locator('.dialogue-plus')).toHaveCount(0);
  await expect(page.locator('.npc-edit-modal__toggle').first()).toBeVisible();
});

test('Maps+ controls stay synchronized with Minimalist UI hiding World', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('#btn-plugins');
  await page.setInputFiles('#plugins-file', path.resolve('public/plugins/minimalist-ui/1.0.4/plugin.html'));
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
  const project = page.locator('[data-plugin-settings-group="maps-plus"] .maps-plus-controls');
  await expect(page.locator('.editor-section--world')).toBeHidden();
  await page.locator('.editor-section--project > details > summary').click();
  await page.click('[data-project-tab-button="plugins"]');
  await expect(page.locator('.project-group--development .maps-plus-controls')).toHaveCount(0);
  await expect(project).toBeVisible();
  await project.locator('select[aria-label="Rows"]').selectOption('4');
  await project.locator('select[aria-label="Columns"]').selectOption('3');
  await expect(world.locator('select[aria-label="Rows"]')).toHaveValue('4');
  await expect(world.locator('select[aria-label="Columns"]')).toHaveValue('3');
  await project.locator('button').click();
  await expect(page.locator('.world-cell')).toHaveCount(12);

  await page.click('#btn-plugins');
  await page.click('#plugins-manage');
  await page.locator('[data-plugin-id="minimalist-ui"] [data-action="remove"]').click();
  await page.click('#plugins-modal .tiny-modal__close');
  await expect(world).toBeVisible();
  await world.locator('select[aria-label="Columns"]').selectOption('5');
  await expect(project.locator('select[aria-label="Columns"]')).toHaveValue('5');
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
  await expect(page.locator('[data-plugin-settings-group="maps-plus"]')).toHaveCount(0);
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
  expect(backup?.gameplayPlugins).toEqual([{ id: 'maps-plus', version: '1.0.2' }]);
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
  await page.locator('#language-select').selectOption('pt-BR');
  await page.click('[data-project-tab-button="development"]');
  await expect(page.locator('[data-project-tab-panel="development"]')).toBeVisible();
  for (const selector of ['.npc-preview', '.enemy-preview', '.object-type-preview']) await expect(page.locator(selector).first()).toBeVisible();
  await page.locator('.tile-card .sprite-edit-btn').first().click({ force: true });
  for (const selector of ['#pixel-art-editor-modal .tiny-modal__header', '.pae-tile-effect-label', '#pae-tool-paint', '#pae-tool-erase']) await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator('#pae-canvas')).toBeVisible();
  await expect(page.locator('label[for="pae-tile-merge-edges"]')).toHaveText('Mesclar');
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
  await expect(page.locator('label[for="pae-tile-merge-edges"]')).toHaveText('Mesclar');
});
