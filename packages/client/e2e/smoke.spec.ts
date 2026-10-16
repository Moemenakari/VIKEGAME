import { expect, test, type Page } from '@playwright/test';

async function tapPlot(page: Page, id: string) {
  const p = await page.evaluate((plot) => window.__jarlheim!.screenPositionOf(plot), id);
  await page.mouse.click(p.x, p.y);
}

test('build, finish, save and claim a quest on a phone', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/?quality=low');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });
  await expect(page.getByTestId('resources')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/hold.png' });

  // Tap the Great Hall: its card opens.
  await tapPlot(page, 'hall');
  await expect(page.getByTestId('info-card')).toContainText('Great Hall');
  await page.getByLabel('Close').click();

  // Build button → Storehouse → place it where it stands (3 taps).
  await page.getByTestId('build-button').click();
  await expect(page.getByTestId('build-menu')).toBeVisible();
  await page.screenshot({ path: 'test-results/build-menu.png' });
  await page.getByTestId('build-storehouse').click();
  await expect(page.getByTestId('place-bar')).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/placing.png' });
  await page.getByTestId('place-ok').click();
  await expect
    .poll(() => page.evaluate(() => window.__jarlheim!.state().buildings.b1?.type))
    .toBe('storehouse');
  await expect(page.getByTestId('builders')).toContainText('1/2');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/construction.png' });

  // Finish it for free (under 5 minutes left).
  await tapPlot(page, 'b1');
  await page.getByTestId('finish-free').click();
  await expect.poll(() => page.evaluate(() => window.__jarlheim!.state().buildings.b1?.level)).toBe(1);

  // Pick it up and move it: tap the ground somewhere else, then confirm.
  await tapPlot(page, 'b1');
  await page.getByTestId('move').click();
  const before = await page.evaluate(() => window.__jarlheim!.state().buildings.b1!);
  const hall = await page.evaluate(() => window.__jarlheim!.screenPositionOf('hall'));
  const farm = await page.evaluate(() => window.__jarlheim!.screenPositionOf('b1'));
  await page.mouse.click(farm.x + (hall.x - farm.x) * 0.35, farm.y + (hall.y - farm.y) * 0.35 + 40);
  await page.waitForTimeout(300);
  if (await page.getByTestId('place-ok').isEnabled()) {
    await page.getByTestId('place-ok').click();
    await expect
      .poll(() => page.evaluate(() => window.__jarlheim!.state().buildings.b1!.x))
      .not.toBe(before.x);
  } else {
    await page.getByTestId('place-cancel').click();
  }
  await expect(page.getByTestId('place-bar')).toBeHidden();

  // Progress survives a reload (one save record in IndexedDB).
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__jarlheim!.state().buildings.b1?.level)).toBe(1);

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

test('raise a Shield Yard, train warriors and clear the first draugr barrow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?quality=low');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });
  const state = () => page.evaluate(() => window.__jarlheim!.state());

  // Great Hall to level 2 (finish free: the timer is under 5 minutes).
  await tapPlot(page, 'hall');
  await page.getByTestId('upgrade').click();
  await tapPlot(page, 'hall');
  await page.getByTestId('finish-free').click();
  await expect.poll(async () => (await state()).buildings.hall?.level).toBe(2);

  // Shield Yard wherever the game suggests.
  await page.getByTestId('build-button').click();
  await page.getByTestId('build-shieldYard').click();
  await page.getByTestId('place-ok').click();
  await page.waitForTimeout(1000); // let the camera settle
  await tapPlot(page, 'b1');
  await page.getByTestId('finish-free').click();
  await expect.poll(async () => (await state()).buildings.b1?.level).toBe(1);

  // Train 25 levies and finish the batch.
  await tapPlot(page, 'b1');
  await page.getByTestId('train-count').fill('25');
  await page.getByTestId('train').click();
  await page.getByTestId('train-finish-free').click();
  await expect.poll(async () => (await state()).army.troops['shieldwall-1']).toBe(25);
  await page.screenshot({ path: 'test-results/shield-yard.png' });
  await page.getByLabel('Close').click();

  // March on the barrow: the saga report opens.
  await page.getByTestId('army-button').click();
  await page.getByTestId('to-barrow').click();
  await page.screenshot({ path: 'test-results/barrow.png' });
  await page.getByTestId('attack').click();
  await expect(page.getByTestId('report')).toContainText('Victory');
  await page.screenshot({ path: 'test-results/report.png' });
  expect((await state()).pve.draugrCleared).toBe(1);

  expect(errors).toEqual([]);
});

