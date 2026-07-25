import { expect, test } from '@playwright/test'

test('renders the connection status panel', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('connection-status')).toBeVisible()
})
