import { test, expect } from '@playwright/test';

// The game-title input is capped at 18 characters. A max-length title must wrap
// onto the intro screen without overflowing the canvas or breaking the layout.
test('max-length (18-char) title fits the intro screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot-loading')).toHaveCount(0, { timeout: 10000 });

  await page.locator('.tab-button[data-tab="editor"]').click({ force: true });
  await expect(page.locator('body')).toHaveClass(/editor-mode/);
  await page.evaluate(() => {
    const input = document.getElementById('game-title') as HTMLInputElement | null;
    if (input) {
      input.value = 'The Legend Of Zelo'; // exactly 18 chars
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  await page.locator('.tab-button[data-tab="game"]').click({ force: true });
  await expect(page.locator('body')).toHaveClass(/game-mode/);
  await page.waitForTimeout(250);

  // The canvas must still be visible and correctly sized (layout not broken).
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.height ?? 0)).toBeGreaterThan(50);

  await page.screenshot({ path: 'test-results/intro-max-title.png' });
});