test('the guide arrow leads to the next step, and the language switches to Arabic', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?quality=low');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });

  // First main quest: Great Hall level 2. The arrow opens the hall with Upgrade pulsing.
  await expect(page.getByTestId('guide')).toContainText('Great Hall');
  await page.getByTestId('guide-go').click();
  await expect(page.getByTestId('upgrade')).toHaveClass(/pulse/);
  await page.screenshot({ path: 'test-results/guide.png' });
  await page.getByTestId('upgrade').click();
  await expect(page.getByTestId('upgrade')).toBeHidden();

  // Daily quest arrow: "Produce Wheat" goes to the farm's plot or an empty plot.
  await page.getByTestId('quests-button').click();
  await expect(page.getByTestId('chest-track')).toBeVisible();
  await page.screenshot({ path: 'test-results/quests-daily.png' });
  // The Shield Yard needs Great Hall 2, which is still being raised: the arrow goes there first.
  await page.getByTestId('go-train-30').click();
  await expect(page.getByTestId('finish-free')).toHaveClass(/pulse/);
  await page.screenshot({ path: 'test-results/arrow-to-blocker.png' });
  await page.getByLabel('Close').click();

  // A locked building in the build menu is a link to what unlocks it.
  await page.getByTestId('build-button').click();
  await page.getByTestId('build-market').click();
  await expect(page.getByTestId('info-card')).toContainText('Great Hall');
  await page.getByLabel('Close').click();

  // The profile shows power, deeds and the realm; the language lives in Settings.
  await page.getByTestId('profile-button').click();
  await expect(page.getByTestId('profile-main')).toContainText('Uppsala');
  await page.screenshot({ path: 'test-results/profile.png' });
  await page.getByTestId('profile-tab-bag').click();
  await expect(page.getByTestId('bag')).toContainText('War Spoils');
  await page.getByTestId('use-chest-spoils').click();
  await page.screenshot({ path: 'test-results/bag.png' });
  await page.getByTestId('profile-tab-settings').click();
  await page.screenshot({ path: 'test-results/settings.png' });
  await page.getByTestId('lang-ar').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByLabel('إغلاق').click();
  await expect(page.getByTestId('guide')).toContainText('القاعة الكبرى');
  await page.screenshot({ path: 'test-results/arabic.png' });

  // Profile: pick a free picture.
  await page.getByTestId('profile-button').click();
  await page.getByTestId('profile-tab-profile').click();
  await page.getByTestId('avatar-2').click();
  expect(await page.evaluate(() => window.__jarlheim!.state().profile.avatar)).toBe(2);

  expect(errors).toEqual([]);
});

test('a palisade, and raiders called by the beacon sail in', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?quality=low');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });
  const state = () => page.evaluate(() => window.__jarlheim!.state());

  await tapPlot(page, 'hall');
  await page.getByTestId('upgrade').click();
  await tapPlot(page, 'hall');
  await page.getByTestId('finish-free').click();
  await expect.poll(async () => (await state()).buildings.hall?.level).toBe(2);

  await page.getByTestId('build-button').click();
  await page.getByTestId('build-palisade').click();
  await page.getByTestId('place-ok').click();
  await page.waitForTimeout(1000); // let the camera settle
  await tapPlot(page, 'b1');
  await page.getByTestId('finish-free').click();
  await expect.poll(async () => (await state()).buildings.b1?.level).toBe(1);

  await tapPlot(page, 'b1');
  await page.getByTestId('call-raid').click();
  await expect(page.getByTestId('raid-banner')).toBeVisible();
  await page.getByLabel('Close').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/raid.png' });
  expect((await state()).raid.incoming).not.toBeNull();
  expect(errors).toEqual([]);
});

