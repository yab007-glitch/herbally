import { test, expect } from '@playwright/test';

test('Smoke test: Home page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/HerbAlly/);
});

test('Smoke test: Herb search', async ({ page }) => {
  await page.goto('/herbs');
  await expect(page.locator('h1')).toContainText('Herbs');
});

test('Smoke test: API Chat', async ({ request }) => {
  const response = await request.post('/api/chat', {
    data: { messages: [{ role: 'user', content: 'hello' }] },
  });
  expect(response.ok()).toBeTruthy();
});
