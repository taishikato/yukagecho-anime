import { expect, test } from '@playwright/test';

test('exploration, journal persistence, camera, audio, night and photo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Save photo', exact: true })).toBeEnabled();
  await page.locator('canvas').focus();
  await page.keyboard.down('w');
  try {
    await expect(page.getByRole('button', { name: /Follow the lanterns/ })).toBeVisible();
  } finally {
    await page.keyboard.up('w');
  }
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Added to your travel journal');
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 / 7', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Save photo', exact: true })).toBeEnabled();
  await expect(page.getByText('1 / 7', { exact: true })).toBeVisible();
  // Wait for the camera's documented entry transition before the visual snapshot.
  await page.waitForTimeout(1800);
  await page.screenshot({ path: '/tmp/yukagecho-desktop.png' });
  const world = page.locator('[data-world-x]');
  const startZ = Number(await world.getAttribute('data-world-z'));
  await page.locator('canvas').focus();
  await page.keyboard.down('w');
  await page.waitForTimeout(1100);
  await page.keyboard.up('w');
  await expect
    .poll(async () => Number(await world.getAttribute('data-world-z')))
    .toBeLessThan(startZ - 2);
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog')).toContainText('Travel journal');
  await expect(world).toHaveAttribute('data-world-paused', 'true');
  const pausedZ = Number(await world.getAttribute('data-world-z'));
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  expect(Number(await world.getAttribute('data-world-z'))).toBe(pausedZ);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Enable ambient sound', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Mute ambient sound', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mute ambient sound', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to night', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Switch to dusk', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dusk', exact: true }).click();
  const toolbarZ = Number(await world.getAttribute('data-world-z'));
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await expect
    .poll(async () => Number(await world.getAttribute('data-world-z')))
    .toBeLessThan(toolbarZ - 1);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save photo', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^yukagecho-\d+\.png$/);
  await download.saveAs('/tmp/yukagecho-photo.png');
  await page.locator('canvas').focus();
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: 'H · Show interface', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('How to explore');
  await page.screenshot({ path: '/tmp/yukagecho-help.png' });
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('mobile controls and dialog fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Save photo', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Move forward', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/yukagecho-mobile.png' });
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(size.scroll).toBe(size.viewport);
  const before = Number(await page.locator('[data-world-z]').getAttribute('data-world-z'));
  const up = page.getByRole('button', { name: 'Move forward', exact: true });
  const bounds = await up.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect
    .poll(async () => Number(await page.locator('[data-world-z]').getAttribute('data-world-z')))
    .toBeLessThan(before - 1);
  await page.getByRole('button', { name: 'Open map and travel journal', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialogBox = await page.getByRole('dialog').boundingBox();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.width).toBeLessThanOrEqual(390);
});

