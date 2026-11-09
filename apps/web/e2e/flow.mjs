// Prova end-to-end: collegamento del tablet, promemoria, conferma e controllo di accessibilità.
// Serve un'app in esecuzione (E2E_URL, default http://localhost:3000) su un database appena creato con
// `SEED_THERAPY=0 npm run db:seed`. Uso: `npm run e2e`.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.E2E_URL ?? 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL ?? 'giovanni@example.com';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'password-di-prova';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
const opts = { locale: 'it-IT', timezoneId: 'Europe/Rome' };

async function axeViolations(page, label) {
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag22aa'] }));
  const list = res.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].html.slice(0, 100)}`);
  assert.deepEqual(list, [], `Problemi di accessibilità in ${label}`);
  console.log(`  ✓ accessibilità: ${label}`);
}

try {
  // 1. Il familiare accede dal telefono.
  const phone = await browser.newContext({ ...opts, viewport: { width: 390, height: 844 } });
  const cg = await phone.newPage();
  await cg.goto(`${BASE}/login`);
  await cg.fill('input[type=email]', EMAIL);
  await cg.fill('input[type=password]', PASSWORD);
  await cg.click('button[type=submit]');
  await cg.waitForURL('**/app');
  console.log('  ✓ accesso del familiare');

  // 2. Il tablet mostra il codice e il familiare lo inserisce.
  const wall = await browser.newContext({ ...opts, viewport: { width: 1280, height: 800 } });
  const tb = await wall.newPage();
  await tb.goto(`${BASE}/t`);
  await tb.waitForFunction(() => /\d{3}\s?\d{3}/.test(document.body.innerText), null, { timeout: 20_000 });
  await axeViolations(tb, 'tablet, schermata di collegamento');
  const code = (await tb.evaluate(() => document.body.innerText.match(/\d{3}\s?\d{3}/)[0])).replace(/\s/g, '');
  await cg.goto(`${BASE}/app/altro`);
  await cg.fill('#pair-code', code);
  await cg.click('form button[type=submit]');
  await tb.waitForSelector('[data-testid="clock"]', { timeout: 20_000 });
  console.log('  ✓ tablet collegato');

  // 3. Il familiare aggiunge un farmaco da prendere adesso.
  const hhmm = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Rome' }).format(new Date());
  const made = await cg.evaluate(
    async ([time]) =>
      (
        await fetch('/api/app/medications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            medication: { name: 'Provamed', form: 'compressa', critical: true },
            rules: [{ quantity: 1, timing: { kind: 'fixed', time } }],
          }),
        })
      ).status,
    [hhmm],
  );
  assert.equal(made, 201);

  // 4. Il tablet mostra il promemoria a tutto schermo, il paziente tocca il tasto grande.
  await tb.waitForSelector('[data-testid="take"]', { timeout: 40_000 });
  assert.match(await tb.innerText('body'), /Provamed/);
  await axeViolations(tb, 'tablet, promemoria');
  await tb.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/e2e-reminder.png` : undefined });
  await tb.waitForTimeout(1000); // oltre l'attesa anti-tocco involontario
  await tb.click('[data-testid="take"]', { force: true }); // il tasto pulsa piano: Playwright lo riterrebbe instabile
  await tb.waitForSelector('[data-testid="undo"]', { timeout: 10_000 });
  console.log('  ✓ conferma sul tablet');

  // 5. Il familiare vede la dose presa.
  await cg.goto(`${BASE}/app`);
  await cg.waitForSelector('[data-testid="dose"][data-status="taken"]', { timeout: 15_000 });
  console.log('  ✓ il familiare vede "Presa"');

  // 6. Un secondo familiare (la sorella) viene invitato con un link e sceglie da sé email e password.
  await cg.goto(`${BASE}/app/altro`);
  await cg.fill('#inv-name', 'Maria');
  await cg.click('form:has(#inv-name) button[type=submit]');
  await cg.waitForSelector('input[aria-label="Link d’invito"]');
  const inviteUrl = await cg.inputValue('input[aria-label="Link d’invito"]');
  assert.match(inviteUrl, /\/invito\//);
  await axeViolations(cg, '/app/altro con invito');
  const sister = await browser.newContext({ ...opts, viewport: { width: 390, height: 844 } });
  const sp = await sister.newPage();
  await sp.goto(inviteUrl.replace(/^https?:\/\/[^/]+/, BASE));
  await sp.waitForSelector('#email');
  await axeViolations(sp, '/invito');
  await sp.fill('#email', 'maria@example.com');
  await sp.fill('#password', 'una-password-lunga');
  await sp.click('button[type=submit]');
  await sp.waitForURL('**/app');
  await sp.goto(`${BASE}/app/altro`);
  await sp.waitForSelector('text=Maria (tu)');
  assert.equal(await sp.locator('#inv-name').count(), 0, 'chi non è amministratore non può invitare');
  const again = await sister.newPage();
  await again.goto(inviteUrl.replace(/^https?:\/\/[^/]+/, BASE));
  assert.match(await again.innerText('body'), /non è più valido/);
  console.log('  ✓ invito e secondo familiare');

  // 7. Controllo di accessibilità sulle pagine del familiare.
  for (const path of ['/app', '/app/terapia', '/app/storico', '/app/altro']) {
    await cg.goto(`${BASE}${path}`);
    await cg.waitForSelector('main h1');
    await cg.waitForTimeout(800);
    await axeViolations(cg, path);
  }
  console.log('Tutto in ordine.');
} finally {
  await browser.close();
}
