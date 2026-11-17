import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// jsdom has no layout, so the placement itself is checked in the browser; this guards the rule.
describe('toast placement', () => {
  it('moves toasts off the dialog and drawer footer while one is open', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/providers/notifications.css'), 'utf8')
    const start = css.indexOf("body[data-scroll-locked] .app-toasts[data-position='bottom-right'] {")
    const rule = css.slice(start, css.indexOf('}', start))

    // Closed dialogs stay mounted, so :has(.mantine-Modal-root) would match on every page.
    expect(start).toBeGreaterThan(-1)
    expect(css).not.toContain(':has(.mantine-Modal-root')
    expect(rule).toContain('bottom: auto;')
    expect(rule).toMatch(/top: calc\(12px/)
  })
})

describe('data table empty state', () => {
  it('keeps actions in the empty/error state clickable', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/shared/ui/data-table/data-table.css'), 'utf8')
    const start = css.indexOf('.data-table-empty-content :is(a, button')

    expect(start).toBeGreaterThan(-1)
    expect(css.slice(start, css.indexOf('}', start))).toContain('pointer-events: auto;')
  })
})

describe('invoices sheet at phone width', () => {
  it('lets the header actions shrink and wrap, and the tab row scroll', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/features/supply-ukraine-orders/pages/supply-order-invoices.css'), 'utf8')
    const actions = css.slice(css.indexOf('.supply-invoices-sheet .supply-detail-header-actions {'))

    expect(actions.slice(0, actions.indexOf('}'))).toMatch(/flex: 0 1 auto;[\s\S]*flex-wrap: wrap;[\s\S]*min-width: 0;/)
    expect(css).toContain('.supply-invoices-tabs > .mantine-Tabs-list { flex-wrap: nowrap; overflow-x: auto; }')
  })
})