test('walks around the main island, crosses every canal bridge and completes the journal', async ({
  page,
}) => {
  // Exercise actual keyboard movement through every district and back to arrival.
  test.setTimeout(420_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Save photo', exact: true })).toBeEnabled();
  const world = page.locator('[data-world-x]');
  async function walkTo(x: number, z: number, segment = false) {
    if (!segment) {
      const start = await world.evaluate((el) => ({
        x: Number(el.getAttribute('data-world-x')),
        z: Number(el.getAttribute('data-world-z')),
      }));
      const steps = Math.ceil(Math.hypot(x - start.x, z - start.z) / 3);
      for (let step = 1; step <= steps; step++)
        await walkTo(
          start.x + ((x - start.x) * step) / steps,
          start.z + ((z - start.z) * step) / steps,
          true,
        );
      return;
    }
    await page.locator('canvas').focus();
    const deadline = Date.now() + 35_000;
    while (Date.now() < deadline) {
      const current = await world.evaluate((el) => ({
        x: Number(el.getAttribute('data-world-x')),
        z: Number(el.getAttribute('data-world-z')),
        yaw: Number(el.getAttribute('data-world-yaw')),
      }));
      const dx = x - current.x,
        dz = z - current.z;
      if (Math.hypot(dx, dz) < 0.85) return;
      const side = dx * Math.cos(current.yaw) - dz * Math.sin(current.yaw);
      const forward = -dx * Math.sin(current.yaw) - dz * Math.cos(current.yaw);
      const threshold = Math.max(Math.abs(side), Math.abs(forward)) * 0.2;
      const keys: string[] = [];
      if (Math.abs(side) > threshold) keys.push(side > 0 ? 'd' : 'a');
      if (Math.abs(forward) > threshold) keys.push(forward > 0 ? 'w' : 's');
      for (const key of keys) await page.keyboard.down(key);
      await page.waitForTimeout(160);
      for (const key of keys) await page.keyboard.up(key);
      await page.waitForTimeout(150);
    }
    throw new Error(
      `Could not reach ${x},${z}; stopped at ${await world.getAttribute('data-world-x')},${await world.getAttribute('data-world-z')}`,
    );
  }
  async function discover(name: string) {
    await page.locator('canvas').focus();
    await page.keyboard.press('e');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name, exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await walkTo(0, 37);
  await discover('Yuakari Promenade');
  for (const [x, z] of [
    [0, 30],
    [28, 30],
  ])
    await walkTo(x, z);
  await discover('Sakura Springs');
  await page.screenshot({ path: '/tmp/yukagecho-springs.png' });
  for (const [x, z] of [
    [17, 30],
    [17, 16],
    [17, 4],
  ])
    await walkTo(x, z);
  await discover('Lantern Canal');
  await page.screenshot({ path: '/tmp/yukagecho-canal.png' });
  // All three low bridges must be traversable, not just visible scenery.
  for (const [x, z] of [
    [17, -27],
    [27, -27],
    [27, -12],
    [17, -12],
    [17, 4],
    [27, 4],
    [27, 16],
    [42, 16],
    [42, 13],
  ])
    await walkTo(x, z);
  await discover('Kumowatari Onsen');
  await page.screenshot({ path: '/tmp/yukagecho-onsen.png' });
  for (const [x, z] of [
    [42, 16],
    [0, 16],
    [-39, 16],
    [-39, 26],
  ])
    await walkTo(x, z);
  await discover('Cloudsea Walk');
  for (const [x, z] of [
    [-39, 16],
    [-47, 16],
    [-47, -12],
    [-35, -12],
    [-35, -18],
  ])
    await walkTo(x, z);
  await discover('Kazemachi Shrine');
  for (const [x, z] of [
    [-35, -12],
    [-17, -12],
    [-17, 0],
    [0, 0],
    [0, -23],
  ])
    await walkTo(x, z);
  await expect
    .poll(async () => Number(await world.getAttribute('data-world-y')))
    .toBeCloseTo(6.15, 1);
  await discover('Bounro Ryokan');
  await page.screenshot({ path: '/tmp/yukagecho-ryokan.png' });
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog')).toContainText('Every place is now part of your journey.');
  await page.screenshot({ path: '/tmp/yukagecho-complete.png' });
  await page.keyboard.press('Escape');
  for (const [x, z] of [
    [0, 0],
    [0, 37],
  ])
    await walkTo(x, z);
  await expect
    .poll(async () => Number(await world.getAttribute('data-world-y')))
    .toBeCloseTo(0.15, 1);
  await discover('Yuakari Promenade');
});

test('reports a failed ryokan asset and recovers after reloading', async ({ page }) => {
  await page.route('**/models/bounro-ryokan.glb', (route) => route.abort());
  await page.goto('/');
  await expect(
    page.getByText('The ryokan model could not load. Please reload the page.'),
  ).toBeVisible();
  await page.unroute('**/models/bounro-ryokan.glb');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Save photo', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Read the notice/ })).toBeVisible();
});
