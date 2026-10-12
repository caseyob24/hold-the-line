// QA crawler: walks the app in the fake-Supabase harness at iPhone size, clicks through
// everything it can find, and reports console errors, failed requests and dead ends.
// Usage: node qa/crawl.mjs <outDir> [scenario]
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2];
const scenario = process.argv[3] ?? 'user';
mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5190';
const issues = [];
const shots = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
});
await ctx.addInitScript(() => {
  // Pretend to be an installed Home Screen app.
  Object.defineProperty(navigator, 'standalone', { get: () => true });
  const mm = window.matchMedia;
  window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : mm.call(window, q));
  window.__dialogs = [];
  window.confirm = (m) => { window.__dialogs.push(['confirm', m]); return true; };
  window.alert = (m) => { window.__dialogs.push(['alert', m]); };
  window.prompt = (m) => { window.__dialogs.push(['prompt', m]); return 'qa'; };
});
const page = await ctx.newPage();
let current = 'boot';
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push({ where: current, kind: `console.${m.type()}`, text: m.text().slice(0, 300) }); });
page.on('pageerror', (e) => issues.push({ where: current, kind: 'pageerror', text: e.message.slice(0, 300) }));
page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g') && !/^(tel|sms|mailto):/.test(r.url())) issues.push({ where: current, kind: 'requestfailed', text: `${r.method()} ${r.url()} ${r.failure()?.errorText}` }); });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('fonts.g')) issues.push({ where: current, kind: `http ${r.status()}`, text: r.url() }); });

async function shot(name) {
  const file = `${out}/${String(shots.length + 1).padStart(2, '0')}-${name.replace(/[^a-z0-9-]/gi, '_')}.png`;
  await page.screenshot({ path: file });
  shots.push({ name, file });
}
async function go(path) {
  current = path;
  await page.goto(`${BASE}${path}?qa=${scenario}`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  console.log('route', path);
}
async function overflowCheck(name) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = doc.scrollWidth > doc.clientWidth + 1;
    const tooSmall = [...document.querySelectorAll('button, a, input, select, textarea, [role=button]')]
      .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 32 || b.width < 32) && !el.closest('[aria-hidden]'); })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    const smallText = [...document.querySelectorAll('input, select, textarea')].filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length;
    return { wide, tooSmall: tooSmall.slice(0, 8), smallText };
  });
  if (r.wide) issues.push({ where: name, kind: 'layout', text: 'horizontal overflow (page wider than viewport)' });
  if (r.tooSmall.length) issues.push({ where: name, kind: 'tap-target', text: r.tooSmall.join(' | ') });
  if (r.smallText) issues.push({ where: name, kind: 'ios-zoom', text: `${r.smallText} input(s) under 16px font (iOS zooms on focus)` });
}

