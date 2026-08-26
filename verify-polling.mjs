import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const report = {};
  
  // Track requests
  let activeUrl = '';
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/') && !url.includes('/api/auth/session') && !url.includes('/api/conversations/unread')) {
      if (!report[activeUrl]) report[activeUrl] = [];
      report[activeUrl].push(url.replace('http://localhost:3001', ''));
    }
  });

  console.log('Logging in...');
  await page.goto('http://localhost:3001/#/auth/signin');
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.fill('input[name="email"]', 'customer@fixit.demo');
  await page.fill('input[name="password"]', 'fixit-cust');
  await page.click('button[type="submit"]');
  
  console.log('Waiting for login redirect to dashboard...');
  await page.waitForTimeout(5000);
  
  // 1. Dashboard
  console.log('\n--- 1. Dashboard (30s) ---');
  activeUrl = 'Dashboard';
  report[activeUrl] = [];
  await page.waitForTimeout(30000);
  console.log(`Requests: ${report[activeUrl].length}`);
  
  // 2. Equipment
  console.log('\n--- 2. Equipment (30s) ---');
  await page.goto('http://localhost:3001/#/equipment');
  await page.waitForTimeout(3000); // initial fetch
  activeUrl = 'Equipment';
  report[activeUrl] = [];
  await page.waitForTimeout(30000);
  console.log(`Requests: ${report[activeUrl].length}`);

  // 3. Messages
  console.log('\n--- 3. Messages (30s) ---');
  await page.goto('http://localhost:3001/#/messages');
  await page.waitForTimeout(3000); // initial fetch
  activeUrl = 'Messages (List)';
  report[activeUrl] = [];
  await page.waitForTimeout(30000);
  console.log(`Requests: ${report[activeUrl].length}`);

  // 4. Hidden Tab Verification
  console.log('\n--- 4. Hidden Tab (30s) ---');
  activeUrl = 'Hidden Tab';
  report[activeUrl] = [];
  // Hide page by creating a new page and bringing it to front
  const page2 = await browser.newPage();
  await page2.goto('about:blank');
  await page2.bringToFront();
  console.log('Switched to blank tab...');
  await page.waitForTimeout(30000);
  console.log(`Requests while hidden: ${report[activeUrl].length}`);
  
  await page.bringToFront();
  console.log('Brought app tab back to front, waiting 5 seconds...');
  await page.waitForTimeout(5000); // should trigger one refetchOnWindowFocus
  
  console.log('\n--- Report ---');
  fs.writeFileSync('polling_report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
})();
