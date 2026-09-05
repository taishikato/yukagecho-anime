import { expect, test, type Page } from '@playwright/test';

// Intercept all Supabase traffic in these UI tests. No test emails or production writes.
async function registrationApi(
  page: Page,
  options: { race?: boolean; unavailable?: boolean; existing?: boolean } = {},
) {
  const id = '00000000-0000-4000-8000-000000000001';
  const user = {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.invalid',
    email_confirmed_at: new Date().toISOString(),
    is_anonymous: false,
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwtPart = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = `${jwtPart({ alg: 'HS256', typ: 'JWT' })}.${jwtPart({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' })}.test_signature`;
  let resident: { user_id: string; username: string; reserved_at: string } | null = null;

  let inserts = 0;
  let authorizations = 0;
  await page.route('https://*.supabase.co/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/rpc/username_available')) {
      if (options.unavailable)
        return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
      return route.fulfill({ json: request.postDataJSON().candidate !== 'taken_name' });
    }
    if (path.endsWith('/authorize')) {
      authorizations++;
      if (options.existing)
        resident = {
          user_id: id,
          username: 'existing_name',
          reserved_at: new Date().toISOString(),
        };
      const url = new URL(request.url());
      expect(url.searchParams.get('provider')).toBe('google');
      const redirect = url.searchParams.get('redirect_to')!;
      expect(new URL(redirect).pathname).toBe('/');
      return route.fulfill({
        status: 302,
        headers: {
          location:
            redirect +
            '#' +
            new URLSearchParams({
              access_token,
              refresh_token: 'test_refresh_token',
              expires_in: '3600',
              token_type: 'bearer',
            }).toString(),
        },
      });
    }
    if (path.endsWith('/logout')) return route.fulfill({ status: 204 });
    if (path.endsWith('/user')) return route.fulfill({ json: user });
    if (path.endsWith('/residents')) {
      if (request.method() === 'POST') {
        inserts++;
        const body = request.postDataJSON();
        if (body.username === 'taken_name' || (options.race && body.username === 'taishi'))
          return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate' } });
        resident = { user_id: id, username: body.username, reserved_at: new Date().toISOString() };
        return route.fulfill({ status: 201, json: resident });
      }
      return route.fulfill({ json: resident });
    }
    return route.fulfill({ status: 500, json: { error: 'Unexpected test request' } });
  });
  return {
    insertCount: () => inserts,
    authorizationCount: () => authorizations,
    loginReturnUrl: () =>
      '/#' +
      new URLSearchParams({
        access_token,
        refresh_token: 'test_refresh_token',
        expires_in: '3600',
        token_type: 'bearer',
      }).toString(),
  };
}

for (const mobile of [false, true]) {
  test(`registration flow, error recovery and session restoration (${mobile ? 'mobile' : 'desktop'})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const api = await registrationApi(page);
    await page.goto('/?join=1');
    const dialog = page.getByRole('dialog');
    await expect(page.getByRole('button', { name: /Read the notice/ })).toBeVisible();
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: /Read the notice/ }).click();
    await expect(
      dialog.getByRole('button', { name: 'Already a resident? Sign in with Google' }),
    ).toBeVisible();
    await expect(page.locator('[data-world-paused]')).toHaveAttribute('data-world-paused', 'true');
    await dialog.getByRole('button', { name: 'Already a resident? Sign in with Google' }).click();
    await expect(dialog.getByLabel('Username', { exact: true })).toBeVisible();
    await page.reload();
    await expect(dialog.getByLabel('Username', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: /Read the notice/ }).click();
    await expect(dialog.getByLabel('Username', { exact: true })).toBeVisible();
    await dialog.getByLabel('Username', { exact: true }).fill('ADMIN');
    await expect(
      dialog.getByRole('button', { name: 'Reserve username', exact: true }),
    ).toBeDisabled();
    await dialog.getByLabel('Username', { exact: true }).fill('taken_name');
    await dialog.getByRole('button', { name: 'Reserve username', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('already taken');
    await dialog.getByLabel('Username', { exact: true }).fill(' Taishi ');
    await expect(dialog.getByText('@taishi', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('alert')).not.toBeVisible();
    await page.screenshot({ path: `/tmp/yukagecho-claim-${mobile ? 'mobile' : 'desktop'}.png` });
    await dialog.getByRole('button', { name: 'Reserve username', exact: true }).click();
    await expect(dialog.getByText('Welcome to Yukagecho, @taishi.')).toBeVisible();
    expect(api.insertCount()).toBe(2);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.width).toBeLessThanOrEqual(mobile ? 390 : 1536);
    await page.screenshot({ path: `/tmp/yukagecho-resident-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.reload();
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: /Read the notice/ }).click();
    await expect(dialog.getByText('Welcome to Yukagecho, @taishi.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(dialog.getByText('Make yourself at home.')).toBeVisible();
    await expect(dialog.getByText('Welcome to Yukagecho, @taishi.')).not.toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('canvas')).toBeFocused();
    await expect(page.locator('[data-world-paused]')).toHaveAttribute('data-world-paused', 'false');
    await expect(page.getByText('0 / 7', { exact: true })).toBeVisible();
  });
}

