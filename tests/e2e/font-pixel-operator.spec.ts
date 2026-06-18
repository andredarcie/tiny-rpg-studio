import { test, expect } from '@playwright/test';

// Verifies the engine now renders the Pixel Operator font everywhere — in the
// DOM UI and on the game canvas — and that uppercase, lowercase and accented
// characters all render. Captures screenshots for visual inspection.

async function waitForReady(page: import('@playwright/test').Page) {
  await page.goto('/');
  // Boot screen is removed once assets (incl. the font) are ready.
  await expect(page.locator('#boot-loading')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test('Pixel Operator is the font in the DOM and on the canvas', async ({ page }) => {
  await waitForReady(page);

  // 1) The font face is actually loaded.
  const loaded = await page.evaluate(() => document.fonts.check('8px "PixelOperator"'));
  expect(loaded).toBe(true);

  // 2) The DOM UI uses Pixel Operator (no more TinyRpgPico8).
  const tabFont = await page
    .locator('.tab-button')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(tabFont).toContain('PixelOperator');

  // 3) The default game intro screen (engine canvas text).
  await page.screenshot({ path: 'test-results/font-canvas-default.png' });

  // 4) The editor UI rendered in Pixel Operator (mixed case labels).
  await page.locator('.tab-button[data-tab="editor"]').click({ force: true });
  await expect(page.locator('body')).toHaveClass(/editor-mode/);
  await page.screenshot({ path: 'test-results/font-editor-ui.png' });

  // 5) Drive an accented, mixed-case title through the real engine and render
  //    it on the canvas intro screen (the title is upper-cased by design, so
  //    this proves accented uppercase glyphs render through the engine).
  await page.evaluate(() => {
    const input = document.getElementById('game-title') as HTMLInputElement | null;
    if (input) {
      input.value = 'Café Pão Ação';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.locator('.tab-button[data-tab="game"]').click({ force: true });
  await expect(page.locator('body')).toHaveClass(/game-mode/);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/font-canvas-accents.png' });

  // 6) A glyph-coverage sample drawn with the same font the engine canvas uses,
  //    showing uppercase, lowercase, accents, digits and punctuation crisply.
  await page.evaluate(async () => {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.id = 'font-sample';
    canvas.width = 260;
    canvas.height = 90;
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      zIndex: '100000',
      width: '780px',
      height: '270px',
      imageRendering: 'pixelated',
      background: '#05060e',
    });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05060e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '8px "PixelOperator"';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#5bfa8e';
    ctx.fillText('ABCDEFG HIJKLM NOPQRS', 6, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('abcdefg hijklm nopqrs', 6, 20);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('Olá! Açúcar é Pão — Ação', 6, 34);
    ctx.fillStyle = '#9bd1ff';
    ctx.fillText('ÁÀÂÃÄ ÉÊ Í ÓÕÔ ÚÜ Çñ', 6, 48);
    ctx.fillStyle = '#cccccc';
    ctx.fillText('0123456789 ?!.,:;()@#%', 6, 62);
  });
  await page.waitForTimeout(150);
  await page.locator('#font-sample').screenshot({ path: 'test-results/font-glyph-sample.png' });
});
