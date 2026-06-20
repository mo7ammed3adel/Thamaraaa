const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

const BASE = 'https://thamaraaa.vercel.app';
const EMAIL = 'tstl1@th.com';
const PASS = '123456';

(async () => {
  const prisma = new PrismaClient();
  const mgr = await prisma.user.findUnique({ where: { email: EMAIL } });

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    const inputs = await page.$$('input');
    await inputs[0].type(EMAIL); await inputs[1].type(PASS);
    const authResp = page.waitForResponse(r => r.url().includes('/api/auth/callback/credentials'), { timeout: 30000 });
    await page.click('button[type=submit]');
    await authResp;
    await new Promise(r => setTimeout(r, 3000));
    if (page.url().includes('/login')) throw new Error('Login failed on PROD');
    console.log('[login] OK');

    // #1 Cold Leads
    await page.goto(BASE + '/dashboard/telesales/cold-leads', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const coldUrl = page.url();
    const coldHasForm = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some(b => /Add Cold Lead/i.test(b.textContent))
    );
    console.log(`[#1 cold-leads PROD] url=${coldUrl}  hasAddBtn=${coldHasForm}  → ${coldUrl.includes('/cold-leads') && coldHasForm ? 'PASS' : 'FAIL'}`);

    // #2 Team Analytics
    const teamApi = await page.evaluate(async () => {
      const r = await fetch('/api/analytics/team', { credentials: 'include' });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    });
    const agentCount = Array.isArray(teamApi.body) ? teamApi.body.length : 0;
    console.log(`[#2 team api PROD] status=${teamApi.status}  agents=${agentCount}  → ${teamApi.status === 200 && agentCount > 0 ? 'PASS' : 'FAIL'}`);

    // #3 Profile telesales stats
    await page.goto(BASE + '/dashboard/profile', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const panel = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h3')].find(x => /Telesales Performance|Sales Performance/i.test(x.textContent));
      if (!h) return null;
      return h.closest('div').innerText.replace(/\s+/g, ' ').slice(0, 200);
    });
    console.log(`[#3 profile PROD] panel="${panel}"  → ${panel && !/0 Deals/.test(panel) ? 'PASS' : 'FAIL'}`);

    const tlIds = (await prisma.user.findMany({
      where: { role: 'tele_sales_agent', OR: [{ directManagerId: mgr.id }, { directManagerId: null }] },
      select: { id: true },
    })).map(u => u.id);
    const expected = await prisma.deal.aggregate({
      where: { lead: { assignedTeleAgentId: { in: [mgr.id, ...tlIds] } } },
      _count: { _all: true }, _sum: { totalAmount: true },
    });
    console.log(`[#3 expected] dealCount=${expected._count._all} revenue=${expected._sum.totalAmount}`);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
})();
