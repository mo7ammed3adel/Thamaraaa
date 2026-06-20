const puppeteer = require('puppeteer');
const BASE = 'https://thamaraaa.vercel.app';
const EMAIL = 'admin@thamaraa.com';
const PASS = 'admin123';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  console.error:', msg.text());
  });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const inputs = await page.$$('input');
  await inputs[0].type(EMAIL); await inputs[1].type(PASS);
  await page.click('button[type=submit]');
  await new Promise(r => setTimeout(r, 4000));

  for (const p of ['/dashboard/profile', '/dashboard/sales', '/dashboard/users']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const status = await page.evaluate(() => {
      const m = document.body.innerText.match(/Application error[^.]*\.|Internal Server Error[^.]*\.|This page could not be found[^.]*\.|404[^\n]*|500[^\n]*/);
      return m ? m[0] : (document.title + ' :: ' + document.body.innerText.slice(0, 200));
    });
    console.log(`${p}\n  ${status}\n`);
  }

  await browser.close();
})();
