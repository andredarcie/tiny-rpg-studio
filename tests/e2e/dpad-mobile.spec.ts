import { test, expect } from '@playwright/test';

// Emulate a phone: the mini D-pad only shows at <= 720px wide. We verify it is
// glued directly below the canvas (upper part of the screen) and fully on
// screen — never clipped off the bottom of the viewport.
test.use({
  viewport: { width: 390, height: 720 },
  hasTouch: true,
  isMobile: true,
});

test('mobile D-pad is glued below the canvas and fully visible', async ({ page }) => {
  await page.goto('/');

  // Game tab is the default, so body.game-mode is applied on boot.
  await expect(page.locator('body')).toHaveClass(/game-mode/);

  const dpad = page.locator('#mobile-touch-pad');
  const canvas = page.locator('#game-canvas');

  // The D-pad must be shown (display: flex) on a touch-sized viewport.
  await expect(dpad).toBeVisible();
  await expect(dpad).toHaveCSS('display', 'flex');

  // Wait for the responsive canvas sizing to settle.
  await page.waitForFunction(() => {
    const c = document.getElementById('game-canvas');
    return !!c && c.getBoundingClientRect().height > 10;
  });

  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport');

  const dpadBox = await dpad.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!dpadBox || !canvasBox) throw new Error('missing layout boxes');

  // 1) Fully on screen — not clipped at the top or the bottom.
  expect(dpadBox.y).toBeGreaterThanOrEqual(0);
  expect(dpadBox.y + dpadBox.height).toBeLessThanOrEqual(viewport.height + 1);

  // 2) Glued to the canvas: the D-pad starts just below the canvas bottom.
  const canvasBottom = canvasBox.y + canvasBox.height;
  expect(dpadBox.y).toBeGreaterThanOrEqual(canvasBottom - 1);
  expect(dpadBox.y - canvasBottom).toBeLessThanOrEqual(40);

  // 3) Sits in the upper part of the screen (not floating at the bottom edge).
  expect(dpadBox.y).toBeLessThan(viewport.height * 0.85);

  // 4) Horizontally centred under the canvas.
  const dpadCenter = dpadBox.x + dpadBox.width / 2;
  expect(Math.abs(dpadCenter - viewport.width / 2)).toBeLessThan(12);

  // Capture the mobile layout for visual inspection.
  await page.screenshot({ path: 'test-results/dpad-mobile.png' });
});
