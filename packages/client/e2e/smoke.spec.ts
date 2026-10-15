import { expect, test } from '@playwright/test';

test('the hold loads on a phone and the Great Hall can be tapped', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });
  await expect(page.getByTestId('resources')).toBeVisible();

  // Let the splash fade and a few frames render, then keep a screenshot for the README / CI artifact.
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/hold.png' });

  const hall = await page.evaluate(() => window.__jarlheim!.screenPositionOf('great-hall'));
  await page.mouse.click(hall.x, hall.y);
  await expect(page.getByTestId('info-card')).toContainText('Great Hall');
  await page.screenshot({ path: 'test-results/hold-selected.png' });

  expect(errors).toEqual([]);
});
