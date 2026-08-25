import { readdirSync, readFileSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPOSITORY_ROOT = process.cwd()
const SOURCE_ROOT = resolve(REPOSITORY_ROOT, 'src')

const MIGRATED_DEPRECATED_ROUTES = [
  '/accounting/cashflow/document/export',
  '/accounting/cashflow/get/filtered',
  '/act/providing/services/all',
  '/act/providing/services/get/',
  '/bank/all',
  '/clients/all/filtered',
  '/clients/all/manufacturers',
  '/clients/document',
  '/clients/get',
  '/clients/new',
  '/clients/suppliers/all/filtered',
  '/clients/switch/active',
  '/consignment/note/settings/add',
  '/consignment/note/settings/all/get',
  '/consignment/note/settings/print/document',
  '/consignment/note/settings/remove',
  '/consignment/note/settings/update',
  '/consumables/categories/search',
  '/consignments/info/movement/document/export',
  '/consignments/info/movement/filtered',
  '/delivery/product/protocol/get/',
  '/payments/costs/movements/all/search',
  '/payments/movements/all',
  '/payments/movements/all/search',
  '/payments/movements/new',
  '/payments/orders/income/new',
  '/payments/orders/outcome/new',
  '/payments/orders/outcome/new/supplies',
  '/procurement/charts',
  '/products/get',
  '/products/incomes/get/supply/order',
  '/products/placements/history/all/filtered',
  '/products/writeoff/rules/delete',
  '/protocol/act/invoice/set/edit/act/for/editing',
  '/resales/add',
  '/resales/remove',
  '/resales/update',
  '/sales/get',
  '/sales/get/current',
  '/sales/get/current/unmerged',
  '/sales/get/document/history',
  '/sales/get/merged',
  '/sales/get/shifted',
  '/sales/get/shifted/document',
  '/sales/get/shifted/hisotry/document',
  '/sales/update',
  '/sales/update/file',
  '/sales/update/get/payment/document',
  '/sales/update/merged',
  '/storages/all',
  '/storages/get/all/filtered',
  '/supplies/documents/upload',
  '/supplies/invoices/documents/add',
  '/supplies/invoices/items/get',
  '/supplies/invoices/items/update',
  '/supplies/invoices/order/documents/add',
  '/supplies/invoices/update',
  '/supplies/orders/get',
  '/supplies/orders/get/items/total',
  '/supplies/orders/items/all/order',
  '/supplies/orders/payments/all/keys',
  '/supplies/orders/update',
  '/supplies/organizations/all/search',
  '/supplies/organizations/agreement/new',
  '/supplies/organizations/agreement/update',
  '/supplies/organizations/delete',
  '/supplies/organizations/new',
  '/supplies/organizations/update',
  '/supplies/packinglists/update',
  '/supplies/proforms/delete/document',
  '/supplies/proforms/upload/documents',
  '/supplies/ukraine/carriers/statham/all/search',
  '/supplies/ukraine/order/get',
  '/supplies/ukraine/order/packlists/sad/update',
  '/supplies/ukraine/order/packlists/sad/update/sale',
  '/supplies/ukraine/order/update',
  '/transporters/all/type',
  '/transporters/types/all',
  '/usermanagement/profiles/all/by',
  '/usermanagement/profiles/roles/all',
]

const ALLOWED_DEPRECATED_ROUTE_USAGES = [
  blocker('/payments/orders/income/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 1),
  blocker('/payments/orders/income/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 2),
  blocker('/payments/orders/income/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 3),
  blocker('/payments/orders/income/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 4),
  blocker('/payments/orders/income/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 5),
  blocker('/payments/orders/income/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 6),
  blocker('/payments/orders/outcome/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 1),
  blocker('/payments/orders/outcome/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 2),
  blocker('/payments/orders/outcome/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 3),
  blocker('/payments/orders/outcome/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 4),
  blocker('/payments/orders/outcome/new', 'src/features/accounting/accountingOperationCatalog.ts', 'Financial mutation cutover requires explicitly approved per-operation endpoint routing.', 5),
]

function blocker(route, file, reason, occurrence = 1) {
  return { file, occurrence, reason, route }
}

describe('legacy API route cutover contract', () => {
  const usages = scanApiRouteUsages()

  it('does not reintroduce routes that already have an exact scoped replacement', () => {
    const allowed = new Set(ALLOWED_DEPRECATED_ROUTE_USAGES.map(usageIdentity))
    const regressions = usages.filter((usage) =>
      MIGRATED_DEPRECATED_ROUTES.includes(usage.route) && !allowed.has(usageIdentity(usage)),
    )

    expect(regressions).toEqual([])
  })

  it('keeps every unresolved deprecated route in an exact, reasoned allowlist', () => {
    const actual = usages
      .filter((usage) => MIGRATED_DEPRECATED_ROUTES.includes(usage.route))
      .map(usageIdentity)
      .sort()
    const expected = ALLOWED_DEPRECATED_ROUTE_USAGES
      .map(usageIdentity)
      .sort()

    expect(actual).toEqual(expected)
    expect(ALLOWED_DEPRECATED_ROUTE_USAGES.every((usage) => usage.reason.trim().length >= 20)).toBe(true)
    expect(new Set(expected).size).toBe(expected.length)
  })

  it('forces every live Sales Ukraine wizard caller onto scoped APIs', () => {
    const wizardUsages = scanSourceFiles()
      .flatMap(({ file, source }) =>
        [...source.matchAll(/<(?:Lazy)?NewSaleWizard\b[\s\S]*?\/>/g)]
          .map((match) => ({ file, tag: match[0] })),
      )

    expect(wizardUsages.map((usage) => usage.file).sort()).toEqual([
      'src/features/clients/components/recommendations/RecommendationsPanel.tsx',
      'src/features/sales-cockpit/components/MyClientsPanel.tsx',
      'src/features/sales-ukraine/pages/SalesUkrainePage.tsx',
    ])
    expect(wizardUsages.every((usage) => /\bpermissionScopedSalesUkraineApi\b/.test(usage.tag))).toBe(true)
  })
})

function scanApiRouteUsages() {
  return scanSourceFiles()
    .filter(({ file }) => isApiSurface(file))
    .flatMap(({ file, source }) => {
      const occurrences = new Map()

      return [...source.matchAll(/(['"`])(\/[a-zA-Z0-9][^'"`\r\n]*)\1/g)]
        .map((match) => {
          const route = match[2]
          const occurrence = (occurrences.get(route) ?? 0) + 1
          occurrences.set(route, occurrence)

          return { file, occurrence, route }
        })
    })
}

function usageIdentity({ file, occurrence, route }) {
  return `${route} @ ${file}#${occurrence}`
}

function scanSourceFiles() {
  return walk(SOURCE_ROOT)
    .filter((file) => ['.ts', '.tsx'].includes(extname(file)))
    .filter((file) => !/\.(?:test|spec)\.[^.]+$/i.test(file))
    .map((file) => ({
      file: relative(REPOSITORY_ROOT, file).replaceAll('\\', '/'),
      source: readFileSync(file, 'utf8'),
    }))
}

function isApiSurface(file) {
  return file.includes('/api/')
    || file.endsWith('Api.ts')
    || file.endsWith('/accountingOperationCatalog.ts')
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    })
}
