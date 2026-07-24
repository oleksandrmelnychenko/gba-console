import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import { PaymentArticlesShell } from '../../features/payment-articles/PaymentArticlesShell'
import { consoleRoutes } from './consoleRoutes'

describe('console report routes', () => {
  it('registers both sales-report URLs as direct routes', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    expect(paths.has('/reports/sale')).toBe(true)
    expect(paths.has('/reports/sales')).toBe(true)
  })
})

describe('console payment article routes', () => {
  const listPaths = [
    '/accounting/payment-expense-articles',
    '/accounting/payment-cashflow-articles',
  ]
  const formPaths = listPaths.flatMap((path) => [`${path}/new`, `${path}/edit/:id`])

  it('keeps both legacy list and form URLs registered', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    for (const path of [...listPaths, ...formPaths]) {
      expect(paths.has(path)).toBe(true)
    }
  })

  it.each(listPaths)('renders %s inside the shared payment articles shell', (path) => {
    const route = consoleRoutes.find((candidate) => candidate.path === path)

    expect(isValidElement(route?.element)).toBe(true)

    if (!isValidElement(route?.element)) {
      throw new Error(`Expected ${path} to render a React element`)
    }

    expect(route.element.type).toBe(PaymentArticlesShell)
  })
})
