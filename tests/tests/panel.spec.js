const { test, expect } = require('@playwright/test');
require('dotenv').config();

// Verifies an agent can log into the Chatwoot panel over HTTPS.
test('panel: agent can log in and reach the dashboard', async ({ page }) => {
  await page.goto('/app/login');

  await page.locator('input[name="email_address"]').first().fill(process.env.PANEL_EMAIL);
  await page.locator('input[name="password"]').first().fill(process.env.PANEL_PASSWORD);
  await page.locator('button[type="submit"]').first().click();

  // On success Chatwoot lands on /app/accounts/<id>/...
  await page.waitForURL(/\/app\/accounts\/\d+/, { timeout: 30000 });
  expect(page.url()).toMatch(/\/app\/accounts\/\d+/);
});
