// Verifies ADM-001 soft-delete path: a user with business history (a Deal) should
// be deactivated (status=Inactive, email renamed) rather than throwing an FK error.
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

const BASE = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@thamaraa.com';
const ADMIN_PASS = 'admin123';

(async () => {
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const email = `softdelete_${stamp}@example.com`;

  // 1. Create the doomed user + a Deal that references them (forces soft-delete path)
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('x', 10);
  const u = await prisma.user.create({
    data: {
      name: 'Soft Delete Target',
      email,
      role: 'sales_agent',
      level: 'Junior',
      status: 'Active',
      passwordHash: hash,
    },
  });
  const lead = await prisma.lead.create({
    data: { name: 'SD Lead', phone: `+9${stamp}`, classification: 'Hot' },
  });
  const deal = await prisma.deal.create({
    data: {
      leadId: lead.id,
      salesAgentId: u.id,
      package: 'SEO',
      totalAmount: 1000,
      paymentMethod: 'Cash',
      netTarget: 1000,
    },
  });
  console.log(`[setup] created user ${u.id} + deal ${deal.id}`);

  // 2. Drive the UI: log in as admin, click delete on this user, confirm
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' });
  const inputs = await page.$$('input');
  await inputs[0].type(ADMIN_EMAIL);
  await inputs[1].type(ADMIN_PASS);
  await Promise.all([
    page.click('button[type=submit]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
  ]);

  await page.goto(BASE + '/dashboard/users', { waitUntil: 'networkidle2' });

  // Capture the DELETE response so we can confirm a 200
  let deleteStatus = null;
  let deleteBody = null;
  page.on('response', async (r) => {
    if (/\/api\/users\/.+/.test(r.url()) && r.request().method() === 'DELETE') {
      deleteStatus = r.status();
      try { deleteBody = await r.json(); } catch {}
    }
  });

  const clicked = await page.evaluate((target) => {
    const row = [...document.querySelectorAll('tr')].find(tr => tr.textContent && tr.textContent.includes(target));
    if (!row) return 'row-not-found';
    const btn = row.querySelector('button[title="Delete User"]');
    if (!btn) return 'btn-not-found';
    btn.click();
    return 'ok';
  }, email);
  console.log(`[ui] trash icon click: ${clicked}`);

  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const yes = [...document.querySelectorAll('button')].find(b => /Yes, Delete/i.test(b.textContent));
    if (yes) yes.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();

  console.log(`[api] DELETE status=${deleteStatus} body=${JSON.stringify(deleteBody)}`);

  // 3. Verify state in DB
  const after = await prisma.user.findUnique({ where: { id: u.id } });
  const dealAfter = await prisma.deal.findUnique({ where: { id: deal.id } });

  const passed =
    deleteStatus === 200 &&
    after !== null &&                            // soft-deleted, not removed
    after.status === 'Inactive' &&
    !after.email.includes(email) === false ? false : true; // email should still contain the original

  console.log(`[db] user after: status=${after?.status} email=${after?.email}`);
  console.log(`[db] deal preserved: ${dealAfter ? 'yes' : 'NO (regression!)'}`);

  const ok =
    deleteStatus === 200 &&
    after !== null &&
    after.status === 'Inactive' &&
    after.email.startsWith('deleted_') &&
    dealAfter !== null;

  console.log(`\n=== ${ok ? 'SOFT-DELETE PASS' : 'SOFT-DELETE FAIL'} ===`);

  // Cleanup so we don't leave junk behind
  if (dealAfter) await prisma.deal.delete({ where: { id: deal.id } });
  await prisma.lead.delete({ where: { id: lead.id } });
  if (after) await prisma.user.delete({ where: { id: u.id } });
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
