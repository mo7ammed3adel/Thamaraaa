const puppeteer = require('puppeteer');
const BASE = 'https://thamaraaa.vercel.app';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const inputs = await page.$$('input');
  await inputs[0].type('admin@thamaraa.com'); await inputs[1].type('admin123');
  await page.click('button[type=submit]');
  await new Promise(r => setTimeout(r, 4000));

  await page.goto(BASE + '/dashboard/profile', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const html = await page.content();
  // Find what triggered the regex
  for (const needle of ['Application error', 'This page could not be found', 'Internal Server Error']) {
    const idx = html.indexOf(needle);
    if (idx >= 0) {
      console.log(`Found "${needle}" at offset ${idx}:`);
      console.log('  context:', html.slice(Math.max(0, idx - 80), idx + 200).replace(/\s+/g, ' '));
    }
  }
  // Also check if the H1/main content is what we expect
  const visibleText = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    return main.innerText.slice(0, 500);
  });
  console.log('\n--- main innerText ---');
  console.log(visibleText);

  await browser.close();
})();
