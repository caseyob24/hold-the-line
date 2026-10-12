import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const out = process.argv[2]; const R = [];
const ok = (n, c, x = '') => R.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
const tbl = (t) => p.evaluate((t) => window.__qa.tables[t], t);
await p.goto('http://localhost:5190/today?qa=user&reset=1', { waitUntil: 'load' }); await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/today-orders.png`, fullPage: true });
ok('orders section renders 4 rows', (await p.locator('.order-row').count()) === 4);
// check off Whiten teeth
await p.locator('button[aria-label="Check off Whiten teeth for today"]').click(); await p.waitForTimeout(400);
const teethId = (await tbl('goals')).find((g) => g.title === 'Whiten teeth').id; const todayK = new Date().toISOString().slice(0, 10);
ok('check writes goal_check', (await tbl('goal_checks')).some((c) => c.date === todayK && c.goal_id === teethId));
// undo
await p.locator('button[aria-label="Undo Whiten teeth for today"]').click(); await p.waitForTimeout(400);
ok('undo removes it', !(await tbl('goal_checks')).some((c) => c.date === todayK && c.goal_id === teethId));
// gym: 2/4 → check → 3/4
await p.locator('button[aria-label="Check off Gym for today"]').click(); await p.waitForTimeout(400);
ok('gym counter increments', (await p.locator('.order-row', { hasText: 'Gym' }).innerText()).includes('/ 4'));
// add a new one: weekly ×2
await p.locator('button', { hasText: 'Add a standing order' }).click(); await p.waitForTimeout(300);
await p.locator('.sheet input.input').fill('Call Mom');
await p.locator('.sheet .chip', { hasText: '× per week' }).click();
await p.locator('.sheet .chip', { hasText: /^2$/ }).click();
await p.locator('.sheet label.toggle input').check();
await p.screenshot({ path: `${out}/sheet-new.png`, fullPage: true });
await p.locator('.sheet button.primary').click(); await p.waitForTimeout(600);
const mom = (await tbl('goals')).find((g) => g.title === 'Call Mom');
ok('new weekly goal saved with target 2 + remind', mom?.cadence === 'weekly' && mom.target === 2 && mom.remind === true, JSON.stringify(mom));
ok('list now 5 rows', (await p.locator('.order-row').count()) === 5);
// edit → pause
await p.locator('button[aria-label="Edit Call Mom"]').click(); await p.waitForTimeout(300);
await p.locator('.sheet button', { hasText: 'Pause' }).click(); await p.waitForTimeout(500);
ok('pause hides it', (await p.locator('.order-row').count()) === 4 && (await tbl('goals')).find((g) => g.title === 'Call Mom').paused_at);
// retire Book dentist
await p.locator('button[aria-label="Edit Book dentist"]').click(); await p.waitForTimeout(300);
await p.locator('.sheet button', { hasText: 'Retire' }).click(); await p.waitForTimeout(200);
await p.locator('.sheet button', { hasText: 'Yes, retire it' }).click(); await p.waitForTimeout(500);
ok('retire archives', (await tbl('goals')).find((g) => g.title === 'Book dentist').archived_at && (await p.locator('.order-row').count()) === 3);
// debrief tally shows Orders
await p.goto('http://localhost:5190/review?qa=user', { waitUntil: 'load' }); await p.waitForTimeout(800);
const tally = await p.locator('text=Today\'s tally').locator('..').innerText();
ok('debrief tally has Orders x/y', /Orders \d\/\d/.test(tally), tally.replace(/\n/g, ' '));
console.log(R.join('\n')); console.log('pageerrors', errs); await b.close();
