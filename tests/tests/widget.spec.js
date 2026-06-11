const { test, expect } = require('@playwright/test');
const http = require('http');
require('dotenv').config();

const BASE = process.env.BASE_URL;
const ACC = process.env.ACCOUNT_ID;
const TOKEN = process.env.API_TOKEN;
const WEB_INBOX_ID = process.env.WEB_INBOX_ID;
const WIDGET_TOKEN = 'Hhqgq4mgLKaEXu1hnJHndMC4';

const PAGE_HTML = `<!doctype html><html><head><meta charset=utf-8><title>Articket widget test</title></head>
<body><h1>Articket test page</h1>
<script>(function(d,t){var BASE_URL="${BASE}";var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
g.src=BASE_URL+"/packs/js/sdk.js";g.defer=true;g.async=true;s.parentNode.insertBefore(g,s);
g.onload=function(){window.chatwootSDK.run({websiteToken:'${WIDGET_TOKEN}',baseUrl:BASE_URL})}})(document,"script");</script>
</body></html>`;

let server;
test.beforeAll(async () => {
  server = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(PAGE_HTML); });
  await new Promise(res => server.listen(8099, '127.0.0.1', res));
});
test.afterAll(async () => { if (server) server.close(); });

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'api_access_token': TOKEN } });
  return { status: res.status, json: await res.json().catch(() => null) };
}

// Visitor opens the embedded widget, sends a message, and we confirm via API
// that the message landed as a conversation in the Web inbox.
test('widget: visitor message reaches the panel (end-to-end)', async ({ page }) => {
  const marker = `[TEST-HARNESS] hola soporte ${Date.now()}`;

  await page.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle' });
  await page.click('button.woot-widget-bubble');
  await page.waitForTimeout(2500);

  const frame = page.frames().find(f => f.url().includes('/widget?website_token'));
  expect(frame, 'widget iframe should be present').toBeTruthy();

  const start = frame.locator('button, a').filter({ hasText: /Iniciar conversaci/i }).first();
  if (await start.count()) { await start.click(); }

  const input = frame.locator('#chat-input');
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.fill(marker);
  await input.press('Enter');

  // Poll the API: a new conversation in the web inbox should carry our marker
  let found = false;
  for (let i = 0; i < 12 && !found; i++) {
    await page.waitForTimeout(2500);
    const list = await api(`/api/v1/accounts/${ACC}/conversations?inbox_id=${WEB_INBOX_ID}&status=open`);
    const convs = (list.json && list.json.data && list.json.data.payload) || [];
    for (const c of convs.slice(0, 8)) {
      const msgs = await api(`/api/v1/accounts/${ACC}/conversations/${c.id}/messages`);
      const payload = (msgs.json && msgs.json.payload) || [];
      if (payload.some(m => (m.content || '').includes(marker))) { found = true; break; }
    }
  }
  expect(found, `message "${marker}" should appear as a conversation in the web inbox`).toBeTruthy();
});
