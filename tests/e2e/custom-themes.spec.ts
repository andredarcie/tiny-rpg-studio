import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`Custom Themes catalog installation, colors and removal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const defaultMainColor = await page.locator('main').evaluate(node => getComputedStyle(node).backgroundColor);
    const defaultGameTabsColor = await page.locator('.tabs').evaluate(node => getComputedStyle(node).backgroundColor);
    const defaultGameButtonColor = await page.locator('[data-tab="game"]').evaluate(node => getComputedStyle(node).backgroundColor);
    await page.click('button[data-tab="editor"]');
    const root = page.locator('#tab-editor');
    const originalColor = await root.evaluate(node => getComputedStyle(node).backgroundColor);
    const bodyColor = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
    const defaultSaveColor = await page.locator('#btn-manual-save').evaluate(node => getComputedStyle(node).backgroundColor);
    await page.click('#btn-plugins');
    await page.fill('#plugins-query', 'Custom Themes');
    await page.locator('[data-plugin-id="custom-themes"] [data-action="install"]').click();
    await page.click('#plugins-modal .tiny-modal__close');
    const trigger = page.getByRole('button', { name: 'Theme: Default' });
    const menu = page.getByRole('menu', { name: 'Editor theme' });
    await expect(trigger).toBeVisible();
    await expect(menu).toBeHidden();
    const toolbarBox = await trigger.boundingBox();
    const layoutBox = await page.locator('.editor-layout').boundingBox();
    expect(toolbarBox && layoutBox && toolbarBox.y < layoutBox.y).toBe(true);
    for (const [theme, mainColor, panelColor, controlColor] of [
      ['Darker', 'rgb(0, 0, 0)', 'rgb(8, 8, 8)', 'rgb(17, 17, 17)'],
      ['Dracula', 'rgb(8, 6, 9)', 'rgb(19, 12, 18)', 'rgb(33, 16, 25)'],
      ['Powershell', 'rgb(1, 36, 86)', 'rgb(7, 52, 109)', 'rgb(11, 64, 126)'],
      ['Light', 'rgb(255, 255, 255)', 'rgb(245, 247, 250)', 'rgb(255, 255, 255)'],
      ['Forest', 'rgb(7, 21, 13)', 'rgb(16, 37, 26)', 'rgb(25, 53, 35)'],
      ['Sepia', 'rgb(251, 243, 227)', 'rgb(241, 229, 206)', 'rgb(255, 248, 235)'],
    ]) {
      await page.locator('.custom-themes-trigger').click();
      await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
      await expect(page.locator('main')).toHaveCSS('background-color', mainColor);
      await expect(root).toHaveCSS('background-color', panelColor);
      await expect(page.locator('.tabs')).toHaveCSS('background-color', panelColor);
      await expect(page.locator('[data-tab="game"]')).toHaveCSS('background-color', controlColor);
      await expect(page.locator('#btn-manual-save')).toHaveCSS('background-color', controlColor);
      await expect(menu).toBeHidden();
      await expect(page.locator('body')).toHaveCSS('background-color', bodyColor);
    }
    await page.locator('.custom-themes-trigger').click();
    await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
    await expect(page.locator('.custom-themes-trigger')).toHaveCSS('color', 'rgb(23, 32, 46)');
    await page.click('button[data-tab="game"]');
    await expect(page.locator('main')).toHaveCSS('background-color', defaultMainColor);
    await expect(page.locator('.tabs')).toHaveCSS('background-color', defaultGameTabsColor);
    await expect(page.locator('[data-tab="game"]')).toHaveCSS('background-color', defaultGameButtonColor);
    await page.click('button[data-tab="editor"]');
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.tabs')).toHaveCSS('background-color', 'rgb(245, 247, 250)');
    await expect(page.locator('#btn-manual-save')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.locator('.custom-themes-trigger').press('ArrowDown');
    await expect(page.getByRole('menuitemradio', { name: 'Light', exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toHaveCSS('background-color', defaultMainColor);
    await expect(root).toHaveCSS('background-color', originalColor);
    await expect(page.locator('#btn-manual-save')).toHaveCSS('background-color', defaultSaveColor);
    await expect(page.locator('.custom-themes-trigger')).toHaveText('Theme: Default ▾');
    await page.locator('.custom-themes-trigger').click();
    await page.getByRole('menuitemradio', { name: 'Darker', exact: true }).click();
    await page.reload();
    await page.click('button[data-tab="editor"]');
    await expect(page.locator('.custom-themes-trigger')).toHaveText('Theme: Darker ▾');
    await expect(root).toHaveCSS('background-color', 'rgb(8, 8, 8)');
    expect(await page.evaluate(() => localStorage.getItem('tiny-rpg-custom-themes-theme-v1'))).toBe('darker');
    await page.click('#btn-plugins');
    await page.click('#plugins-manage');
    await page.locator('[data-plugin-id="custom-themes"] [data-action="remove"]').click();
    await page.click('#plugins-modal .tiny-modal__close');
    await expect(page.locator('.custom-themes-toolbar')).toHaveCount(0);
    await expect(page.locator('main')).toHaveCSS('background-color', defaultMainColor);
    await expect(root).toHaveCSS('background-color', originalColor);
  });
}
