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
