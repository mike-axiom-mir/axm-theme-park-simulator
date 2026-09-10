const { test, expect } = require('@playwright/test');

async function openPlayablePark(page) {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__AXM_GAME__))).toBe(true);
  await page.locator('#campaign-button').click();
  const skip = page.locator('#skip-opening');
  if (await skip.isVisible()) await skip.click();
  await expect.poll(() => page.evaluate(() => globalThis.__AXM_GAME__.health().opening)).toBe(false);
}

async function expectDirectTarget(page, locator) {
  const result = await locator.evaluate((button) => {
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
  test(`${viewport.name} park gate truth is visible and leads to the existing control`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await openPlayablePark(page);

    const gateStatus = page.locator('#park-gate-status');
    const gateValue = gateStatus.locator('b');
    const gateControl = page.locator('#park-open-button');
    const menu = page.locator('#menu-dialog');
    const initialOpen = await page.evaluate(() => globalThis.__AXM_GAME__.getState().park.open);

    await expect(gateStatus).toBeVisible();
    await expect(gateStatus).toBeEnabled();
    await expect(gateValue).toHaveText(initialOpen ? 'OPEN' : 'CLOSED');
    await expect(gateStatus).toHaveAttribute('data-open', String(initialOpen));
    await expectDirectTarget(page, gateStatus);

    await gateStatus.click();
    await expect(menu).toBeVisible();
    await expect(gateControl).toBeFocused();
    await expect(gateControl).toHaveText(initialOpen ? 'Close park' : 'Open park');
    await page.screenshot({
      path: `experience-artifacts/park-gate-${viewport.name}-settings.png`,
      fullPage: true
    });

    await gateControl.click();
    await expect.poll(() => page.evaluate(() => globalThis.__AXM_GAME__.getState().park.open)).toBe(!initialOpen);
    await expect(gateValue).toHaveText(initialOpen ? 'CLOSED' : 'OPEN');
    await expect(gateStatus).toHaveAttribute('data-open', String(!initialOpen));

    await page.locator('[data-close-dialog="menu-dialog"]').click();
    await expect(menu).not.toBeVisible();
    await expect(gateStatus).toBeVisible();
    await page.screenshot({
      path: `experience-artifacts/park-gate-${viewport.name}-changed.png`,
      fullPage: true
    });

    await gateStatus.click();
    await expect(gateControl).toBeFocused();
    await gateControl.click();
    await expect.poll(() => page.evaluate(() => globalThis.__AXM_GAME__.getState().park.open)).toBe(initialOpen);
    await expect(gateValue).toHaveText(initialOpen ? 'OPEN' : 'CLOSED');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
}
