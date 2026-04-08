const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const filePath = path.resolve(__dirname, 'system_walkthrough.html');
  await page.goto('file:///' + filePath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  
  await page.pdf({
    path: path.resolve(__dirname, 'Thamaraa_System_Walkthrough.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
  });
  
  await browser.close();
  console.log('PDF generated successfully!');
})();
