// Requires a production frontend build and Chromium (npx playwright install chromium).
// Runs only against profile.integration.cjs, which owns a temporary isolated JSON database.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:3100';

async function waitForServer(child) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Isolated test server exited (${child.exitCode})`);
    try {
      const response = await fetch(`${base}/login`);
      if (response.ok) return;
    } catch { /* Wait for Nest to finish starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the isolated UI/API test server');
}

async function run() {
  const server = spawn(process.execPath, [path.join(__dirname, 'profile.integration.cjs'), '--serve'], {
    cwd: root,
    stdio: 'ignore',
    env: process.env,
  });
  let browser;
  try {
    await waitForServer(server);
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

    const anonymous = await browser.newPage();
    await anonymous.goto(`${base}/admin-dashboard`);
    await anonymous.waitForURL(`${base}/login`);

    const page = await browser.newPage();
    const runtimeErrors = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.goto(`${base}/login`);
    await page.locator('#login-email').fill('profile_3');
    await page.locator('#login-password').fill('Testpass123');
    await page.locator('#login-role').selectOption('admin');
    await page.locator('#login-btn').click();
    await page.waitForURL(`${base}/admin-dashboard`);

    await page.locator('.admin-su-nav-btn').first().waitFor();
    assert(await page.locator('.admin-su-nav-btn').filter({ hasText: 'Overview' }).isVisible());
    await page.locator('.admin-su-nav-btn').filter({ hasText: 'User Management' }).click();
    await page.waitForURL(`${base}/admin-dashboard?tab=users`);
    await page.locator('#page-users').waitFor();
    assert.equal(await page.locator('#page-users').count(), 1);
    assert.equal(await page.locator('#page-users .admin-users-table').count(), 1);
    assert.equal(await page.getByText('Something went wrong').count(), 0);

    const sessionCookie = (await page.context().cookies(`${base}/api`)).find(cookie => cookie.name === 'se7en_session');
    assert(sessionCookie, 'login should establish an HttpOnly server session cookie');
    await page.reload();
    await page.waitForURL(`${base}/admin-dashboard?tab=users`);
    await page.locator('#page-users').waitFor();
    assert.equal(await page.locator('#page-users .admin-users-table').count(), 1);
    assert.deepEqual(runtimeErrors, [], 'admin dashboard should not throw browser runtime errors');

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL(`${base}/login`);
    const afterLogout = await page.context().request.get(`${base}/api/users/me`);
    assert.equal(afterLogout.status(), 401, 'logout should revoke the server session');

    const userPage = await browser.newPage();
    userPage.on('response', response => {
      if (response.status() >= 400 && !response.url().endsWith('/api/users/me')) {
        console.log(`User dashboard request returned ${response.status()}: ${response.url()}`);
      }
    });
    await userPage.goto(`${base}/login`);
    await userPage.locator('#login-email').fill('profile_8');
    await userPage.locator('#login-password').fill('Testpass123');
    await userPage.locator('#login-role').selectOption('user');
    await userPage.locator('#login-btn').click();
    await userPage.waitForURL(`${base}/dashboard`, { timeout: 8000 });
    await userPage.getByText('Profile tests', { exact: true }).waitFor({ timeout: 8000 });
    await userPage.getByText('Loading communities…').waitFor({ state: 'detached', timeout: 8000 });
    assert(await userPage.getByText('Profile tests', { exact: true }).count() > 0, "dashboard should render the user's joined community");
    assert.equal(await userPage.getByRole('alert').count(), 0, 'community request should not leave an error state');
    console.log('Browser E2E passed: protected admin session and regular-user community loading/rendering.');
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
