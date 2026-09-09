const { test, expect } = require('@playwright/test');

const SAVE_SCHEMA = 'axm.theme-park.playable-save';

function filePayload(name, payload) {
  return {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload))
  };
}

async function openParkMenu(page) {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__AXM_GAME__))).toBe(true);
  await page.locator('#campaign-button').click();
  const skip = page.locator('#skip-opening');
  if (await skip.isVisible()) await skip.click();
  await expect.poll(() => page.evaluate(() => globalThis.__AXM_GAME__.health().opening)).toBe(false);

  // Test scaffolding only: pause the deterministic simulation without depending on
  // the current visual stacking of the compact speed control under the build dock.
  await page.locator('[data-speed="0"]').evaluate((button) => button.click());
  const pausedTick = await page.evaluate(() => globalThis.__AXM_GAME__.getState().tick);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => globalThis.__AXM_GAME__.getState().tick)).toBe(pausedTick);

  await page.locator('#menu-button').click();
  await expect(page.locator('#menu-dialog')).toHaveAttribute('open', '');
}

function currentVersionPayload(state) {
  return {
    schema: SAVE_SCHEMA,
    version: 3,
    savedAt: new Date().toISOString(),
    state: structuredClone(state)
  };
}

test('held imports explain why, preserve the open park, and recover without hidden authority', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await openParkMenu(page);

  const before = await page.evaluate(() => globalThis.__AXM_GAME__.getState());
  const beforeText = JSON.stringify(before);
  const missingHash = currentVersionPayload(before);
  delete missingHash.state.stateHash;

  const input = page.locator('#import-input');
  const panel = page.locator('#save-import-status');
  await input.setInputFiles(filePayload('missing-integrity.json', missingHash));

  await expect(panel).toBeVisible();
  await expect(panel).toBeInViewport();
  await expect(panel).toHaveAttribute('data-tone', 'held');
  await expect(panel.locator('[data-save-import-code]')).toHaveText('AXM_SAVE_INTEGRITY_REQUIRED');
  await expect(panel.locator('[data-save-import-title]')).toContainText('integrity evidence missing');
  await expect(panel.locator('[data-save-import-body]')).toContainText('Your open park was not replaced');
  await expect(page.locator('#import-input')).toHaveValue('');
  expect(JSON.stringify(await page.evaluate(() => globalThis.__AXM_GAME__.getState()))).toBe(beforeText);

  await page.screenshot({ path: 'experience-artifacts/save-import-held-desktop.png' });

  await panel.locator('[data-save-import-dismiss]').click();
  await expect(panel).toBeHidden();

  const mismatched = currentVersionPayload(before);
  mismatched.state.park.name = `${mismatched.state.park.name} altered`;
  await input.setInputFiles(filePayload('hash-mismatch.json', mismatched));
  await expect(panel).toBeVisible();
  await expect(panel).toBeInViewport();
  await expect(panel.locator('[data-save-import-code]')).toHaveText('AXM_SAVE_HASH_MISMATCH');
  await expect(panel.locator('[data-save-import-title]')).toContainText('integrity check failed');
  expect(JSON.stringify(await page.evaluate(() => globalThis.__AXM_GAME__.getState()))).toBe(beforeText);

  await input.setInputFiles(filePayload('valid-save.json', currentVersionPayload(before)));
  await expect(panel).toBeHidden();
  await expect(page.locator('#toasts')).toContainText('Imported and verified the park save.');

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('phone-width held import is automatically revealed and remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openParkMenu(page);

  const before = await page.evaluate(() => globalThis.__AXM_GAME__.getState());
  const missingHash = currentVersionPayload(before);
  delete missingHash.state.stateHash;

  const panel = page.locator('#save-import-status');
  await page.locator('#import-input').setInputFiles(filePayload('missing-integrity-mobile.json', missingHash));

  await expect(panel).toBeVisible();
  await expect(panel).toBeInViewport();
  await expect(panel.locator('[data-save-import-choose]')).toBeInViewport();
  await expect(panel.locator('[data-save-import-dismiss]')).toBeInViewport();
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.screenshot({ path: 'experience-artifacts/save-import-held-mobile.png' });
});
