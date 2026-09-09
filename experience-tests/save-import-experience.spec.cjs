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
  await page.locator('[data-speed="0"]').click();
  await page.locator('#menu-button').click();
  await expect(page.locator('#menu-dialog')).toHaveAttribute('open', '');
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
  const missingHash = {
    schema: SAVE_SCHEMA,
    version: 3,
    savedAt: new Date().toISOString(),
    state: structuredClone(before)
  };
  delete missingHash.state.stateHash;

  const input = page.locator('#import-input');
  const panel = page.locator('#save-import-status');
  await input.setInputFiles(filePayload('missing-integrity.json', missingHash));

  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-tone', 'held');
  await expect(panel.locator('[data-save-import-code]')).toHaveText('AXM_SAVE_INTEGRITY_REQUIRED');
  await expect(panel.locator('[data-save-import-title]')).toContainText('integrity evidence missing');
  await expect(panel.locator('[data-save-import-body]')).toContainText('Your open park was not replaced');
  await expect(page.locator('#import-input')).toHaveValue('');
  expect(JSON.stringify(await page.evaluate(() => globalThis.__AXM_GAME__.getState()))).toBe(beforeText);

  await page.screenshot({ path: 'experience-artifacts/save-import-held-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBounds = await panel.boundingBox();
  expect(mobileBounds).not.toBeNull();
  expect(mobileBounds.x).toBeGreaterThanOrEqual(0);
  expect(mobileBounds.x + mobileBounds.width).toBeLessThanOrEqual(390);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'experience-artifacts/save-import-held-mobile.png', fullPage: true });

  await panel.locator('[data-save-import-dismiss]').click();
  await expect(panel).toBeHidden();

  const mismatched = {
    schema: SAVE_SCHEMA,
    version: 3,
    savedAt: new Date().toISOString(),
    state: structuredClone(before)
  };
  mismatched.state.park.name = `${mismatched.state.park.name} altered`;
  await input.setInputFiles(filePayload('hash-mismatch.json', mismatched));
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-save-import-code]')).toHaveText('AXM_SAVE_HASH_MISMATCH');
  await expect(panel.locator('[data-save-import-title]')).toContainText('integrity check failed');
  expect(JSON.stringify(await page.evaluate(() => globalThis.__AXM_GAME__.getState()))).toBe(beforeText);

  await input.setInputFiles(filePayload('valid-save.json', {
    schema: SAVE_SCHEMA,
    version: 3,
    savedAt: new Date().toISOString(),
    state: structuredClone(before)
  }));
  await expect(page.locator('#menu-dialog')).not.toHaveAttribute('open', '');
  await expect(page.locator('#toasts')).toContainText('Imported and verified the park save.');

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
