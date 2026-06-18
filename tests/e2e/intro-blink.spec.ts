import { test, expect } from '@playwright/test';

// The "start adventure" prompt should pulse via a smooth animation loop rather
// than repainting on sparse (~320ms) tile ticks, which read as engine lag.
// We count requestAnimationFrame callbacks while the idle intro is showing:
// a smooth loop drives ~60fps, a laggy/frozen one drives ~0.
test('intro screen repaints smoothly (no laggy blink)', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: number };
    w.__raf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      orig((t) => {
        w.__raf += 1;
        cb(t);
      });
  });

  await page.goto('/');
  await expect(page.locator('#boot-loading')).toHaveCount(0, { timeout: 10000 });
  // Let the intro become dismissible so the pulsing prompt is shown.
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    (window as unknown as { __raf: number }).__raf = 0;
  });
  await page.waitForTimeout(500);
  const frames = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);

  // ~60fps over 500ms ≈ 30 frames. Require clearly-continuous repainting
  // (well above the ~1-2 frames a sparse tile tick would produce).
  expect(frames).toBeGreaterThan(15);
});
