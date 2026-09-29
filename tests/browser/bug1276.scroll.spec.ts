import { expect, test } from '@playwright/test'

test('Розхід has a visible bottom control that scrolls to the last column', async ({ page }) => {
  await page.setViewportSize({ width: 1560, height: 900 })
  await page.goto('/tests/browser/bug1276.html')

  const scroll = page.locator('.data-table-scroll')
  const control = page.getByRole('slider', { name: 'Горизонтальна прокрутка таблиці' })
  await expect(control).toBeVisible()
  await expect.poll(() => scroll.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)

  const tableBottom = (await page.locator('.data-table-table').boundingBox())!.y
    + (await page.locator('.data-table-table').boundingBox())!.height
  const controlTop = (await control.boundingBox())!.y
  expect(controlTop).toBeGreaterThanOrEqual(tableBottom)
  expect(controlTop - tableBottom).toBeLessThan(35)

  const track = (await control.boundingBox())!
  await page.mouse.click(track.x + track.width - 28, track.y + track.height / 2)
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  const clickedPosition = await scroll.evaluate((element) => element.scrollLeft)
  const rightmost = await page.getByRole('columnheader', { name: 'Кількість' }).boundingBox()
  const viewport = await scroll.boundingBox()
  expect(rightmost!.x + rightmost!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width + 2)

  await page.mouse.move(track.x + track.width - 28, track.y + track.height / 2)
  await page.mouse.down()
  await page.mouse.move(track.x + 28, track.y + track.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeLessThan(clickedPosition)

  await control.focus()
  await control.press('End')
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBe(clickedPosition)
})

test('Розхід does not show a redundant control when all columns fit', async ({ page }) => {
  await page.setViewportSize({ width: 2200, height: 900 })
  await page.goto('/tests/browser/bug1276.html')
  await expect(page.locator('.data-table-table')).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Горизонтальна прокрутка таблиці' })).toHaveCount(0)
})
