import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'

const pagePaths = [
  'src/features/available-payments/pages/AvailablePaymentsPage.tsx',
  'src/features/payment-accounts/pages/PaymentAccountsPage.tsx',
  'src/features/advance-payments/pages/AdvancePaymentsPage.tsx',
  'src/features/payment-online-shop/pages/PaymentOnlineShopPage.tsx',
  'src/features/accounting-banks/pages/AccountingBanksPage.tsx',
  'src/features/currency-convertors/pages/CurrencyConvertorsPage.tsx',
]

const pageSources = Object.fromEntries(
  pagePaths.map((path) => [path, readFileSync(join(cwd(), path), 'utf8')]),
)

const datedPages = [
  { path: pagePaths[0], rowClass: 'available-payments-filter-row' },
  { path: pagePaths[2], rowClass: 'advance-payments-filter-row' },
  { path: pagePaths[3], rowClass: 'payment-online-shop-filter-row' },
]

describe('accounting payments filter-header pattern', () => {
  it.each(pagePaths)('%s uses the DataTable-owned toolbar slot', (path) => {
    const source = pageSources[path]

    expect(source).toContain('className="app-filter-table-toolbar-slot"')
    expect(source).toContain('showLayoutControls')
    expect(source).toContain('toolbarPortalTarget={tableToolbarSlot}')
    expect(source).not.toContain('DataTableDensityToggle')
    expect(source).not.toContain('useDataTableDensity')
  })

  it.each(datedPages)('$path starts with the shared paired-date geometry', ({ path, rowClass }) => {
    const source = pageSources[path]
    const rowStart = source.indexOf(`className="${rowClass}"`)
    const rowContentStart = source.indexOf('>', rowStart) + 1
    const firstChild = source.slice(rowContentStart).trimStart()

    expect(rowStart).toBeGreaterThanOrEqual(0)
    expect(rowContentStart).toBeGreaterThan(0)
    expect(firstChild.startsWith('<div className="app-filter-date-range">')).toBe(true)
    expect(source).toContain('className="app-filter-date-range"')
    expect(source).toContain("label={t('Від')}")
    expect(source).toContain("label={t('До')}")
  })

  it('gives the payment account type switch the canonical label/control slots', () => {
    const source = pageSources[pagePaths[1]]

    expect(source).toContain('className="app-filter-field payment-accounts-type-filter"')
    expect(source).toContain('className="app-filter-label"')
  })

  it('starts the currency traders header with search', () => {
    const source = pageSources[pagePaths[5]]
    const rowStart = source.indexOf('className="currency-convertors-filter-row"')
    const rowContentStart = source.indexOf('>', rowStart) + 1
    const firstChild = source.slice(rowContentStart).trimStart()

    expect(rowStart).toBeGreaterThanOrEqual(0)
    expect(firstChild.startsWith('<TextInput')).toBe(true)
    expect(firstChild).toContain("label={t('Пошук')}")
  })

  it('uses the shared role-pill style for available payment footer values', () => {
    const source = pageSources[pagePaths[0]]
    const totalCellSource = source.slice(
      source.indexOf('function TotalCell'),
      source.indexOf('function useAvailablePaymentsColumns'),
    )

    expect(totalCellSource).toContain('<Badge className="app-role-pill" variant="light">')
    expect(totalCellSource).toContain('{label}: {value}')
    expect(totalCellSource).not.toContain('<Text c="dimmed"')
    expect(totalCellSource).not.toContain('<Text fw=')
  })

  it('keeps the payment accounts footer title and value inside one role pill', () => {
    const source = pageSources[pagePaths[1]]
    const footerStart = source.indexOf('className="payment-accounts-total-footer"')
    const footerSource = source.slice(footerStart, source.indexOf('</Group>', footerStart))

    expect(footerStart).toBeGreaterThanOrEqual(0)
    expect(footerSource).toContain('<Badge className="app-role-pill" variant="light">')
    expect(footerSource).toContain("{t('Всього в EUR')}: {formatMoney(totalEuroAmount)}")
    expect(footerSource).not.toContain('<Text')
  })
})
