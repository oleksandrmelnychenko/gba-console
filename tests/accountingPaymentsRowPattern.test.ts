import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import postcss, { type Root, type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

const pages = [
  {
    action: 'details',
    cssPath: 'src/features/available-payments/pages/available-payments-page.css',
    pagePath: 'src/features/available-payments/pages/AvailablePaymentsPage.tsx',
    summarySelector: '.available-payments-summary',
    tableSelector: '.available-payments-page__table',
  },
  {
    action: 'edit',
    cssPath: 'src/features/payment-accounts/pages/payment-accounts-page.css',
    pagePath: 'src/features/payment-accounts/pages/PaymentAccountsPage.tsx',
    summarySelector: '.payment-accounts-total-footer',
    tableSelector: '.payment-accounts-page__table',
  },
]

const TABLE_ROW_ACTION_SOURCE = 'src/shared/ui/table-row-action/TableRowAction.tsx'
const TABLE_ROW_ACTION_CSS = 'src/shared/ui/table-row-action/table-row-action.css'

describe('accounting payments body-row pattern', () => {
  it.each(pages)('$pagePath keeps body cells single-line', ({ cssPath, tableSelector }) => {
    const root = postcss.parse(readFileSync(join(cwd(), cssPath), 'utf8'))
    const cell = findRule(root, `${tableSelector} .data-table-cell`)
    const cellContent = findRule(root, `${tableSelector} .data-table-cell > *`)

    expect(declarations(cell)).toMatchObject({ 'white-space': 'nowrap' })
    expect(declarations(cellContent)).toMatchObject({
      'min-width': '0',
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap',
    })
  })

  it('defines the canonical row-action geometry and semantic glyphs in shared UI', () => {
    const source = readFileSync(join(cwd(), TABLE_ROW_ACTION_SOURCE), 'utf8')
    const root = postcss.parse(readFileSync(join(cwd(), TABLE_ROW_ACTION_CSS), 'utf8'))
    const action = findRule(root, '.app-table-row-action.mantine-ActionIcon-root')
    const glyph = findRule(root, '.app-table-row-action.mantine-ActionIcon-root svg')

    expect(source).toContain('details: Eye')
    expect(source).toContain('edit: Pencil')
    expect(source).toContain('size="md"')
    expect(source).toContain('variant="subtle"')
    expect(source).toContain('<Icon aria-hidden="true" size={16}')
    expect(declarations(action)).toMatchObject({
      flex: '0 0 28px',
      height: '28px',
      'min-height': '28px',
      'min-width': '28px',
      width: '28px',
    })
    expect(declarations(glyph)).toMatchObject({
      height: '16px',
      'stroke-width': '1.8',
      width: '16px',
    })
  })

  it.each(pages)('$pagePath delegates its action column to the shared semantic action', ({ action, pagePath }) => {
    const source = readFileSync(join(cwd(), pagePath), 'utf8')
    const columnsStart = source.indexOf('function use')
    const actionStart = source.indexOf("id: 'actions'", columnsStart)
    const actionSource = source.slice(actionStart, actionStart + 1_600)

    expect(actionStart).toBeGreaterThanOrEqual(0)
    expect(actionSource).toContain('<TableRowAction')
    expect(actionSource).toContain(`action="${action}"`)
    expect(actionSource).not.toContain('<ActionIcon')
  })

  it.each(pages)('$pagePath uses the compact table-summary footer', ({ cssPath, summarySelector }) => {
    const root = postcss.parse(readFileSync(join(cwd(), cssPath), 'utf8'))
    const summary = findRule(root, summarySelector)
    const badge = findRule(root, `${summarySelector} .mantine-Badge-root`)

    expect(declarations(summary)).toMatchObject({
      'min-height': '30px',
      'overflow-x': 'auto',
      padding: '4px 12px',
    })
    expect(declarations(badge)).toMatchObject({ height: '20px' })
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
