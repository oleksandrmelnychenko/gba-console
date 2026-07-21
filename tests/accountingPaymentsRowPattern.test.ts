import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import postcss, { type Root, type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

const pages = [
  {
    cssPath: 'src/features/available-payments/pages/available-payments-page.css',
    icon: '<ListTree size={18} />',
    pagePath: 'src/features/available-payments/pages/AvailablePaymentsPage.tsx',
    tableSelector: '.available-payments-page__table',
  },
  {
    cssPath: 'src/features/payment-accounts/pages/payment-accounts-page.css',
    icon: '<Pencil size={18} />',
    pagePath: 'src/features/payment-accounts/pages/PaymentAccountsPage.tsx',
    tableSelector: '.payment-accounts-page__table',
  },
]

describe('accounting payments body-row pattern', () => {
  it.each(pages)('$pagePath keeps body rows equal and single-line', ({ cssPath, tableSelector }) => {
    const root = postcss.parse(readFileSync(join(cwd(), cssPath), 'utf8'))
    const normalRow = findRule(root, `${tableSelector} .data-table-density-normal .data-table-row`)
    const compactRow = findRule(root, `${tableSelector} .data-table-density-compact .data-table-row`)
    const cell = findRule(root, `${tableSelector} .data-table-cell`)
    const cellContent = findRule(root, `${tableSelector} .data-table-cell > *`)

    expect(declarations(normalRow)).toMatchObject({ height: '45px' })
    expect(declarations(compactRow)).toMatchObject({ height: '35px' })
    expect(declarations(cell)).toMatchObject({ 'white-space': 'nowrap' })
    expect(declarations(cellContent)).toMatchObject({
      'min-width': '0',
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap',
    })
  })

  it.each(pages)('$pagePath uses the canonical row-action geometry', ({ icon, pagePath }) => {
    const source = readFileSync(join(cwd(), pagePath), 'utf8')
    const columnsStart = source.indexOf('function use')
    const actionStart = source.indexOf("id: 'actions'", columnsStart)
    const actionSource = source.slice(actionStart, actionStart + 1_600)

    expect(actionStart).toBeGreaterThanOrEqual(0)
    expect(actionSource).toContain('color="gray"')
    expect(actionSource).toContain('size="md"')
    expect(actionSource).toContain('variant="subtle"')
    expect(actionSource).toContain(icon)
    expect(actionSource).not.toContain('size="sm"')
  })
})

function findRule(root: Root, selector: string): Rule {
  let match: Rule | undefined

  root.walkRules((rule) => {
    if (rule.selectors.includes(selector)) {
      match = rule
    }
  })

  expect(match, `Missing CSS rule for ${selector}`).toBeDefined()
  return match as Rule
}

function declarations(rule: Rule): Record<string, string> {
  const result: Record<string, string> = {}

  rule.walkDecls((declaration) => {
    result[declaration.prop] = declaration.value
  })

  return result
}
