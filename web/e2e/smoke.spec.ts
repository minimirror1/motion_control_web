import { expect, test } from '@playwright/test'

test('renders the connection status panel', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('connection-status')).toBeVisible()
  await expect(page.getByRole('button', { name: '모터 활성화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '모션 재생' })).toBeVisible()
  await expect(page.getByRole('button', { name: '중지' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('button', { name: '모터 비활성화' })).toBeVisible()
  await expect(page.getByTestId('motor-power-state')).toBeVisible()
})
