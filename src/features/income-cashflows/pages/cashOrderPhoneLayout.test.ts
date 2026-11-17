// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('cash-order operation types at phone width', () => {
  it.each([
    ['src/features/income-cashflows/pages/income-cashflows-page.css', '.income-cashflow-client-form__operation-tabs.mantine-SegmentedControl-root'],
    ['src/features/outgoing-cashflows/pages/outgoing-cashflows-page.css', '.outgoing-cashflow-create-form__tabs.mantine-SegmentedControl-root'],
  ])('%s stacks the options under 480px', (file, selector) => {
    const css = readFileSync(file, 'utf8') as string
    const media = css.slice(css.lastIndexOf('@media (max-width: 480px)'))

    expect(media).toContain(selector)
    expect(media).toContain('flex-direction: column')
  })
})
