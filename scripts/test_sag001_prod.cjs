// SAG-001 against PRODUCTION (thamaraaa.vercel.app)
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

const BASE = 'https://thamaraaa.vercel.app';
const EMAIL = 'sales10@gmail.com';
const PASS = '123456';

async function login(page) {
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
  await authResp;
  await new Promise(r => setTimeout(r, 3000));
  if (page.url().includes('/login')) throw new Error('Login failed');
}

async function dump(page, label, leadName) {
  const statusEl = await page.evaluate(() => {
    const el = [...document.querySelectorAll('span.font-bold')].find(s => /Active|In Call|Busy/.test(s.textContent));
    return el ? el.textContent.trim() : '(not found)';
  });
  const btns = await page.evaluate((n) => {
    const row = [...document.querySelectorAll('tr')].find(tr => tr.textContent && tr.textContent.includes(n));
    if (!row) return 'row-not-found';
    return [...row.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).join('|');
  }, leadName);
  console.log(`[${label}] status="${statusEl}" buttons="${btns}"`);
  return { status: statusEl, btns };
}

(async () => {
  const prisma = new PrismaClient();
  const lead = await prisma.lead.findFirst({
    where: { name: 'rana', salesAgent: { email: EMAIL } },
    select: { id: true },
  });
  if (!lead) throw new Error('Lead "rana" not found');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));

  try {
    // ── Scenario A: orphan In_Call (status=In_Call, no in-progress lead) ──
    await prisma.user.update({ where: { email: EMAIL }, data: { status: 'In_Call' } });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { meetingStartedAt: null, meetingEndedAt: null },
    });
    console.log('[setup A] user.status=In_Call, lead has no meetingStartedAt');

    await login(page);
    await page.goto(BASE + '/dashboard/sales', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3500)); // wait for self-heal PATCH
    const A = await dump(page, 'after self-heal', 'rana');
    const userA = await prisma.user.findUnique({ where: { email: EMAIL }, select: { status: true } });
    console.log(`[db A] DB.status=${userA.status}`);
    const healOk = userA.status === 'Active' && A.status === 'Active' && /Start Task/.test(A.btns);
    console.log(`[${healOk ? 'PASS' : 'FAIL'}] orphan self-heals on PROD\n`);

    // ── Scenario B: Start Task → refresh → End Task should show ───────────
    // Click Start Task in rana's row
    const clicked = await page.evaluate(() => {
      const row = [...document.querySelectorAll('tr')].find(tr => tr.textContent && tr.textContent.includes('rana'));
      if (!row) return 'row-not-found';
      const btn = [...row.querySelectorAll('button')].find(b => /Start Task/i.test(b.textContent));
      if (!btn) return 'no-start-btn';
      btn.click();
      return 'ok';
    });
    console.log(`[start] click: ${clicked}`);
    await new Promise(r => setTimeout(r, 3000));

    const leadAfter = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { meetingStartedAt: true, meetingEndedAt: true },
    });
    console.log(`[db after start] meetingStartedAt=${leadAfter.meetingStartedAt} meetingEndedAt=${leadAfter.meetingEndedAt}`);

    // Hard reload
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));
    const B = await dump(page, 'after refresh', 'rana');
    const rehydrateOk = /In Call/.test(B.status) && /End Task/.test(B.btns) && !/Start Task/.test(B.btns);
    console.log(`[${rehydrateOk ? 'PASS' : 'FAIL'}] refresh shows End Task on PROD`);

    // Cleanup
    await prisma.lead.update({
      where: { id: lead.id },
      data: { meetingStartedAt: null, meetingEndedAt: null },
    });
    await prisma.user.update({ where: { email: EMAIL }, data: { status: 'Active' } });

    const ok = healOk && rehydrateOk;
    console.log(`\n=== ${ok ? 'PROD SAG-001 PASS' : 'PROD SAG-001 FAIL'} ===`);
    process.exit(ok ? 0 : 1);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
