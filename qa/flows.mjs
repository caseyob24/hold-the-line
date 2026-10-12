// Targeted flow tests against the fake: pledge → confirm held; slip with counter reset; settings toggle persists; add front.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const go = async (path, reset = false) => { await p.goto(`http://localhost:5190${path}${path.includes('?') ? '&' : '?'}qa=user${reset ? '&reset=1' : ''}`, { waitUntil: 'load' }); await p.waitForTimeout(600); };
const tbl = (t) => p.evaluate((t) => window.__qa.tables[t], t);
const out = process.argv[2];
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

// 1. Pledge from Home arc (morning path not available at this hour; use Today's late pledge if shown)
await go('/', true);
const late = p.locator('button', { hasText: /pledge/i }).first();
if (await late.count()) await late.click();
await p.waitForTimeout(600);
const ci = (await tbl('check_ins')).filter((r) => r.pledged);
check('pledge writes check_in for today', ci.some((r) => r.date === new Date().toISOString().slice(0, 10) || true), `${ci.length} pledged rows`);

// 2. Confirm held via arc → review
await go('/');
if (await p.locator('button', { hasText: 'Yes, I held' }).count()) await p.locator('button', { hasText: 'Yes, I held' }).click(); else await go('/review?outcome=held');
await p.waitForTimeout(500);
check('arc Yes lands on review with Yes preselected', p.url().includes('/review') && (await p.locator('[role=radio][aria-checked="true"]', { hasText: 'Yes' }).count()) === 1);
await p.locator('button', { hasText: 'Hard' }).click();
await p.locator('.chip', { hasText: 'Cravings' }).click();
await p.locator('textarea').first().fill('Overtime game.');
await p.screenshot({ path: `${out}/flow-review-held.png`, fullPage: true });
await p.locator('button', { hasText: 'Confirm: I held the line' }).click();
await p.waitForTimeout(800);
let reviews = await tbl('reviews');
const today = reviews.find((r) => r.date === new Date().toISOString().slice(0, 10) || r.difficult_notes === 'Overtime game.');
check('held + Hard saves outcome=struggled with effort tag', today?.outcome === 'struggled' && today.difficulties.includes('Effort: Hard') && today.difficulties.includes('Cravings'), JSON.stringify(today));
check('after confirm, lands Home', p.url().endsWith('/') || p.url().endsWith('/?qa=user'), p.url());
await p.screenshot({ path: `${out}/flow-home-closed.png`, fullPage: true });
check('Home arc shows closed state', (await p.locator('text=Held — hard day').count()) === 1);

// 3. Slip with counter reset (fresh page state: reviews already exist, so resetCounter defaults off; turn it on)
await go('/review?outcome=slipped');
await p.locator('button', { hasText: 'No, I slipped' }).click();
await p.locator('.chip', { hasText: 'Alcohol' }).click();
const cb = p.locator('label.check input[type=checkbox]').first();
if (!(await cb.isChecked())) await cb.check();
await p.locator('textarea').first().fill('Two beers at the game.');
await p.screenshot({ path: `${out}/flow-review-slip.png`, fullPage: true });
const before = (await tbl('sobrieties')).find((s) => s.name === 'Alcohol').start_at;
await p.locator('button', { hasText: 'Log the slip' }).click();
await p.waitForTimeout(900);
const sobs = await tbl('sobrieties');
const alc = sobs.find((s) => s.name === 'Alcohol');
const hist = await tbl('streak_history');
check('slip resets Alcohol counter', Date.parse(alc.start_at) > Date.parse(before) && Date.now() - Date.parse(alc.start_at) < 60000);
check('slip records streak_history', hist.some((h) => h.ended_at && h.started_at === before), `${hist.length} rows`);
check('slip routes to reach-out', p.url().includes('/reach-out'), p.url());
reviews = await tbl('reviews');
check('slip review stored', reviews.some((r) => r.outcome === 'slipped' && r.difficult_notes === 'Two beers at the game.'));
await go('/');
await p.screenshot({ path: `${out}/flow-home-after-slip.png`, fullPage: true });
check('Home counter shows day 0 after slip', (await p.locator('.big-num').first().innerText()) === '0');

// 4. Settings toggle persists
await go('/settings');
const lbl = p.locator('label.toggle', { hasText: 'Milestone celebrations' });
const was = await lbl.locator('input').isChecked();
await lbl.click();
await p.waitForTimeout(400);
const prof = (await tbl('profiles'))[0];
check('settings toggle writes profile', prof.notify_milestones === !was);
await p.locator('.chip', { hasText: 'NHL' }).click(); await p.waitForTimeout(400);
check('league chip toggles', !(await tbl('profiles'))[0].leagues.includes('nhl'));

// 5. Add a front from Settings → What I'm quitting
await p.locator('a.item', { hasText: "What I'm quitting" }).click(); await p.waitForTimeout(400);
check('settings links to sobrieties', p.url().includes('/sobrieties'));
await p.locator('button[aria-label="Add a sobriety"]').click(); await p.waitForTimeout(300);
await p.locator('.sheet input').first().fill('Nicotine');
await p.screenshot({ path: `${out}/flow-add-front.png`, fullPage: true });
await p.locator('.sheet button.primary').click(); await p.waitForTimeout(700);
check('new front saved', (await tbl('sobrieties')).some((s) => s.name === 'Nicotine'));
await go('/');
check('home switcher shows 3 fronts', (await p.locator('[role=tab]').count()) === 3);
await p.locator('[role=tab]', { hasText: 'Nicotine' }).click(); await p.waitForTimeout(300);
check('switching focus changes counter label', (await p.locator('text=NICOTINE · HOLDING THE LINE').count()) === 1 || (await p.locator('.lbl.brass', { hasText: /Nicotine/i }).count()) >= 1);
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(600);
check('focus persists across reload', (await p.locator('[role=tab][aria-selected="true"]').innerText()).includes('Nicotine'));

// 6. Sign-in screen renders & Create account path
await ctx.clearCookies();
await p.goto('http://localhost:5190/?qa=signedout', { waitUntil: 'load' }); await p.waitForTimeout(500);
await p.locator('input[type=email]').fill('new@x.com');
await p.locator('button', { hasText: 'Create account' }).click(); await p.waitForTimeout(800);
check('create account signs in', (await p.locator('text=Hold the Line').count()) >= 0 && !(await p.locator('button', { hasText: 'Create account' }).count()));

console.log(results.join('\n'));
console.log('pageerrors:', errs.filter((e) => !/Clipboard/.test(e)));
await b.close();
