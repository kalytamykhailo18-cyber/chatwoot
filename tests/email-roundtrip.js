#!/usr/bin/env node
/* Email inbound round-trip test:
   1) send an email (SMTP :26 STARTTLS) to a target inbox,
   2) trigger Chatwoot's IMAP fetch for that inbox,
   3) confirm via API the email became a conversation. */
require('dotenv').config();
const nodemailer = require('nodemailer');
const { execSync } = require('child_process');

const BASE = process.env.BASE_URL;
const ACC = process.env.ACCOUNT_ID;
const TOKEN = process.env.API_TOKEN;
const TARGET = process.env.TEST_TARGET_INBOX_EMAIL; // e.g. ventas@articket.com.ar

const marker = `TEST-HARNESS-${Date.now()}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const H = { 'api_access_token': TOKEN };
let fail = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); fail++; };

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: H });
  return { status: res.status, json: await res.json().catch(() => null) };
}

(async () => {
  console.log(`\n== Email round-trip to ${TARGET} (marker ${marker}) ==`);

  // 1) Send the email
  const tx = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT),
    secure: false, requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
  try {
    await tx.sendMail({
      from: process.env.SMTP_USER, to: TARGET,
      subject: `[TEST-HARNESS] consulta ${marker}`,
      text: `Hola, esto es una prueba automatica del harness. Codigo: ${marker}`,
    });
    ok('email sent via SMTP');
  } catch (e) { bad(`SMTP send failed: ${e.message}`); process.exit(1); }

  // 2) Give the mail server a moment, then trigger Chatwoot IMAP fetch
  await sleep(6000);
  try {
    execSync(`cd /opt/chatwoot && docker compose exec -T rails bundle exec rails runner ` +
      `"Inboxes::FetchImapEmailsJob.perform_now(Channel::Email.find_by(email: '${TARGET}'), 10)" ` +
      `> /tmp/fetch.log 2>&1`,
      { stdio: 'ignore', timeout: 120000, maxBuffer: 20 * 1024 * 1024 });
    ok('IMAP fetch triggered');
  } catch (e) { bad(`fetch trigger failed: ${e.message}`); }

  // 3) Resolve the target inbox id, then poll for the conversation
  const inboxes = await api(`/api/v1/accounts/${ACC}/inboxes`);
  const inbox = ((inboxes.json && inboxes.json.payload) || [])
    .find(i => (i.name || '').toLowerCase().includes(TARGET.split('@')[0]));
  if (!inbox) { bad(`target inbox for ${TARGET} not found`); process.exit(1); }

  let found = false;
  for (let i = 0; i < 10 && !found; i++) {
    const list = await api(`/api/v1/accounts/${ACC}/conversations?inbox_id=${inbox.id}&status=open`);
    const convs = (list.json && list.json.data && list.json.data.payload) || [];
    for (const c of convs.slice(0, 10)) {
      const msgs = await api(`/api/v1/accounts/${ACC}/conversations/${c.id}/messages`);
      const payload = (msgs.json && msgs.json.payload) || [];
      if (payload.some(m => (m.content || '').includes(marker)) ||
          (c.additional_attributes && JSON.stringify(c).includes(marker))) { found = true; break; }
    }
    if (!found) await sleep(4000);
  }
  found ? ok(`email appeared as a conversation in "${inbox.name}" inbox`)
        : bad(`email with marker ${marker} did not appear in panel`);

  console.log(`\n== Email round-trip: ${fail === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ==\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('crashed:', e); process.exit(2); });
