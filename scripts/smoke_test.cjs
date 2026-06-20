// End-to-end smoke test for the bug fixes.
// Runs against http://localhost:3000 and logs in as super_admin (password: admin123).
const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';
const EMAIL = 'admin@thamaraa.com';
const PASS = 'admin123';

const results = [];
function step(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function waitForUrl(page, fragment, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (page.url().includes(fragment)) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('  pageerror:', err.message));
  page.on('requestfailed', (req) => {
    const f = req.failure();
    if (f && f.errorText !== 'net::ERR_ABORTED') console.log('  reqfailed:', req.url(), f.errorText);
  });

  try {
    // ── LOGIN ──────────────────────────────────────────────────────────────
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 60000 });
    // Login page uses unnamed inputs (text + password); pick by order.
    const loginInputs = await page.$$('input');
    await loginInputs[0].type(EMAIL);
    await loginInputs[1].type(PASS);
    await Promise.all([
      page.click('button[type=submit]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
    ]);
    const loggedIn = !page.url().includes('/login');
    step('Login as super_admin', loggedIn, page.url());

    if (!loggedIn) throw new Error('Login failed — aborting');

    // ── ADM-001: Users page — create + duplicate detection + delete ───────
    await page.goto(BASE + '/dashboard/users', { waitUntil: 'networkidle2' });
    const usersPageOk = page.url().includes('/dashboard/users');
    step('Users page loads', usersPageOk);

    // Try creating a user with a duplicate email to confirm we get a SPECIFIC error.
    const stamp = Date.now();
    const testEmail = `smoke_${stamp}@example.com`;

    // open create modal
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /Create New User/i.test(b.textContent));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    await page.type('input[type=text]', 'Smoke User');                       // first text input = name
    await page.type('input[type=password]', 'Sm0kePass!');
    await page.type('input[type=email]', testEmail);
    // Submit
    const createOk = await page.evaluate(async () => {
      const submit = [...document.querySelectorAll('button')].find(b => /Save User/i.test(b.textContent));
      if (!submit) return false;
      submit.click();
      return true;
    });
    step('Create-user submit clicked', createOk);
    await new Promise(r => setTimeout(r, 2500));

    // Verify the row landed in the table
    const rowExists = await page.evaluate((email) => {
      return [...document.querySelectorAll('td')].some(td => td.textContent && td.textContent.includes(email));
    }, testEmail);
    step('New user appears in list', rowExists, testEmail);

    // Try creating the SAME email again to verify our specific-error message fires.
    let alertText = '';
    page.once('dialog', async (d) => { alertText = d.message(); await d.dismiss(); });
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /Create New User/i.test(b.textContent));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    // Fill again (the modal state is fresh)
    const inputs = await page.$$('input');
    if (inputs.length >= 4) {
      await inputs[0].type('Smoke Dup');
      await inputs[1].type('Sm0kePass!');
      await inputs[2].type(testEmail);
    }
    await page.evaluate(() => {
      const submit = [...document.querySelectorAll('button')].find(b => /Save User/i.test(b.textContent));
      if (submit) submit.click();
    });
    await new Promise(r => setTimeout(r, 2500));
    step(
      'Duplicate email returns specific error',
      /already exists/i.test(alertText),
      `alert="${alertText}"`
    );

    // Close any open modal
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    // Delete the user we just created (no business history → should hard-delete).
    const deletedNetwork = [];
    page.on('response', (r) => {
      if (/\/api\/users\/.+/.test(r.url()) && r.request().method() === 'DELETE') {
        deletedNetwork.push(r.status());
      }
    });
    // Find the row, click its trash icon
    const trashClicked = await page.evaluate((email) => {
      const row = [...document.querySelectorAll('tr')].find(tr => tr.textContent && tr.textContent.includes(email));
      if (!row) return false;
      const btn = row.querySelector('button[title="Delete User"]');
      if (!btn) return false;
      btn.click();
      return true;
    }, testEmail);
    step('Delete trash icon clicked', trashClicked);
    await new Promise(r => setTimeout(r, 400));
    // Confirm in the modal
    await page.evaluate(() => {
      const yes = [...document.querySelectorAll('button')].find(b => /Yes, Delete/i.test(b.textContent));
      if (yes) yes.click();
    });
    await new Promise(r => setTimeout(r, 2500));
    const deleteOk = deletedNetwork.includes(200);
    step('DELETE /api/users/:id returned 200', deleteOk, JSON.stringify(deletedNetwork));

    // ── Profile page loads (TLS-002/TLM-003/SAG-002 path) ──────────────────
    await page.goto(BASE + '/dashboard/profile', { waitUntil: 'networkidle2' });
    const profileOk = !/Application error/.test(await page.content());
    step('Profile page loads without runtime error', profileOk);

    // ── Telesales workspace (TLS-001 path) ────────────────────────────────
    await page.goto(BASE + '/dashboard/telesales', { waitUntil: 'networkidle2' });
    const teleOk = page.url().includes('/dashboard/telesales') &&
      !/Application error/.test(await page.content());
    step('Telesales workspace loads', teleOk);

    // ── Telesales Manager > My Team (TLM-002 path) — admin can view ───────
    await page.goto(BASE + '/dashboard/telesales/my-team', { waitUntil: 'networkidle2' });
    const myTeamOk = !/Application error/.test(await page.content());
    step('Telesales My Team loads', myTeamOk);

    // ── Cold Leads page (TLM-001 date-filter path) ────────────────────────
    await page.goto(BASE + '/dashboard/telesales/cold-leads', { waitUntil: 'networkidle2' });
    const coldOk = !/Application error/.test(await page.content());
    step('Cold Leads page loads', coldOk);

    // ── Sales workspace (SLS-001, SAG-001 path) ───────────────────────────
    await page.goto(BASE + '/dashboard/sales', { waitUntil: 'networkidle2' });
    const salesOk = !/Application error/.test(await page.content());
    step('Sales workspace loads', salesOk);

    // ── Sales > My Progress (SLS-002 path) ────────────────────────────────
    await page.goto(BASE + '/dashboard/sales/my-progress', { waitUntil: 'networkidle2' });
    const myProgressOk = !/Application error/.test(await page.content());
    step('Sales My Progress loads', myProgressOk);

  } catch (err) {
    step('Unhandled exception', false, err.message);
  } finally {
    await browser.close();
    const pass = results.filter(r => r.ok).length;
    const fail = results.filter(r => !r.ok).length;
    console.log(`\n=== ${pass} passed, ${fail} failed ===`);
    process.exit(fail === 0 ? 0 : 1);
  }
})();
