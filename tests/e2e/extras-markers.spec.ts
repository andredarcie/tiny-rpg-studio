import { test, expect, type Page } from '@playwright/test';

test('Extras markers keep independent dialogue after saving, loading and sharing', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const markers = [
    { room: 0, type: 'thought-bubble', x: 2, text: 'First balloon' },
    { room: 1, type: 'thought-bubble', x: 2, text: 'Second balloon' },
    { room: 0, type: 'wooden-sign', x: 4, text: 'First sign' },
    { room: 1, type: 'wooden-sign', x: 4, text: 'Second sign' },
  ];
  const clickTile = async (target: Page, x: number) => {
    const canvas = target.locator('#editor-canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (!box) throw Error('Editor canvas is missing');
    await canvas.click({ position: { x: (x + 0.5) * box.width / 8, y: 2.5 * box.height / 8 } });
  };
  const closeModal = async (target: Page) => {
    await target.locator('#npc-edit-modal .tiny-modal__footer button').first().click();
  };
  const verifyMarkers = async (target: Page) => {
    for (const marker of markers) {
      await target.locator(`[data-room-index="${marker.room}"]`).click();
      await clickTile(target, marker.x);
      await expect(target.locator('#npc-default-dialog')).toHaveValue(marker.text);
      await closeModal(target);
    }
  };

  await page.goto('/');
  await page.click('button[data-tab="editor"]');
  await page.click('[data-npc-variant-filter="fixed"]');
  for (const marker of markers) {
    await page.locator(`[data-room-index="${marker.room}"]`).click();
    await page.locator(`.npc-card[data-type="${marker.type}"]`).click();
    await clickTile(page, marker.x);
    await clickTile(page, marker.x);
    await page.locator('#npc-default-dialog').fill(marker.text);
    await closeModal(page);
  }
  await verifyMarkers(page);
  await page.locator('#btn-manual-save').click();
  await page.locator('#btn-history-dropdown').click();
  await page.evaluate(() => {
    document.addEventListener('tiny-rpg-project-restored', () => {
      document.body.dataset.testProjectRestored = 'true';
    }, { once: true });
  });
  await page.locator('.history-item').first().click();
  await expect(page.locator('body')).toHaveAttribute('data-test-project-restored', 'true');
  await verifyMarkers(page);

  await page.locator('[data-project-tab-button="export"]').click();
  await page.locator('#btn-generate-url').click();
  const shared = await context.newPage();
  shared.on('pageerror', error => errors.push(error.message));
  await shared.goto(await page.locator('#project-share-url').inputValue());
  await shared.click('button[data-tab="editor"]');
  await verifyMarkers(shared);
  expect(errors).toEqual([]);
});
