import { expect, test, type Locator } from '@playwright/test'

const barSelector = '.data-table-sticky-scrollbar'

async function box(locator: Locator) {
  const result = await locator.boundingBox()
  expect(result).not.toBeNull()
  return result!
}

test('Розхід pins a synced horizontal scrollbar to the bottom of the visible area', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/tests/browser/bug1276.html')

  const workspace = page.locator('.bug1276-workspace')
  const scroll = page.locator('.data-table-scroll')
  const bar = page.locator(barSelector)
  await expect(bar).toHaveAttribute('data-visible', 'true')

  const scrollBox = await box(scroll)
  const barBox = await box(bar)
  expect(barBox.height).toBeGreaterThan(10)
  const workspaceBottom = await workspace.evaluate((element) => element.getBoundingClientRect().top + element.clientHeight)
  expect(scrollBox.y + scrollBox.height).toBeGreaterThan(workspaceBottom)
  expect(Math.abs(barBox.y + barBox.height - workspaceBottom)).toBeLessThanOrEqual(1)
  expect(Math.abs(barBox.x - scrollBox.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(barBox.width - scrollBox.width)).toBeLessThanOrEqual(1)

  const workspaceHeight = await workspace.evaluate((element) => element.scrollHeight)
  const thumb = await bar.evaluate((element) => element.clientWidth * element.clientWidth / element.scrollWidth)
  await page.mouse.move(barBox.x + thumb / 2, barBox.y + barBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(barBox.x + barBox.width, barBox.y + barBox.height / 2, { steps: 10 })
  await page.mouse.up()

  const tableMax = await scroll.evaluate((element) => {
    const current = element.scrollLeft
    element.scrollLeft = element.scrollWidth
    const max = element.scrollLeft
    element.scrollLeft = current
    return max
  })
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBe(tableMax)
  expect(await bar.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft)).toBeLessThanOrEqual(1)
  const rightmost = await box(page.getByRole('columnheader', { name: 'Кількість' }))
  expect(rightmost.x + rightmost.width).toBeLessThanOrEqual(scrollBox.x + scrollBox.width + 2)

  await scroll.evaluate((element) => { element.scrollLeft = 120 })
  await expect.poll(() => bar.evaluate((element) => element.scrollLeft)).toBe(120)

  await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2)
  await page.mouse.wheel(200, 0)
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(120)

  await page.mouse.wheel(0, 200)
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await workspace.evaluate((element) => element.scrollHeight)).toBe(workspaceHeight)

  await workspace.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(bar).toHaveAttribute('data-visible', 'true')
  await expect.poll(async () => {
    const tableBottom = await box(scroll)
    const bottomControl = await box(bar)
    return Math.abs(bottomControl.y + bottomControl.height - tableBottom.y - tableBottom.height)
  }).toBeLessThanOrEqual(1)

  await workspace.evaluate((element) => { element.scrollTop = 0 })
  await expect(bar).toHaveAttribute('data-visible', 'true')
})

test('Розхід shows no extra scrollbar when all columns fit', async ({ page }) => {
  await page.setViewportSize({ width: 2200, height: 900 })
  await page.goto('/tests/browser/bug1276.html')
  await expect(page.locator('.data-table-table')).toBeVisible()
  await expect(page.locator(barSelector)).toHaveAttribute('data-visible', 'false')
  await expect(page.locator(barSelector)).toBeHidden()
})

for (const rows of [1, 5]) {
  test(`${rows}-row Розхід keeps the larger bottom control and reaches Кількість`, async ({ page }) => {
    await page.setViewportSize({ width: 1919, height: 953 })
    await page.goto(`/tests/browser/bug1276.html?rows=${rows}`)

    const scroll = page.locator('.data-table-scroll')
    const bar = page.getByRole('region', { name: 'Горизонтальна прокрутка таблиці' })
    await expect(page.locator('.data-table-table tbody tr')).toHaveCount(rows)
    await page.locator('.bug1276-workspace').evaluate((element) => { element.scrollTop = element.scrollHeight })
    await expect(bar).toHaveAttribute('data-visible', 'true')

    const scrollBox = await box(scroll)
    const barBox = await box(bar)
    expect(barBox.height).toBeGreaterThan(10)
    expect(Math.abs(barBox.y + barBox.height - scrollBox.y - scrollBox.height)).toBeLessThanOrEqual(1)

    await bar.press('End')
    await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    const quantity = await box(page.getByRole('columnheader', { name: 'Кількість' }))
    expect(quantity.x + quantity.width).toBeLessThanOrEqual(scrollBox.x + scrollBox.width + 2)
    await bar.press('Home')
    await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBe(0)
  })
}
