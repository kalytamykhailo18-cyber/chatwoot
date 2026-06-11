#!/usr/bin/env node
/* API-layer health checks for the Chatwoot deployment.
   Verifies auth, expected inboxes, and agents. No browser needed. */
require('dotenv').config();

const BASE = process.env.BASE_URL;
const ACC = process.env.ACCOUNT_ID;
const TOKEN = process.env.API_TOKEN;

const H = { 'api_access_token': TOKEN, 'Content-Type': 'application/json' };
let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); failures++; };

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: H });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text };
}

(async () => {
  console.log(`\n== API checks against ${BASE} (account ${ACC}) ==`);

  // 1) Auth / profile
  let r = await get('/api/v1/profile');
  if (r.status === 200 && r.json && r.json.email) ok(`auth works (profile: ${r.json.email})`);
  else bad(`auth/profile failed (status ${r.status})`);

  // 2) Inboxes
  r = await get(`/api/v1/accounts/${ACC}/inboxes`);
  const inboxes = (r.json && r.json.payload) || [];
  if (r.status === 200) ok(`inboxes endpoint OK (${inboxes.length} inboxes)`);
  else bad(`inboxes endpoint failed (status ${r.status})`);

  const emails = inboxes.filter(i => i.channel_type === 'Channel::Email');
  const widgets = inboxes.filter(i => i.channel_type === 'Channel::WebWidget');

  if (widgets.length >= 1) ok(`web widget inbox present (${widgets.map(w=>w.name).join(', ')})`);
  else bad('no web widget inbox found');

  const expectedEmails = ['sebastian@articket.com.ar','compras@articket.com.ar','ventas@articket.com.ar',
    'devoluciones@articket.com.ar','administracion@articket.com.ar','alertas@articket.com.ar'];
  for (const e of expectedEmails) {
    const found = emails.find(i => (i.name||'').toLowerCase().includes(e.split('@')[0]));
    if (found) ok(`email inbox present: ${e}`);
    else bad(`email inbox MISSING: ${e}`);
  }

  // 3) Agents
  r = await get(`/api/v1/accounts/${ACC}/agents`);
  const agents = Array.isArray(r.json) ? r.json : [];
  if (r.status === 200) ok(`agents endpoint OK (${agents.length} agents: ${agents.map(a=>a.email).join(', ')})`);
  else bad(`agents endpoint failed (status ${r.status})`);

  console.log(`\n== API summary: ${failures === 0 ? '\x1b[32mALL PASS\x1b[0m' : '\x1b[31m'+failures+' FAILURES\x1b[0m'} ==\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('api-check crashed:', e); process.exit(2); });
