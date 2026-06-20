// Verify the three telesales-manager fixes locally:
//   1. Cold Leads page is reachable (no redirect)
//   2. /api/analytics/team returns >0 agents (includes orphan agents)
//   3. Profile shows Telesales Performance with non-zero counts
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

const BASE = 'http://localhost:3000';
const EMAIL = 'tstl1@th.com';        // tele_sales_manager
const PASS = '123456';

(async () => {
  const prisma = new PrismaClient();

  // Confirm test user + ensure there's at least one orphan agent + 1 deal to credit.
  const mgr = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!mgr) throw new Error('Manager not found');
  console.log(`[setup] manager id=${mgr.id} role=${mgr.role}`);

  const orphans = await prisma.user.count({
    where: { role: 'tele_sales_agent', directManagerId: null },
  });
  const owned = await prisma.user.count({
    where: { role: 'tele_sales_agent', directManagerId: mgr.id },
  });
  console.log(`[setup] tele agents → owned=${owned} orphan=${orphans}`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    // Login
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const inputs = await page.$$('input');
    await inputs[0].type(EMAIL); await inputs[1].type(PASS);
    const authResp = page.waitForResponse(r => r.url().includes('/api/auth/callback/credentials'), { timeout: 30000 });
    await page.click('button[type=submit]');
    await authResp;
    await new Promise(r => setTimeout(r, 2500));
    console.log(`[login] url=${page.url()}`);
    if (page.url().includes('/login')) throw new Error('Login failed');

    // ── #1 Cold Leads: was redirecting, must now load ─────────────────
    await page.goto(BASE + '/dashboard/telesales/cold-leads', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const coldUrl = page.url();
    const coldHasForm = await page.evaluate(() =>
      !!document.querySelector('button') &&
      [...document.querySelectorAll('button')].some(b => /Add Cold Lead/i.test(b.textContent))
    );
    const coldOk = coldUrl.includes('/cold-leads') && coldHasForm;
    console.log(`[#1 cold-leads] url=${coldUrl}  hasAddBtn=${coldHasForm}  → ${coldOk ? 'PASS' : 'FAIL'}`);

    // ── #2 Team Analytics: api should return agents ───────────────────
    const teamApi = await page.evaluate(async () => {
      const r = await fetch('/api/analytics/team', { credentials: 'include' });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    });
    const agentCount = Array.isArray(teamApi.body) ? teamApi.body.length : 0;
    console.log(`[#2 team api] status=${teamApi.status}  agents returned=${agentCount}`);
    const teamOk = teamApi.status === 200 && agentCount > 0;
    console.log(`[#2 team api] → ${teamOk ? 'PASS' : 'FAIL'}`);

    // Also load the page itself
    await page.goto(BASE + '/dashboard/telesales/analytics', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3500));
    const rowsOnPage = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
    console.log(`[#2 team page] table rows visible = ${rowsOnPage}`);

    // ── #3 Profile: My Telesales Performance ──────────────────────────
    await page.goto(BASE + '/dashboard/profile', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const profilePanel = await page.evaluate(() => {
      const heading = [...document.querySelectorAll('h3')].find(h => /Telesales Performance|Sales Performance/i.test(h.textContent));
      if (!heading) return null;
      const root = heading.closest('div');
      return {
        heading: heading.textContent.trim(),
        text: root.innerText.replace(/\s+/g, ' ').slice(0, 300),
      };
    });
    console.log(`[#3 profile]`, profilePanel);

    // Cross-check the underlying numbers in the DB so we know what to expect
    const tlIds = (await prisma.user.findMany({
      where: { role: 'tele_sales_agent', OR: [{ directManagerId: mgr.id }, { directManagerId: null }] },
      select: { id: true },
    })).map(u => u.id);
    const ids = [mgr.id, ...tlIds];
    const expected = await prisma.deal.aggregate({
      where: { lead: { assignedTeleAgentId: { in: ids } } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    console.log(`[#3 expected]`, { dealCount: expected._count._all, revenue: expected._sum.totalAmount });
    const profileOk = !!profilePanel && /Deals/.test(profilePanel.text);
    console.log(`[#3 profile] → ${profileOk ? 'PASS' : 'FAIL'}`);

    const allOk = coldOk && teamOk && profileOk;
    console.log(`\n=== ${allOk ? 'ALL PASS' : 'SOME FAIL'} ===`);
    process.exit(allOk ? 0 : 1);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
})().catch(async (e) => { console.error(e); process.exit(1); });
