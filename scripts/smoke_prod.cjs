// Production smoke test: verifies the deployed Vercel build serves the
// commit-bec7064 behavior (specific error string for duplicate-email).
const puppeteer = require('puppeteer');

const BASE = 'https://thamaraaa.vercel.app';
const EMAIL = 'admin@thamaraa.com';
const PASS = 'admin123';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));

  try {
    // ── Login ──────────────────────────────────────────────────────────
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('button[type=submit]', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    const inputs = await page.$$('input');
    await inputs[0].click({ clickCount: 3 }); await inputs[0].type(EMAIL);
    await inputs[1].click({ clickCount: 3 }); await inputs[1].type(PASS);
    const authResp = page.waitForResponse(
      (r) => r.url().includes('/api/auth/callback/credentials'),
      { timeout: 30000 }
    );
    await page.click('button[type=submit]');
    const r = await authResp;
    await new Promise(res => setTimeout(res, 3000));
    if (page.url().includes('/login')) {
      console.log(`[FAIL] Login (auth ${r.status()})`);
      process.exit(1);
    }
    console.log('[PASS] Login as super_admin against PROD');

    // ── Capture commit-bec7064 fingerprint via /api/users ───────────────
    // Old code returned bare "Unauthorized" for the role check. New code
    // returns "Unauthorized — only Super Admin or HR Manager can create users"
    // when called by a non-admin/HR user. Admin can call it, so instead we
    // hit the duplicate-email path which now returns "A user with this email
    // already exists" (was "User already exists with this email or phone").
    const csrf = await page.evaluate(async () => {
      const r = await fetch('/api/auth/csrf', { credentials: 'include' });
      return r.json();
    });

    const dupRes = await page.evaluate(async (email) => {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: 'dup probe',
          email,             // same as admin → must hit conflict
          password: 'whatever',
          role: 'sales_agent',
        }),
      });
      const body = await r.json().catch(() => ({}));
      return { status: r.status, body };
    }, EMAIL);

    console.log('[probe] POST /api/users (dup admin email):', JSON.stringify(dupRes));
    const newMsgLive = /A user with this email already exists/i.test(dupRes.body?.error || '');
    const oldMsgLive = /User already exists with this email or phone/i.test(dupRes.body?.error || '');
    if (newMsgLive) {
      console.log('[PASS] PROD is serving the NEW error message — commit bec7064 is live');
    } else if (oldMsgLive) {
      console.log('[FAIL] PROD is still serving the OLD error message — deploy not yet propagated');
    } else {
      console.log('[??] Unexpected error string:', dupRes.body?.error);
    }

    // ── Smoke the role pages ─────────────────────────────────────────
    const pages = [
      '/dashboard/profile',
      '/dashboard/telesales',
      '/dashboard/telesales/my-team',
      '/dashboard/telesales/cold-leads',
      '/dashboard/sales',
      '/dashboard/sales/my-progress',
      '/dashboard/users',
    ];
    for (const p of pages) {
      await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 30000 });
      const err = /Application error|This page could not be found|Internal Server Error/.test(await page.content());
      console.log(`[${err ? 'FAIL' : 'PASS'}] ${p}`);
    }

    process.exit(newMsgLive ? 0 : 1);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
