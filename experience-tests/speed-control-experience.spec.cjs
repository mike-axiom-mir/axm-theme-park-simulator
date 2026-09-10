const { test, expect } = require('@playwright/test');

async function openPlayablePark(page) {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__AXM_GAME__))).toBe(true);
  await page.locator('#campaign-button').click();
  const skip = page.locator('#skip-opening');
  if (await skip.isVisible()) await skip.click();
  await expect.poll(() => page.evaluate(() => globalThis.__AXM_GAME__.health().opening)).toBe(false);
}

async function expectDirectHitTarget(page, selector) {
  const result = await page.locator(selector).evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      width: rect.width,
      height: rect.height,
      direct: hit === button || button.contains(hit),
      hit: hit?.id || hit?.className || hit?.tagName || null
    };
  });
  expect(result.width).toBeGreaterThanOrEqual(44);
  expect(result.height).toBeGreaterThanOrEqual(44);
  expect(result.direct, `center hit was intercepted by ${result.hit}`).toBe(true);
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'phone', width: 390, height: 844 }
]) {
  test(`${viewport.name} simulation speed remains reachable in a clear feedback stack`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await openPlayablePark(page);

    const controls = page.locator('.speed-controls');
    const guestPulse = page.locator('#guest-pulse');
    const removePath = page.locator('#remove-path-button');
    await expect(controls).toBeVisible();
    await expect(guestPulse).toBeVisible();
    await expect(controls).toHaveAttribute('role', 'group');

    const controlBox = await controls.boundingBox();
    const guestBox = await guestPulse.boundingBox();
    const removeBox = await removePath.boundingBox();
    expect(controlBox).not.toBeNull();
    expect(guestBox).not.toBeNull();
    expect(removeBox).not.toBeNull();
    expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(guestBox.y - 8);
    expect(guestBox.y + guestBox.height).toBeLessThanOrEqual(removeBox.y - 8);

    const speeds = ['0', '1', '3', '8'];
    for (const speed of speeds) {
      const selector = `[data-speed="${speed}"]`;
      await expectDirectHitTarget(page, selector);
      await page.locator(selector).click();
      await expect(page.locator(selector)).toHaveClass(/active/);
      await expect(page.locator(selector)).toHaveAttribute('aria-pressed', 'true');
      for (const other of speeds.filter((value) => value !== speed)) {
        await expect(page.locator(`[data-speed="${other}"]`)).toHaveAttribute('aria-pressed', 'false');
      }
    }

    await page.locator('[data-speed="0"]').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('[data-speed="0"]')).toHaveAttribute('aria-pressed', 'true');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.screenshot({
      path: `experience-artifacts/speed-control-${viewport.name}.png`,
      fullPage: true
    });
  });
}
