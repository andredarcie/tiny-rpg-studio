import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:5173/';
const outDir = path.resolve('output/bitmap-font-validation');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function screenshot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

// Waits for two animation frames so any pending canvas renders flush.
async function waitForRender(page, extraMs = 0) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  if (extraMs > 0) await page.waitForTimeout(extraMs);
}

async function main() {
  await ensureDir(outDir);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const consoleMessages = [];
  page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => consoleMessages.push(`pageerror: ${err.message}`));

  await page.goto(`${url}?bitmap-validation=${Date.now()}`, { waitUntil: 'networkidle' });
  // Wait for the game canvas to receive its first painted frame.
  await page.waitForFunction(() => {
    const c = document.getElementById('game-canvas');
    return c instanceof HTMLCanvasElement && c.width > 0 && c.height > 0;
  }, { timeout: 10000 });
  await waitForRender(page, 200);
  const intro = await screenshot(page, '01-intro');

  await page.click('#game-canvas');
  await page.keyboard.press('Enter');
  await waitForRender(page, 100);
  const gameplay = await screenshot(page, '02-gameplay');

  await page.keyboard.press('ArrowRight');
  await waitForRender(page);
  await page.keyboard.press('ArrowDown');
  await waitForRender(page, 100);
  const moved = await screenshot(page, '03-gameplay-moved');

  await page.click('[data-tab="editor"]');
  await waitForRender(page, 200);
  const editor = await screenshot(page, '04-editor');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Bitmap Font Validation</title>
  <style>
    body { margin: 0; padding: 24px; font-family: system-ui, sans-serif; background: #0b0d12; color: #fff; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    .grid { display: grid; gap: 18px; }
    figure { margin: 0; padding: 12px; border: 1px solid #2a2f3a; background: #11151d; }
    figcaption { margin-bottom: 10px; font-size: 14px; color: #cbd5e1; }
    img { display: block; width: 100%; max-width: 1280px; height: auto; image-rendering: pixelated; }
    pre { white-space: pre-wrap; color: #cbd5e1; }
  </style>
</head>
<body>
  <h1>Bitmap Font Validation</h1>
  <div class="grid">
    <figure><figcaption>01 - Intro</figcaption><img src="./01-intro.png" alt="Intro"></figure>
    <figure><figcaption>02 - Gameplay</figcaption><img src="./02-gameplay.png" alt="Gameplay"></figure>
    <figure><figcaption>03 - Gameplay moved</figcaption><img src="./03-gameplay-moved.png" alt="Gameplay moved"></figure>
    <figure><figcaption>04 - Editor</figcaption><img src="./04-editor.png" alt="Editor"></figure>
  </div>
  <h2>Console</h2>
  <pre>${consoleMessages.map((line) => line.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])).join('\n') || 'No console errors captured.'}</pre>
</body>
</html>`;
  await fs.writeFile(path.join(outDir, 'index.html'), html, 'utf8');
  await fs.writeFile(path.join(outDir, 'console.log'), consoleMessages.join('\n') || 'No console errors captured.', 'utf8');

  await browser.close();
  console.log(JSON.stringify({ intro, gameplay, moved, editor, gallery: path.join(outDir, 'index.html'), consoleMessages }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
