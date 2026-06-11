# Articket Chatwoot — Test Harness

End-to-end verification of the Chatwoot deployment at https://soporte.articket.ar.
Run from this directory on the VPS (Node 18 + Playwright chromium installed).

## Layers

1. **API checks** (`api-check.js`) — auth, expected inboxes (6 email + 1 web), agents.
   Fast, no browser. `npm run api`
2. **Panel E2E** (`tests/panel.spec.js`) — real browser login to the agent panel.
3. **Widget E2E** (`tests/widget.spec.js`) — embeds the live widget on a local page,
   sends a visitor message, and confirms via API it became a conversation.
   `npm run e2e`
4. **Email round-trip** (`email-roundtrip.js`) — sends an email to an inbox, triggers
   the IMAP fetch, and confirms it became a conversation. `npm run email`

## Run everything

```bash
./run-all.sh      # all layers + cleans up test data afterwards
```

## Cleanup

Test artifacts are tagged `TEST-HARNESS`. `./cleanup.sh` removes only those
conversations; real customer conversations are untouched.

## Config

Credentials and targets live in `.env` (chmod 600). Notes:
- `API_TOKEN` is the Chatwoot access token of the panel admin.
- The email test sends **from a mailbox that is not** `MAILER_SENDER_EMAIL`
  (alertas@), because Chatwoot ignores inbound mail from its own notification
  sender. We send from compras@ to ventas@.

## Extending for Meta channels

When WhatsApp / Facebook / Instagram are connected, add a spec that POSTs a
simulated inbound webhook to Chatwoot and asserts (via API) a conversation is
created in the matching inbox — same verify-via-API pattern used here.
