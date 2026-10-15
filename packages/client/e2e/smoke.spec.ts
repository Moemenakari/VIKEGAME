import { expect, test, type Page } from '@playwright/test';

async function tapPlot(page: Page, id: string) {
  const p = await page.evaluate((plot) => window.__jarlheim!.screenPositionOf(plot), id);
  await page.mouse.click(p.x, p.y);
}

test('build, finish, save and claim a quest on a phone', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });
  await expect(page.getByTestId('resources')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/hold.png' });

  // Tap the Great Hall: its card opens.
  await tapPlot(page, 'hall');
  await expect(page.getByTestId('info-card')).toContainText('Great Hall');
  await page.getByLabel('Close').click();

  // Tap an open plot and raise a Storehouse (2 taps).
  await tapPlot(page, 'a3');
  await expect(page.getByTestId('build-menu')).toBeVisible();
  await page.screenshot({ path: 'test-results/build-menu.png' });
  await page.getByTestId('build-storehouse').click();
  await expect(page.getByTestId('build-menu')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.__jarlheim!.state().buildings.a3?.type))
    .toBe('storehouse');
  await expect(page.getByTestId('builders')).toContainText('1/2');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/construction.png' });

  // Finish it for free (under 5 minutes left).
  await tapPlot(page, 'a3');
  await page.getByTestId('finish-free').click();
  await expect.poll(() => page.evaluate(() => window.__jarlheim!.state().buildings.a3?.level)).toBe(1);

  // Progress survives a reload (one save record in IndexedDB).
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__jarlheim!.state().buildings.a3?.level)).toBe(1);

  // The free-finish daily quest pays Gold.
  const goldBefore = await page.evaluate(() => window.__jarlheim!.state().resources.gold);
  await page.getByTestId('quests-button').click();
  await page.getByTestId('claim-free-finish').click();
  await expect
    .poll(() => page.evaluate(() => window.__jarlheim!.state().resources.gold))
    .toBe(goldBefore + 5);
  await page.screenshot({ path: 'test-results/quests.png' });

  expect(errors).toEqual([]);
});