test('nearby sign uses the same target for E and tap without recording a discovery', async ({
  page,
}) => {
  await registrationApi(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Save photo', exact: true })).toBeEnabled();
  await page.locator('canvas').focus();
  const notice = page.getByRole('button', { name: /Read the notice/ });
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(notice).toBeVisible();
  await page.screenshot({ path: '/tmp/yukagecho-registration-sign.png' });
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toContainText('Resident Registration');
  await page.keyboard.press('Escape');
  await expect(page.getByText('0 / 7', { exact: true })).toBeVisible();
  await notice.click();
  await expect(page.getByRole('dialog')).toContainText('Resident Registration');
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.locator('canvas')).toBeFocused();
});

test('Google callback signs in and opens username claim without interacting with the sign', async ({
  page,
}) => {
  const api = await registrationApi(page);
  await page.goto(api.loginReturnUrl());
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.locator('[data-world-paused]')).toHaveAttribute('data-world-paused', 'true');
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  expect(api.insertCount()).toBe(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('canvas')).toBeFocused();
  await page.reload();
  await expect(dialog.getByLabel('Username', { exact: true })).toBeVisible();
});

test('cancelled Google callback leaves registration available', async ({ page }) => {
  await registrationApi(page);
  await page.goto('/?signin=google#error=access_denied&error_description=Cancelled');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Already a resident? Sign in with Google' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

for (const mobile of [false, true]) {
  test(`username-first signup reserves on Google return (${mobile ? 'mobile' : 'desktop'})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const api = await registrationApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: /Read the notice/ }).click();
    const input = page.getByLabel('Username', { exact: true });
    const signup = page.getByRole('button', { name: 'Sign up and own username', exact: true });
    await expect(signup).toBeDisabled();
    await input.fill('taken_name');
    await signup.click();
    await expect(page.getByRole('alert')).toContainText('already taken');
    expect(api.authorizationCount()).toBe(0);
    expect(api.insertCount()).toBe(0);
    await input.fill(' Taishi ');
    await page.screenshot({
      path: `/tmp/yukagecho-username-first-${mobile ? 'mobile' : 'desktop'}.png`,
    });
    await signup.click();
    await expect(page.getByText('Welcome to Yukagecho, @taishi.')).toBeVisible();
    expect(api.authorizationCount()).toBe(1);
    expect(api.insertCount()).toBe(1);
    await page.reload();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(api.insertCount()).toBe(1);
  });
}

test('name taken during OAuth returns to name selection without retrying automatically', async ({
  page,
}) => {
  const api = await registrationApi(page, { race: true });
  await page.goto('/');
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await page.getByLabel('Username', { exact: true }).fill('taishi');
  await page.getByRole('button', { name: 'Sign up and own username' }).click();
  await expect(page.getByRole('alert')).toContainText('already taken');
  expect(api.insertCount()).toBe(1);
  await page.reload();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  expect(api.insertCount()).toBe(1);
  await page.getByLabel('Username', { exact: true }).fill('another_name');
  await page.getByRole('button', { name: 'Reserve username', exact: true }).click();
  await expect(page.getByText('Welcome to Yukagecho, @another_name.')).toBeVisible();
});

test('availability failure blocks OAuth and leaves the name editable', async ({ page }) => {
  const api = await registrationApi(page, { unavailable: true });
  await page.goto('/');
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await page.getByLabel('Username', { exact: true }).fill('taishi');
  await page.getByRole('button', { name: 'Sign up and own username' }).click();
  await expect(page.getByRole('alert')).toContainText('could not reach');
  await expect(page.getByLabel('Username', { exact: true })).toBeEnabled();
  expect(api.authorizationCount()).toBe(0);
});

test('signup with an existing resident account preserves the original name', async ({ page }) => {
  const api = await registrationApi(page, { existing: true });
  await page.goto('/');
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await page.getByLabel('Username', { exact: true }).fill('new_name');
  await page.getByRole('button', { name: 'Sign up and own username' }).click();
  await expect(page.getByText('Welcome to Yukagecho, @existing_name.')).toBeVisible();
  expect(api.insertCount()).toBe(0);
});
