// SAG-001 end-to-end test:
//  1. Self-heal orphan In_Call state (lead has both timestamps, user stuck In_Call).
//  2. Click Start Task, navigate away, return → End Task button must appear.
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

const BASE = 'http://localhost:3000';
const EMAIL = 'sales10@gmail.com';
const PASS = '123456';

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('button[type=submit]', { timeout: 15000 });
  // Wait for React hydration: poll until the email input updates state on input
  await new Promise(r => setTimeout(r, 2000));
  const inputs = await page.$$('input');
  await inputs[0].click({ clickCount: 3 }); await inputs[0].type(EMAIL);
  await inputs[1].click({ clickCount: 3 }); await inputs[1].type(PASS);
  // Submit and wait for the auth POST
  const authResp = page.waitForResponse(
    (r) => r.url().includes('/api/auth/callback/credentials'),
    { timeout: 30000 }
  );
  await page.click('button[type=submit]');
  const r = await authResp;
  // After auth success, NextAuth returns 200 (redirect:false from client) — then router.push fires
  await new Promise(res => setTimeout(res, 2500));
  if (page.url().includes('/login')) throw new Error('Login failed (auth status ' + r.status() + ')');
}

async function buttonForLead(page, leadName) {
  return await page.evaluate((name) => {
    const row = [...document.querySelectorAll('tr')].find(tr => tr.textContent && tr.textContent.includes(name));
    if (!row) return 'row-not-found';
    const btns = [...row.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean);
    return btns.join('|');
  }, leadName);
}

async function statusText(page) {
  return await page.evaluate(() => {
    const el = [...document.querySelectorAll('span.font-bold')].find(s => /Active|In Call|Busy/.test(s.textContent));
    return el ? el.textContent.trim() : '(not found)';
  });
}

(async () => {
  const prisma = new PrismaClient();

  // Pre-condition: stage the orphan state (we already have it in DB but make it deterministic)
  await prisma.user.update({
    where: { email: EMAIL },
    data: { status: 'In_Call' },
  });
  // lead `rana` already has both timestamps. Confirm.
  const lead = await prisma.lead.findFirst({
    where: { name: 'rana', salesAgent: { email: EMAIL } },
    select: { id: true, meetingStartedAt: true, meetingEndedAt: true },
  });
  console.log(`[setup] user.status=In_Call, lead 'rana' has timestamps: started=${!!lead.meetingStartedAt} ended=${!!lead.meetingEndedAt}`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));

  try {
    // ── Test 1: self-heal orphan In_Call ──────────────────────────────────
    await login(page);
    await page.goto(BASE + '/dashboard/sales', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000)); // let the heal-PATCH fire

    const statusAfter = await statusText(page);
    const btns1 = await buttonForLead(page, 'rana');
    const userAfter = await prisma.user.findUnique({ where: { email: EMAIL }, select: { status: true } });

    console.log(`[heal] status badge="${statusAfter}", row buttons="${btns1}", DB.status=${userAfter.status}`);
    const healOk = userAfter.status === 'Active' && /Start Task/.test(btns1);
    console.log(`[${healOk ? 'PASS' : 'FAIL'}] orphan In_Call self-heals to Active and Start Task is available`);

    // ── Test 2: Start Task → reload → End Task should show ───────────────
    // Clean the lead timestamps first to simulate fresh state
    await prisma.lead.update({
      where: { id: lead.id },
      data: { meetingStartedAt: null, meetingEndedAt: null },
    });

    await page.goto(BASE + '/dashboard/sales', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    // Click Start Task in rana's row
    const clicked = await page.evaluate(() => {
      const row = [...document.querySelectorAll('tr')].find(tr => tr.textContent && tr.textContent.includes('rana'));
      if (!row) return 'row-not-found';
      const btn = [...row.querySelectorAll('button')].find(b => /Start Task/i.test(b.textContent));
      if (!btn) return 'btn-not-found';
      btn.click();
      return 'ok';
    });
    console.log(`[start] click result: ${clicked}`);
    await new Promise(r => setTimeout(r, 2000)); // let PATCH /api/leads/:id complete

    // Verify lead now has meetingStartedAt
    const leadAfterStart = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { meetingStartedAt: true, meetingEndedAt: true },
    });
    console.log(`[start] lead state: started=${leadAfterStart.meetingStartedAt} ended=${leadAfterStart.meetingEndedAt}`);

    // Now reload (simulate refresh)
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const statusReload = await statusText(page);
    const btnsReload = await buttonForLead(page, 'rana');
    console.log(`[reload] status badge="${statusReload}", row buttons="${btnsReload}"`);
    const rehydrateOk = /End Task/.test(btnsReload) && !/Start Task/.test(btnsReload);
    console.log(`[${rehydrateOk ? 'PASS' : 'FAIL'}] after refresh, End Task button appears (Start Task is gone)`);

    // Cleanup: end the call so we don't leave the test user In_Call
    await prisma.lead.update({
      where: { id: lead.id },
      data: { meetingStartedAt: null, meetingEndedAt: null },
    });
    await prisma.user.update({
      where: { email: EMAIL },
      data: { status: 'Active' },
    });

    const allOk = healOk && rehydrateOk;
    console.log(`\n=== ${allOk ? 'SAG-001 PASS' : 'SAG-001 FAIL'} ===`);
    process.exit(allOk ? 0 : 1);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
