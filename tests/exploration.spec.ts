import { expect, test } from '@playwright/test';

test('exploration, journal persistence, camera, audio, night and photo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: '写真を保存', exact: true })).toBeEnabled();
  await page.locator('canvas').focus();
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('旅の手帖に記しました');
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 / 4', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '写真を保存', exact: true })).toBeEnabled();
  await expect(page.getByText('1 / 4', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('dialog')).toContainText('旅の手帖');
  await expect(world).toHaveAttribute('data-world-paused', 'true');
  const pausedZ = Number(await world.getAttribute('data-world-z'));
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  expect(Number(await world.getAttribute('data-world-z'))).toBe(pausedZ);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '環境音をオン', exact: true }).click();
  await expect(page.getByRole('button', { name: '環境音をオフ', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '環境音をオフ', exact: true }).click();
  await page.getByRole('button', { name: '夜にする', exact: true }).click();
  await expect(page.getByRole('button', { name: '夕暮れにする', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '夕暮れにする', exact: true }).click();
  const toolbarZ = Number(await world.getAttribute('data-world-z'));
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await expect
    .poll(async () => Number(await world.getAttribute('data-world-z')))
    .toBeLessThan(toolbarZ - 1);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '写真を保存', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^yukagecho-\d+\.png$/);
  await download.saveAs('/tmp/yukagecho-photo.png');
  await page.locator('canvas').focus();
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: 'H · 旅の画面に戻る', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '操作ガイド', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('湯影町の歩き方');
  await page.screenshot({ path: '/tmp/yukagecho-help.png' });
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('mobile controls and dialog fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: '写真を保存', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '前へ', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/yukagecho-mobile.png' });
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(size.scroll).toBe(size.viewport);
  const before = Number(await page.locator('[data-world-z]').getAttribute('data-world-z'));
  const up = page.getByRole('button', { name: '前へ', exact: true });
  const bounds = await up.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect
    .poll(async () => Number(await page.locator('[data-world-z]').getAttribute('data-world-z')))
    .toBeLessThan(before - 1);
  await page.getByRole('button', { name: '地図と旅の手帖を開く', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialogBox = await page.getByRole('dialog').boundingBox();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.width).toBeLessThanOrEqual(390);
});

test('walks across all three bridges and completes the four-place journal', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: '写真を保存', exact: true })).toBeEnabled();
  const world = page.locator('[data-world-x]');
  async function walkTo(x: number, z: number) {
    await page.locator('canvas').focus();
    const deadline = Date.now() + 25_000;
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
  await discover('湯あかり通り');
  for (const [x, z] of [
    [0, 1.8],
    [14, 1.8],
    [17, 3.4],
    [27, 5.4],
    [31.5, 11.8],
  ])
    await walkTo(x, z);
  await discover('雲渡りの湯');
  await page.screenshot({ path: '/tmp/yukagecho-onsen.png' });
  for (const [x, z] of [
    [27, 5.4],
    [16, 3.2],
    [13, 1.8],
    [0, 1.8],
    [0, -15],
    [1, -29],
    [2, -36],
  ])
    await walkTo(x, z);
  await discover('望雲楼');
  for (const [x, z] of [
    [1, -29],
    [0, -15],
    [0, 1.8],
    [-13, 1.8],
    [-14, -7.6],
    [-25, -13.6],
    [-30, -14],
  ])
    await walkTo(x, z);
  await discover('風待ち神社');
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog')).toContainText(
    '四つの風景が、あなたの旅の記憶になりました。',
  );
  await page.screenshot({ path: '/tmp/yukagecho-complete.png' });
});