/** Click every visible button / link on the current screen (except sign out / delete / nav-away ones), checking that something happens. */
async function clickAround(name, { skip = [] } = {}) {
  const sel = 'button:visible, a:visible, [role=button]:visible, label.toggle:visible';
  const count = await page.locator(sel).count();
  const seen = new Set();
  for (let i = 0; i < Math.min(count, 25); i++) {
    const loc = page.locator(sel).nth(i);
    if (!(await loc.count())) continue;
    const label = ((await loc.getAttribute('aria-label')) || (await loc.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    if (/sign out|delete everything|back$|^close$/i.test(label) || skip.some((s) => label.toLowerCase().includes(s))) continue;
    const before = page.url() + '|' + (await page.locator('.sheet-backdrop').count());
    const html0 = await page.evaluate(() => document.body.innerHTML);
    try { await loc.click({ timeout: 1500 }); } catch (e) { issues.push({ where: name, kind: 'unclickable', text: `${label}: ${String(e.message).split('\n')[0].slice(0, 120)}` }); continue; }
    await page.waitForTimeout(200);
    const after = page.url() + '|' + (await page.locator('.sheet-backdrop').count());
    const html1 = await page.evaluate(() => document.body.innerHTML);
    const changed = before !== after || html1 !== html0;
    const href = await loc.getAttribute('href').catch(() => null);
    if (!changed && !/share|copy|turn on|connect|reload|refresh|retry/i.test(label) && !/^(tel|sms|mailto|https?):/.test(href ?? '')) issues.push({ where: name, kind: 'dead-click', text: `"${label}" did nothing visible` });
    // Close any sheet we opened, go back if we navigated away.
    if (await page.locator('.sheet-backdrop').count()) {
      await shot(`${name}-sheet-${label}`);
      const close = page.locator('.sheet button:has-text("Close")');
      if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      if (await page.locator('.sheet-backdrop').count()) await page.locator('.sheet-backdrop').click({ position: { x: 5, y: 5 } }).catch(() => {});
    }
    if (!page.url().startsWith(before.split('|')[0])) {
      await shot(`${name}-to-${label}`);
      await overflowCheck(`${name} → ${label}`);
      await page.goBack({ waitUntil: 'load' }).catch(() => {});
      await page.waitForTimeout(250);
      if (!page.url().includes(current)) await go(current);
    }
  }
}

const routes = scenario === 'sponsor'
  ? ['/', '/sponsor-view', '/game-day', '/more', '/settings', '/motivation']
  : scenario === 'fresh' ? ['/']
  : scenario === 'signedout' ? ['/', '/join/abc123', '/privacy']
  : ['/', '/today', '/workbook', '/review', '/motivation', '/sobrieties', '/check-in', '/urge', '/milestones', '/savings', '/workouts', '/calendar', '/reach-out', '/sponsor', '/settings', '/game-day', '/more', '/admin', '/privacy', '/workbook/gratitude'];

for (const r of routes) {
  await go(r);
  const txt = (await page.locator('body').innerText()).slice(0, 80).replace(/\s+/g, ' ');
  await shot(`${r === '/' ? 'home' : r.slice(1)}`);
  await overflowCheck(r);
  if (/loading|mustering|loading your file/i.test(txt) && !/day \d/i.test(txt)) { await page.waitForTimeout(1200); if (/loading your file|mustering/i.test((await page.locator('body').innerText()).slice(0, 80))) issues.push({ where: r, kind: 'stuck', text: `still "${txt}" after wait` }); }
  if (r === '/workbook') continue; // 24 identical drill links; the drill screen itself is covered by /workbook/gratitude
  await clickAround(r, { skip: ['delete account', 'leave', 'remove', 'disconnect', 'end streak', 'archive', 'reset'] });
}

// Scenario-specific flows ----------------------------------------------------------
if (scenario === 'user') {
  // Full onboarding-free flows: pledge, drill, review, urge, workout, invite sponsor, settings sheets.
  await go('/today');
  const pledge = page.locator('button', { hasText: /pledge/i }).first();
  if (await pledge.count()) { await pledge.click(); await page.waitForTimeout(500); await shot('today-after-pledge'); }
  await go('/review');
  await shot('review-start');
  const held = page.locator('button', { hasText: /held|stayed/i }).first();
  if (await held.count()) { await held.click(); await page.waitForTimeout(300); }
  const save = page.locator('button', { hasText: /save|submit|log|done|complete/i }).last();
  if (await save.count()) { await save.click(); await page.waitForTimeout(600); await shot('review-saved'); }
  await go('/urge');
  await page.locator('textarea, input[type=text]').first().fill('QA urge note').catch(() => {});
  const chip = page.locator('.chip').first(); if (await chip.count()) await chip.click();
  const logBtn = page.locator('button', { hasText: /log|save/i }).last();
  if (await logBtn.count()) { await logBtn.click(); await page.waitForTimeout(600); await shot('urge-logged'); }
  await go('/workbook/gratitude');
  await page.locator('textarea').first().fill('QA answer').catch(() => {});
  const saveDrill = page.locator('button', { hasText: /save|done|complete/i }).last();
  if (await saveDrill.count()) { await saveDrill.click(); await page.waitForTimeout(600); await shot('drill-saved'); }
  await go('/workouts');
  const add = page.locator('button', { hasText: /add|new|log/i }).first();
  if (await add.count()) { await add.click(); await page.waitForTimeout(400); await shot('workout-form'); }
}
if (scenario === 'fresh') {
  // Walk onboarding end to end.
  for (let step = 0; step < 8; step++) {
    await shot(`onboarding-${step}`);
    await overflowCheck(`onboarding ${step}`);
    for (const inp of await page.locator('input:visible').all()) {
      const type = await inp.getAttribute('type');
      const val = await inp.inputValue().catch(() => '');
      if (val) continue;
      if (type === 'number') await inp.fill('25'); else if (type === 'date' || type === 'datetime-local') continue; else if (type === 'tel') await inp.fill('7025550100'); else if (type === 'time') continue; else await inp.fill('Casey').catch(() => {});
    }
    const next = page.locator('button.primary:visible, button:has-text("Next"):visible, button:has-text("Continue"):visible, button:has-text("Start"):visible, button:has-text("Done"):visible, button:has-text("Enlist"):visible').last();
    if (!(await next.count())) break;
    const label = (await next.innerText()).trim();
    await next.click().catch((e) => issues.push({ where: `onboarding ${step}`, kind: 'unclickable', text: `${label}: ${e.message.slice(0, 100)}` }));
    await page.waitForTimeout(500);
    if (!page.url().includes('onboarding') && step > 0 && (await page.locator('.tabbar, nav').count())) { await shot('onboarding-done-home'); break; }
  }
}
if (scenario === 'signedout') {
  await go('/');
  await page.locator('input[type=email]').fill('caseyob24@gmail.com');
  await page.locator('button', { hasText: 'Sign in' }).click();
  await page.waitForTimeout(800);
  await shot('after-sign-in');
  if (!(await page.locator('body').innerText()).match(/Day \d+|Hold the Line/)) issues.push({ where: 'sign-in', kind: 'flow', text: 'did not land on Home after sign in' });
}

await browser.close();
const dedup = [...new Map(issues.map((i) => [`${i.kind}|${i.text}`, i])).values()];
writeFileSync(`${out}/report.json`, JSON.stringify({ scenario, shots, issues: dedup }, null, 2));
console.log(`${scenario}: ${shots.length} screenshots, ${dedup.length} distinct issues`);
for (const i of dedup) console.log(`- [${i.kind}] ${i.where}: ${i.text}`);