test('the globe opens Midgard: realms, alliances, the King and the wars', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?quality=low');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });

  await page.getByTestId('globe').click();
  await expect(page.getByTestId('world-map')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/world.png' });
  await page.getByTestId('alliances-button').click();
  await page.getByTestId('join-VAR').click();
  expect(await page.evaluate(() => window.__jarlheim!.state().world.alliance)).toBe(2);
  await page.screenshot({ path: 'test-results/alliances.png' });
  await page.getByTestId('events-button').click();
  await expect(page.getByTestId('events')).toContainText("King's War");
  await page.screenshot({ path: 'test-results/events.png' });
  await page.getByLabel('Close').click();
  await page.getByTestId('realm-2').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/realm2.png' });
  await page.getByTestId('world-home').click();
  await expect(page.getByTestId('world-map')).toBeHidden();
  expect(errors).toEqual([]);
});

test('sign up with a username, chat in the realm, gift a rose and message a friend', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?quality=low&chat=local');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });

  await page.getByTestId('chat-button').click();
  await expect(page.getByTestId('sign-in')).toBeVisible();
  await page.screenshot({ path: 'test-results/sign-in.png' });
  await page.getByTestId('pw-mode').click();
  await page.getByTestId('username').fill('astrid_88');
  await page.getByTestId('password').fill('secret123');
  await page.getByTestId('pw-submit').click();

  await expect(page.getByTestId('conversation')).toContainText('Hail, settlers');
  await page.getByTestId('chat-input').fill('Hail from the north!');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('conversation')).toContainText('Hail from the north!');
  await page.getByTestId('react-🌹').first().click();
  await expect(page.getByTestId('react-🌹').first()).toContainText('1');
  await page.screenshot({ path: 'test-results/chat.png' });

  await page.getByTestId('chat-friends').click();
  await page.getByTestId('dm-Sigrun').click();
  await page.getByTestId('chat-input').fill('See you at the barrow');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('conversation')).toContainText('See you at the Thing');
  expect(errors).toEqual([]);
});

test('heroes: recruit with Saga Horns, see the odds, put a hero in the squad', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?quality=low');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });

  await page.getByTestId('side-hero-0').click();
  await expect(page.getByTestId('heroes')).toContainText('Bóndi');
  await page.screenshot({ path: 'test-results/heroes.png' });
  await page.getByTestId('heroes-tab-recruit').click();
  await expect(page.getByTestId('horns')).toHaveText('3');
  await page.getByTestId('recruit-1').click();
  await expect(page.getByTestId('drawn')).toBeVisible();
  await expect(page.getByTestId('horns')).toHaveText('2');
  await page.screenshot({ path: 'test-results/recruit.png' });
  const owned = await page.evaluate(() => Object.keys(window.__jarlheim!.state().heroes.owned));
  expect(owned.length).toBeGreaterThanOrEqual(1);
  await page.getByTestId('heroes-tab-heroes').click();
  await page.getByTestId('hero-ketil').click();
  await expect(page.getByTestId('hero-detail')).toBeVisible();
  await page.screenshot({ path: 'test-results/hero-detail.png' });
  expect(errors).toEqual([]);
});

test('online: after signing in, the realm shows player alliances and other players', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?quality=low&chat=local');
  await page.waitForFunction(() => window.__jarlheim?.ready === true, undefined, { timeout: 30_000 });

  await page.getByTestId('globe').click();
  await page.getByTestId('alliances-button').click();
  await expect(page.getByTestId('online-sign-in')).toBeVisible();
  await page.getByTestId('online-sign-in').click();
  await page.getByTestId('guest').click();
  await page.getByTestId('chat-name').fill('Astrid');
  await page.getByTestId('chat-name-save').click();
  await expect(page.getByTestId('conversation')).toBeVisible();
  await page.getByLabel('Close').click();

  // Signed in: your hold is on the shared map with the other players of the realm.
  await page.getByTestId('globe').click();
  await expect(page.getByTestId('world-map')).toHaveAttribute('data-players', '2');
  await page.getByTestId('alliances-button').click();
  await expect(page.getByTestId('player-alliances')).toContainText('Ravens of Odin');
  await page.screenshot({ path: 'test-results/online-alliances.png' });
  expect(errors).toEqual([]);
});
