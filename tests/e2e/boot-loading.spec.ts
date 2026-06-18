import { test, expect } from '@playwright/test';

// Verify the engine-styled boot loading screen: it must be the first thing
// painted, show the title/credits + progress bar, and be removed only once the
// engine assets have loaded.
test('boot loading screen shows first and is removed once ready', async ({ page }) => {
  // Delay the engine font so the boot screen stays up long enough to inspect.
  await page.route('**/pixel-operator.woff', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'commit' });

  const overlay = page.locator('#boot-loading');
  const fill = page.locator('#boot-loading-fill');

  // It is the first paint: visible with the expected copy.
  await expect(overlay).toBeVisible();
  await expect(page.locator('#boot-loading .boot-title')).toHaveText('Tiny RPG Studio');
  await expect(page.locator('#boot-loading .boot-subtitle')).toHaveText(
    'by André N. Darcie and Diguifi',
  );

  // The progress bar is animating (fill grows above 0%).
  await expect
    .poll(async () => {
      const box = await fill.boundingBox();
      return box?.width ?? 0;
    })
    .toBeGreaterThan(0);

  // Capture the boot screen while assets are still loading.
  await page.screenshot({ path: 'test-results/boot-loading.png' });

  // Once everything is ready, the overlay fades out and is removed from the DOM.
  await expect(overlay).toHaveCount(0, { timeout: 10000 });

  // The engine is now revealed underneath.
  await expect(page.locator('#game-canvas')).toBeVisible();

  // The bundle CSS must be applied (it loads asynchronously in production).
  // The tabs row uses the engine styling; check a non-default computed value.
  const tabsDisplay = await page
    .locator('.tabs')
    .first()
    .evaluate((el) => getComputedStyle(el).display);
  expect(tabsDisplay).not.toBe('inline');

  await page.screenshot({ path: 'test-results/boot-revealed.png' });
});
