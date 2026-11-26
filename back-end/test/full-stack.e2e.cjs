// Real HTTP + Chromium regression audit. Owns an isolated JSON database through the existing harness.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:3100';
const root = path.resolve(__dirname, '..');
const routes = ['landing', 'login', 'pricing', 'dashboard', 'chat?communityId=9000', 'discovery', 'events', 'event-approval', 'event-registrants', 'create-community', 'community-page?id=9000', 'community-settings?id=9000', 'report', 'appeal', 'mod-panel', 'admin-dashboard', 'owner-dashboard', 'organizer-dashboard', 'profile-settings', 'user'];
async function run() {
  const server = spawn(process.execPath, ['test/profile.integration.cjs', '--serve'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  let browser;
  let checks = 0;
  try {
    for (let i = 0; !logs.includes('UI test server:'); i++) {
      if (server.exitCode !== null || i > 100) throw Error(logs || 'Server did not start');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const databasePath = path.join(logs.match(/UI test database: (.+)/)[1], 'db.json');
    const persisted = () => JSON.parse(fs.readFileSync(databasePath, 'utf8')).db;
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    async function login(role, id) {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await page.goto(`${base}/login`);
      await page.waitForLoadState('networkidle');
      assert.equal(await page.getByText(/Missing or invalid session/).count(), 0);
      await page.locator('#login-email').fill(`profile_${id}`);
      await page.locator('#login-password').fill('Testpass123');
      await page.locator('#login-role').selectOption(role);
      await page.locator('#login-btn').click();
      await page.waitForURL(u => !u.pathname.includes('login'));
      return page;
    }
    async function api(page, endpoint, method = 'GET', body, status = 200) {
      const response = await page.context().request.fetch(`${base}/api${endpoint}`, { method, data: body });
      const data = await response.json();
      assert.equal(response.status(), status, `${method} ${endpoint}: ${JSON.stringify(data)}`);
      checks++;
      return data;
    }
    // Delay a real anonymous restoration response until after a successful login.
    const raceContext = await browser.newContext();
    let releaseRestore;
    let restoreCaptured;
    const captured = new Promise(resolve => { restoreCaptured = resolve; });
    await raceContext.route('**/api/users/me', async route => {
      const response = await route.fetch();
      if (!releaseRestore) {
        await new Promise(resolve => { releaseRestore = resolve; restoreCaptured(); });
      }
      await route.fulfill({ response });
    });
    const racePage = await raceContext.newPage();
    await racePage.goto(`${base}/login`);
    await captured;
    await racePage.locator('#login-email').fill('profile_8');
    await racePage.locator('#login-password').fill('Testpass123');
    await racePage.locator('#login-role').selectOption('user');
    await racePage.locator('#login-btn').click();
    await racePage.waitForURL(`${base}/dashboard`);
    releaseRestore();
    await racePage.waitForLoadState('networkidle');
    assert.equal(new URL(racePage.url()).pathname, '/dashboard', 'late anonymous restore must not undo login');
    await raceContext.close();
    const admin = await login('admin', 3);
    const user = await login('user', 8);
    const organizer = await login('organizer', 5);
    // Exercise the actual tournament form, including backend whitelist validation.
    await organizer.goto(`${base}/organizer-dashboard`);
    await organizer.getByRole('button', { name: /Host.*Tournament/i }).click();
    const modal = organizer.locator('.modal-container');
    await modal.locator('input').nth(0).fill('Audit tournament');
    await modal.locator('input').nth(1).fill('Tournament created through the real browser form.');
    await modal.locator('select').first().selectOption('9000');
    await modal.locator('input[type=date]').fill('2027-12-20');
    await modal.getByRole('button', { name: 'Create Tournament' }).click();
    await modal.waitFor({ state: 'detached' });
    let event = (await api(admin, '/events')).find(e => e.title === 'Audit tournament');
    assert(event, 'create form persisted an event');
    await organizer.locator('tr').filter({ hasText: 'Audit tournament' }).getByRole('button', { name: 'Edit', exact: true }).click();
    await modal.locator('input').nth(1).fill('Tournament updated through its real edit form.');
    await modal.getByRole('button', { name: 'Save Changes' }).click();
    await modal.waitFor({ state: 'detached' });
    assert.equal((await api(admin, `/events/${event.id}`)).description, 'Tournament updated through its real edit form.');
    await admin.goto(`${base}/event-approval`);
    const pendingCard = admin.locator('.approval-card').filter({ hasText: 'Audit tournament' });
    await pendingCard.getByRole('button', { name: 'View Details' }).click();
    await admin.getByRole('button', { name: 'Close', exact: true }).click();
    await pendingCard.getByRole('button', { name: 'Approve', exact: true }).click();
    await pendingCard.waitFor({ state: 'detached' });
    assert.equal((await api(admin, `/events/${event.id}`)).status, 'approved');
    await user.goto(`${base}/events`);
    await user.getByText(/Loading events[….]/).waitFor({ state: 'detached' });
    await user.getByText('Audit tournament', { exact: true }).first().waitFor();
    await user.locator('.ev-card').filter({ hasText: 'Audit tournament' }).getByRole('button', { name: 'Register', exact: true }).click();
    await user.locator('#regFullName').fill('Audit Player');
    await user.locator('#regEmail').fill('audit@test.invalid');
    await user.locator('#regInGameId').fill('audit-player');
    await user.getByRole('button', { name: 'Confirm Registration' }).click();
    await user.locator('#registerModal').waitFor({ state: 'detached' });
    let registrations = await api(user, '/event-registrations');
    const registration = registrations.find(r => r.eventId === event.id);
    assert(registration, `registration persisted: event=${event.id}, registrations=${JSON.stringify(registrations)}`);
    assert(persisted().eventRegistrations.some(r => r.id === registration.id), 'registration saved on disk');
    await api(organizer, `/event-registrations/${registration.id}`, 'DELETE', undefined, 403);
    await api(user, '/event-registrations?userId=9003', 'GET', undefined, 403);
    await user.reload();
    await user.getByText('Audit tournament', { exact: true }).first().waitFor();
    user.once('dialog', dialog => dialog.accept());
    const cancellation = user.waitForResponse(r => r.request().method() === 'DELETE' && r.url().includes('/event-registrations/'));
    await user.locator('.ev-card').filter({ hasText: 'Audit tournament' }).getByRole('button', { name: 'Leave Event' }).click();
    await cancellation;
    registrations = await api(user, '/event-registrations');
    assert(!registrations.some(r => r.id === registration.id));
    const foreign = await api(admin, '/events', 'POST', {
      title: 'Admin owned tournament', description: 'Ownership is derived from the authenticated session.',
      communityId: 9000, date: '2027-12-21', status: 'pending', organiserId: 9005,
    }, 201);
    assert.equal(foreign.organiserId, 9003);
    await api(organizer, `/events/${foreign.id}`, 'PATCH', { title: 'Unauthorized edit' }, 403);
    await api(organizer, `/events/${foreign.id}/registrants`, 'GET', undefined, 403);
    await api(user, '/event-registrations', 'POST', { eventId: foreign.id }, 400);
    await api(admin, `/events/${foreign.id}`, 'DELETE');
    // A forged body identity cannot register someone else.
    const own = await api(user, '/event-registrations', 'POST', { eventId: event.id, userId: 9003 }, 201);
    assert.equal(own.userId, 9008);
    await api(admin, `/events/${event.id}`, 'DELETE');
    assert(!(await api(user, '/event-registrations')).some(r => r.eventId === event.id));
    await api(admin, `/events/${event.id}`, 'GET', undefined, 404);
    // Real network failure, followed by retry against the real backend.
    await user.context().route('**/api/events', route => route.abort('connectionfailed'));
    await user.goto(`${base}/events`);
    await user.getByRole('button', { name: 'Retry events' }).waitFor();
    assert.equal(await user.getByText(/Loading events[….]/).count(), 0);
    await user.context().unroute('**/api/events');
    await user.getByRole('button', { name: 'Retry events' }).click();
    await user.getByRole('button', { name: 'Retry events' }).waitFor({ state: 'detached' });
    // Community creation wizard persists through the actual UI and real API.
    await user.goto(`${base}/create-community`);
    await user.getByPlaceholder('e.g. Pro Gamers, Indie Games…').fill('Audit community');
    await user.getByPlaceholder('What will people talk about here? What makes this community unique?').fill('Community created by the full-stack browser regression audit.');
    for (let step = 0; step < 3; step++) await user.getByRole('button', { name: 'Continue →' }).click();
    await user.getByRole('button', { name: 'Create Community', exact: true }).click();
    await user.waitForURL(u => u.pathname.includes('community-page'));
    const createdCommunity = (await api(user, '/communities')).find(c => c.name === 'Audit community');
    assert(createdCommunity, 'community wizard persisted');
    assert(persisted().communities.some(c => c.id === createdCommunity.id), 'community saved on disk');
    await api(user, `/communities/${createdCommunity.id}`, 'PATCH', { description: 'Updated persisted community description.' });
    await api(user, `/communities/${createdCommunity.id}`, 'DELETE');
    await api(user, `/communities/${createdCommunity.id}`, 'GET', undefined, 404);
    await user.goto(`${base}/chat?communityId=9000`);
    await user.getByTitle('Quick Action', { exact: true }).click();
    await user.getByRole('button', { name: 'Search messages', exact: true }).click();
    await user.locator('#chatSearchInput').waitFor();
    await user.getByLabel('Chat attachment').setInputFiles({ name: 'audit.txt', mimeType: 'text/plain', buffer: Buffer.from('Browser audit attachment') });
    await user.getByRole('button', { name: 'Remove audit.txt' }).waitFor();
    await user.locator('#msgInput').fill('Persisted browser audit chat message');
    await user.locator('#msgInput').press('Enter');
    await user.locator('.msg-text').filter({ hasText: 'Persisted browser audit chat message' }).waitFor();
    const sent = (await api(user, '/messages?communityId=9000')).find(m => m.content === 'Persisted browser audit chat message');
    assert(sent, 'chat send persisted');
    assert.equal(sent.attachments.length, 1);
    assert(persisted().messages.some(m => m.id === sent.id && m.attachments.includes(sent.attachments[0])), 'message and attachment saved on disk');
    assert.equal((await user.context().request.get(base + sent.attachments[0])).status(), 200);
    await user.reload();
    await user.locator('.msg-text').filter({ hasText: 'Persisted browser audit chat message' }).waitFor();
    await api(user, `/messages/${sent.id}`, 'DELETE');
    // Exercise all admin tabs, including their individual API integrations.
    await admin.goto(`${base}/admin-dashboard`);
    const adminTabs = admin.locator('.admin-su-nav-btn');
    for (let i = 0; i < await adminTabs.count(); i++) {
      await adminTabs.nth(i).click();
      await admin.waitForLoadState('networkidle');
      assert.equal(await admin.getByText('Something went wrong', { exact: true }).count(), 0);
    }
    // All twenty project pages under each supported role; collect actual browser/network failures.
    for (const [role, id] of [['admin',3], ['user',8], ['moderator',2], ['community_manager',6], ['organizer',5], ['owner',4]]) {
      const page = await login(role, id);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 500 && r.url().includes('/api/')) errors.push(`${r.status()} ${r.url()}`); });
      for (const route of routes) {
        await page.goto(`${base}/${route}`);
        await page.waitForLoadState('networkidle');
        assert.equal(await page.getByText('Something went wrong', { exact: true }).count(), 0, `${role}: ${route}`);
        assert.equal(await page.getByText(/Loading events[….]/).count(), 0, `${role}: ${route}`);
        assert.deepEqual(errors, [], `${role}: ${route}`);
        checks++;
      }
      console.log(`Verified 20 routes for ${role}`);
      await page.context().close();
    }
    // Profile logout must revoke the cookie, not just clear Redux.
    await user.goto(`${base}/profile-settings`);
    await user.context().route('**/api/auth/logout', route => route.abort('connectionfailed'));
    await user.getByRole('button', { name: /Log out/i }).first().click();
    await user.getByText(/Unable to connect to Se7enSquare server/).waitFor();
    assert.equal(new URL(user.url()).pathname, '/profile-settings', 'failed logout remains retryable');
    await user.context().unroute('**/api/auth/logout');
    await user.getByRole('button', { name: /Log out/i }).first().click();
    await user.waitForURL(`${base}/login`);
    await api(user, '/users/me', 'GET', undefined, 401);
    await user.goto(`${base}/events`);
    await user.waitForURL(`${base}/login`);
    // Expired cookie while mounted: next request expires Redux and protects the route.
    await admin.goto(`${base}/events`);
    await api(admin, '/auth/logout', 'POST');
    await admin.reload();
    await admin.waitForURL(`${base}/login`);
    console.log(`Full-stack audit passed: ${checks} checks, 20 routes × 6 roles, browser tournament creation/registration/cancellation, backend persistence/authorization, network retry and logout.`);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    if (server.exitCode === null) await once(server, 'exit');
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
